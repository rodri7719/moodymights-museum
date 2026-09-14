// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Non-transferable game points and character entitlements, not an ERC20/NFT.
/// @dev Starts in private mode, with claims disabled. USD/ETH quote is a trusted-admin
/// input, not an oracle. It expires within 24h and must be refreshed explicitly.
contract VendettaCourt is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    uint8 public constant PENGUIN = 0;
    uint8 public constant ALEXMAZE = 1;
    uint8 public constant SAUCIII = 2;
    uint8 public constant LUCA = 3;
    uint8 public constant SPARTANO = 4;
    uint256 public constant INITIAL_TEST_POINTS = 30_000;
    uint256 public constant MAX_RUN_POINTS = 1_000;
    uint256 public constant MAX_QUOTE_AGE = 1 days;
    bytes32 public constant REWARD_TYPEHASH = keccak256("Reward(address player,bytes32 runId,uint256 points,uint256 feeWei,uint256 deadline,uint256 epoch)");

    struct Reward {address player; bytes32 runId; uint256 points; uint256 feeWei; uint256 deadline; uint256 epoch;}
    address payable public immutable treasury;
    address public rewardSigner;
    uint256 public signerEpoch;
    bool public claimsEnabled;
    bool public privateMode = true;
    mapping(address => bool) public testers;
    mapping(address => uint256) public points;
    mapping(address => uint256) private characterBits;
    mapping(bytes32 => bool) public claimedRuns;
    uint256 public collectedFees;
    uint256 public ethUsdE8;
    uint256 public quoteExpiresAt;
    uint256 public claimFeeWei;
    uint256 public spartanoPriceWei;

    error InvalidAddress(); error PrivateAccess(); error ClaimsDisabled();
    error InvalidReward(); error RewardExpired(); error AlreadyClaimed();
    error InvalidSignature(); error WrongPayment(); error InvalidCharacter();
    error AlreadyOwned(); error InsufficientPoints(); error QuoteExpired();
    error InvalidQuote(); error PriceChanged(); error TransferFailed();
    event TestPointsAssigned(address indexed player,uint256 amount);
    event RewardClaimed(address indexed player,bytes32 indexed runId,uint256 points,uint256 feeWei);
    event CharacterUnlocked(address indexed player,uint8 indexed character,uint256 pointsSpent,uint256 ethPaid);
    event QuoteUpdated(uint256 ethUsdE8,uint256 claimFeeWei,uint256 spartanoPriceWei,uint256 expiresAt);
    event SignerUpdated(address indexed signer,uint256 epoch);
    event ClaimsStatus(bool enabled); event PrivateStatus(bool enabled);
    event TesterStatus(address indexed tester,bool allowed);
    event FeesWithdrawn(address indexed treasury,uint256 amount);

    constructor(address admin,address payable recipient)
        Ownable(admin) EIP712("VendettaCourt", "1") {
        if(recipient==address(0)) revert InvalidAddress();
        treasury=recipient;testers[admin]=true;points[admin]=INITIAL_TEST_POINTS;
        emit TestPointsAssigned(admin,INITIAL_TEST_POINTS);
    }
    modifier allowed(){if(privateMode&&!testers[msg.sender])revert PrivateAccess();_;}
    function pointPrice(uint8 character) public pure returns(uint256){
        if(character==ALEXMAZE)return 5_000;
        if(character==SAUCIII)return 10_000;
        if(character==LUCA)return 15_000;
        revert InvalidCharacter();
    }
    function ownsCharacter(address player,uint8 character) public view returns(bool){
        if(character>SPARTANO)revert InvalidCharacter();
        return character==PENGUIN || characterBits[player]&(1<<character)!=0;
    }
    function unlockWithPoints(uint8 character) external whenNotPaused allowed {
        uint256 price=pointPrice(character);
        if(ownsCharacter(msg.sender,character))revert AlreadyOwned();
        if(points[msg.sender]<price)revert InsufficientPoints();
        points[msg.sender]-=price;characterBits[msg.sender]|=1<<character;
        emit CharacterUnlocked(msg.sender,character,price,0);
    }
    function buySpartano(uint256 expectedPriceWei) external payable whenNotPaused allowed nonReentrant {
        _freshQuote();
        if(expectedPriceWei!=spartanoPriceWei)revert PriceChanged();
        if(msg.value!=spartanoPriceWei)revert WrongPayment();
        if(ownsCharacter(msg.sender,SPARTANO))revert AlreadyOwned();
        characterBits[msg.sender]|=1<<SPARTANO;collectedFees+=msg.value;
        emit CharacterUnlocked(msg.sender,SPARTANO,0,msg.value);
    }
    function rewardDigest(Reward calldata reward) public view returns(bytes32){
        return _hashTypedDataV4(keccak256(abi.encode(REWARD_TYPEHASH,reward.player,reward.runId,reward.points,reward.feeWei,reward.deadline,reward.epoch)));
    }
    function claimReward(Reward calldata reward,bytes calldata signature) external payable whenNotPaused allowed nonReentrant {
        if(!claimsEnabled)revert ClaimsDisabled();_freshQuote();
        if(reward.player!=msg.sender||reward.runId==bytes32(0)||reward.points==0||reward.points>MAX_RUN_POINTS||reward.epoch!=signerEpoch)revert InvalidReward();
        if(block.timestamp>reward.deadline)revert RewardExpired();
        if(claimedRuns[reward.runId])revert AlreadyClaimed();
        if(reward.feeWei!=claimFeeWei)revert PriceChanged();
        if(msg.value!=reward.feeWei)revert WrongPayment();
        if(!SignatureChecker.isValidSignatureNow(rewardSigner,rewardDigest(reward),signature))revert InvalidSignature();
        claimedRuns[reward.runId]=true;points[msg.sender]+=reward.points;collectedFees+=msg.value;
        emit RewardClaimed(msg.sender,reward.runId,reward.points,msg.value);
    }
    /// @notice Quote source is trusted administration. ETH/USD has eight decimals.
    /// Exact costs are visible on chain; rounding is up to the next wei.
    function setEthUsdQuote(uint256 usdPerEthE8,uint256 expiresAt) external onlyOwner {
        if(usdPerEthE8<1e8||usdPerEthE8>1_000_000e8||expiresAt<=block.timestamp||expiresAt>block.timestamp+MAX_QUOTE_AGE)revert InvalidQuote();
        ethUsdE8=usdPerEthE8;quoteExpiresAt=expiresAt;
        claimFeeWei=Math.mulDiv(1 ether,1_000_000,usdPerEthE8,Math.Rounding.Ceil);
        spartanoPriceWei=Math.mulDiv(1 ether,100_000_000,usdPerEthE8,Math.Rounding.Ceil);
        emit QuoteUpdated(usdPerEthE8,claimFeeWei,spartanoPriceWei,expiresAt);
    }
    function setRewardSigner(address signer) external onlyOwner {
        if(signer==address(0))revert InvalidAddress();rewardSigner=signer;signerEpoch++;claimsEnabled=false;
        emit SignerUpdated(signer,signerEpoch);emit ClaimsStatus(false);
    }
    function setClaimsEnabled(bool enabled) external onlyOwner {
        if(enabled&&rewardSigner==address(0))revert InvalidAddress();claimsEnabled=enabled;emit ClaimsStatus(enabled);
    }
    function setTester(address tester,bool enabled) external onlyOwner {if(tester==address(0))revert InvalidAddress();testers[tester]=enabled;emit TesterStatus(tester,enabled);}
    function setPrivateMode(bool enabled) external onlyOwner {privateMode=enabled;emit PrivateStatus(enabled);}
    function pause() external onlyOwner {_pause();}
    function unpause() external onlyOwner {_unpause();}
    /// @notice Anyone may trigger delivery, but the recipient is immutable.
    /// Pull payment avoids a treasury fallback blocking purchases and claims.
    function withdrawFees() external nonReentrant {
        uint256 amount=collectedFees;collectedFees=0;
        (bool ok,)=treasury.call{value:amount}("");if(!ok)revert TransferFailed();emit FeesWithdrawn(treasury,amount);
    }
    function _freshQuote() private view {if(quoteExpiresAt==0||block.timestamp>quoteExpiresAt)revert QuoteExpired();}
}
