const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const gameRoot=path.join(__dirname,'../vendettacourt');
const engineVersion=crypto.createHash('sha256').update(fs.readFileSync(path.join(gameRoot,'index.html'),'utf8').replace(/\r\n/g,'\n')).update(fs.readFileSync(path.join(gameRoot,'replay.js'),'utf8').replace(/\r\n/g,'\n')).digest('hex');
function config(){return{enabled:process.env.VENDETTA_ENABLED==='true',contract:process.env.VENDETTA_CONTRACT_V3||process.env.VENDETTA_CONTRACT_V2,contractVersion:process.env.VENDETTA_CONTRACT_V3?3:2,origin:process.env.VENDETTA_ORIGIN||'https://www.moodyworld.xyz',rpc:process.env.ABSTRACT_RPC_URL||'https://api.mainnet.abs.xyz',engineVersion,gameRoot}}
module.exports={config};
