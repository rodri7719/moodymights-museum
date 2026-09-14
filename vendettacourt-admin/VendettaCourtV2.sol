// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
interface ILegacyVendetta {function paused() external view returns(bool);function points(address) external view returns(uint256);function ownsCharacter(address,uint8) external view returns(bool);function owner() external view returns(address);function treasury() external view returns(address);}
/// @notice V2 preserves the frozen V1 balance and roster. Players pay their own gas.
contract VendettaCourtV2 is Ownable2Step,Pausable,ReentrancyGuard,EIP712 {
 ILegacyVendetta public immutable legacy;
 address payable public immutable treasury;
 address public rewardSigner;address public priceSigner;
 uint256 public signerEpoch;uint256 public priceEpoch;
 bool public claimsEnabled;bool public privateMode=true;
 mapping(address=>bool) public testers;
 mapping(address=>bool) public migrated;
 mapping(address=>uint256) private balances;
 mapping(address=>uint8) private rosters;
 mapping(bytes32=>bool) public claimedRuns;
 uint256 public collectedFees;
 struct Reward{address player;bytes32 runId;uint256 points;uint256 feeWei;uint256 deadline;uint256 epoch;}
 struct Price{address player;uint256 priceWei;uint256 deadline;uint256 epoch;}
 bytes32 private constant REWARD_TYPEHASH=keccak256("Reward(address player,bytes32 runId,uint256 points,uint256 feeWei,uint256 deadline,uint256 epoch)");
 bytes32 private constant PRICE_TYPEHASH=keccak256("Price(address player,uint256 priceWei,uint256 deadline,uint256 epoch)");
 event Migrated(address indexed player,uint256 points,uint8 roster);
 event CharacterUnlocked(address indexed player,uint8 indexed character,uint256 pointsSpent,uint256 ethPaid);
 event RewardClaimed(address indexed player,bytes32 indexed runId,uint256 points,uint256 feeWei);
 event SignerUpdated(address indexed signer,uint256 epoch,bool forPrices);
 event ClaimsStatus(bool enabled);event PrivateStatus(bool enabled);event TesterStatus(address indexed tester,bool allowed);
 event FeesWithdrawn(address indexed treasury,uint256 amount);
 error Invalid();error LegacyNotFrozen();error NotAllowed();error AlreadyOwned();error InsufficientPoints();error AlreadyClaimed();error BadSignature();error Expired();error WrongPayment();error ClaimsDisabled();error TransferFailed();
 constructor(address admin,address payable recipient,address previous)Ownable(admin)EIP712("VendettaCourt","2"){
  if(recipient==address(0)||previous.code.length==0)revert Invalid();legacy=ILegacyVendetta(previous);
  if(legacy.owner()!=admin||legacy.treasury()!=recipient)revert Invalid();treasury=recipient;testers[admin]=true;
 }
 modifier allowed(){if(privateMode&&!testers[msg.sender])revert NotAllowed();_;}
 function points(address player)public view returns(uint256){return migrated[player]?balances[player]:legacy.points(player);}
 function ownsCharacter(address player,uint8 id)public view returns(bool){if(id>4)revert Invalid();return id==0||(migrated[player]?(rosters[player]&(uint8(1)<<id))!=0:legacy.ownsCharacter(player,id));}
 function pointPrice(uint8 id)public pure returns(uint256){if(id<1||id>3)revert Invalid();return uint256(id)*5000;}
 function _migrate(address player)private{if(!legacy.paused())revert LegacyNotFrozen();if(migrated[player])return;uint8 bits=1;for(uint8 i=1;i<=4;i++)if(legacy.ownsCharacter(player,i))bits|=uint8(1)<<i;balances[player]=legacy.points(player);rosters[player]=bits;migrated[player]=true;emit Migrated(player,balances[player],bits);}
 function unlockWithPoints(uint8 id)external whenNotPaused allowed{uint256 cost=pointPrice(id);_migrate(msg.sender);if(ownsCharacter(msg.sender,id))revert AlreadyOwned();if(balances[msg.sender]<cost)revert InsufficientPoints();balances[msg.sender]-=cost;rosters[msg.sender]|=uint8(1)<<id;emit CharacterUnlocked(msg.sender,id,cost,0);}
 function buySpartano(Price calldata price,bytes calldata signature)external payable whenNotPaused allowed nonReentrant{
  _migrate(msg.sender);if(ownsCharacter(msg.sender,4))revert AlreadyOwned();
  if(price.player!=msg.sender||price.priceWei==0||price.epoch!=priceEpoch||priceSigner==address(0))revert Invalid();
  if(price.deadline<block.timestamp||price.deadline>block.timestamp+10 minutes)revert Expired();
  if(msg.value!=price.priceWei)revert WrongPayment();
  bytes32 digest=_hashTypedDataV4(keccak256(abi.encode(PRICE_TYPEHASH,price.player,price.priceWei,price.deadline,price.epoch)));
  if(!SignatureChecker.isValidSignatureNow(priceSigner,digest,signature))revert BadSignature();
  rosters[msg.sender]|=16;collectedFees+=msg.value;emit CharacterUnlocked(msg.sender,4,0,msg.value);
 }
 function claimReward(Reward calldata r,bytes calldata signature)external payable whenNotPaused allowed nonReentrant{
  if(!claimsEnabled)revert ClaimsDisabled();_migrate(msg.sender);
  if(r.player!=msg.sender||r.runId==bytes32(0)||r.points==0||r.points>1000||r.feeWei==0||r.epoch!=signerEpoch)revert Invalid();
  if(r.deadline<block.timestamp||r.deadline>block.timestamp+10 minutes)revert Expired();if(claimedRuns[r.runId])revert AlreadyClaimed();if(msg.value!=r.feeWei)revert WrongPayment();
  bytes32 digest=_hashTypedDataV4(keccak256(abi.encode(REWARD_TYPEHASH,r.player,r.runId,r.points,r.feeWei,r.deadline,r.epoch)));
  if(!SignatureChecker.isValidSignatureNow(rewardSigner,digest,signature))revert BadSignature();claimedRuns[r.runId]=true;balances[msg.sender]+=r.points;collectedFees+=msg.value;emit RewardClaimed(msg.sender,r.runId,r.points,r.feeWei);
 }
 function setRewardSigner(address signer)external onlyOwner{if(signer==address(0))revert Invalid();rewardSigner=signer;signerEpoch++;claimsEnabled=false;emit SignerUpdated(signer,signerEpoch,false);emit ClaimsStatus(false);}
 function setPriceSigner(address signer)external onlyOwner{if(signer==address(0))revert Invalid();priceSigner=signer;priceEpoch++;emit SignerUpdated(signer,priceEpoch,true);}
 function setClaimsEnabled(bool enabled)external onlyOwner{if(enabled&&rewardSigner==address(0))revert Invalid();claimsEnabled=enabled;emit ClaimsStatus(enabled);}
 function setTester(address tester,bool enabled)external onlyOwner{if(tester==address(0))revert Invalid();testers[tester]=enabled;emit TesterStatus(tester,enabled);}
 function setPrivateMode(bool enabled)external onlyOwner{privateMode=enabled;emit PrivateStatus(enabled);}
 function pause()external onlyOwner{_pause();}function unpause()external onlyOwner{_unpause();}
 function withdrawFees()external nonReentrant{uint256 amount=collectedFees;collectedFees=0;(bool ok,)=treasury.call{value:amount}("");if(!ok)revert TransferFailed();emit FeesWithdrawn(treasury,amount);}
}
