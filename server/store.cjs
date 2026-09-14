const {Redis}=require('@upstash/redis');let redis;
function db(){return redis??=Redis.fromEnv()}
const key=(wallet,name)=>`vc:{${wallet.toLowerCase()}}:${name}`;
async function limited(wallet,name,limit,seconds){const k=key(wallet,'limit:'+name),n=await db().eval("local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end;return n",[k],[seconds]);if(n>limit)throw Error('Rate limit. Try again later.')}
async function withLock(wallet,fn){const crypto=require('node:crypto'),token=crypto.randomUUID(),k=key(wallet,'lock');if(!await db().set(k,token,{nx:true,ex:600}))throw Error('Another operation is being checked. Retry shortly.');try{return await fn()}finally{await db().eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",[k],[token])}}
module.exports={db,key,limited,withLock};

