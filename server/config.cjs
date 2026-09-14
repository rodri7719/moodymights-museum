const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const gameRoot=path.join(__dirname,'../vendettacourt');
const engineVersion=crypto.createHash('sha256').update(fs.readFileSync(path.join(gameRoot,'index.html'))).update(fs.readFileSync(path.join(gameRoot,'replay.js'))).digest('hex');
function config(){return{enabled:process.env.VENDETTA_ENABLED==='true',contract:process.env.VENDETTA_CONTRACT_V2,origin:process.env.VENDETTA_ORIGIN||'https://www.moodyworld.xyz',rpc:process.env.ABSTRACT_RPC_URL||'https://api.mainnet.abs.xyz',engineVersion,gameRoot}}
module.exports={config};
