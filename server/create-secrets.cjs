// Run locally. Output must be outside the repository and any served web directory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {privateKeyToAccount,generatePrivateKey}=require('viem/accounts');
const target=path.resolve(process.argv[2]||''),repo=path.resolve(__dirname,'..');
if(!process.argv[2]||target===repo||target.startsWith(repo+path.sep))throw Error('Choose an output .env file OUTSIDE the website/repository.');
const price=generatePrivateKey(),reward=generatePrivateKey();
fs.writeFileSync(target,`VENDETTA_SESSION_SECRET=${crypto.randomBytes(48).toString('hex')}\nVENDETTA_PRICE_SIGNER_KEY=${price}\nVENDETTA_REWARD_SIGNER_KEY=${reward}\n`,{flag:'wx',mode:0o600});
console.log('Private credentials saved outside the repository. Do not paste them into chat or commit them.');
console.log('Price signer address:',privateKeyToAccount(price).address);
console.log('Reward signer address:',privateKeyToAccount(reward).address);
