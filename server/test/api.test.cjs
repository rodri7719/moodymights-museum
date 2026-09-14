const {test}=require('node:test'),assert=require('node:assert/strict');
test('API requires wallet auth; ignores claimed wins; consumes matches; signs only verified closed runs',async()=>{
 const viem=require('viem'),{generatePrivateKey,privateKeyToAccount}=require('viem/accounts');
 const user=privateKeyToAccount(generatePrivateKey()),other=privateKeyToAccount(generatePrivateKey()),signer=privateKeyToAccount(generatePrivateKey());
 process.env.VENDETTA_ENABLED='true';process.env.VENDETTA_CONTRACT_V2='0x1111111111111111111111111111111111111111';process.env.VENDETTA_ORIGIN='https://test.invalid';process.env.VENDETTA_SESSION_SECRET='x'.repeat(64);process.env.VENDETTA_PRICE_SIGNER_KEY=signer.getHdKey?'':signer.source;
 const signerKey=generatePrivateKey(),rewardSigner=privateKeyToAccount(signerKey);process.env.VENDETTA_REWARD_SIGNER_KEY=signerKey;process.env.VENDETTA_PRICE_SIGNER_KEY=signerKey;
 const data=new Map(),locks=new Set(),clone=v=>v==null?v:structuredClone(v),db={get:async k=>clone(data.get(k)),set:async(k,v)=>{data.set(k,clone(v));return'OK'},del:async k=>data.delete(k)?1:0,sadd:async(k,v)=>{const set=data.get(k)||[];if(!set.includes(v))set.push(v);data.set(k,set)},srem:async(k,v)=>data.set(k,(data.get(k)||[]).filter(x=>x!==v)),smembers:async k=>clone(data.get(k)||[])};
 require.cache[require.resolve('../store.cjs')]={id:require.resolve('../store.cjs'),filename:require.resolve('../store.cjs'),loaded:true,exports:{db:()=>db,key:(w,n)=>w.toLowerCase()+':'+n,limited:async()=>{},withLock:async(w,fn)=>{if(locks.has(w))throw Error('locked');locks.add(w);try{return await fn()}finally{locks.delete(w)}}}};
 const realViem=require.cache[require.resolve('viem')].exports;
 require.cache[require.resolve('viem')].exports={...realViem,createPublicClient:()=>({verifyMessage:viem.verifyMessage,readContract:async({functionName,address})=>({legacy:'0x2222222222222222222222222222222222222222',paused:address==='0x2222222222222222222222222222222222222222',privateMode:false,ownsCharacter:true,claimedRuns:false,claimsEnabled:true,signerEpoch:1n,priceEpoch:1n,rewardSigner:rewardSigner.address,priceSigner:rewardSigner.address})[functionName]})};
 require.cache[require.resolve('../prices.cjs')]={loaded:true,exports:{ethUsd:async()=>250000000000n,weiForUsd:(usd,rate)=>(10n**18n*usd+rate-1n)/rate}};
 let verifierWins=false,verifierCalls=0;
 require.cache[require.resolve('../replay-verifier.cjs')]={loaded:true,exports:{verifyMatch:async()=>{verifierCalls++;return{complete:true,win:verifierWins,ticks:1}}}};
 const handler=require('../../api/vendetta.js');
 async function request(action,body={},token){let status=200,response;const res={setHeader(){},status(n){status=n;return this},json(v){response=v}};await handler({method:'POST',query:{action},headers:{origin:'https://test.invalid',authorization:token?'Bearer '+token:''},body},res);return{status,body:response}}
 assert.equal((await request('new-run',{character:'penguin'})).status,400);
 const c=await request('challenge',{wallet:user.address});assert.equal(c.status,200);
 const wrong=await request('login',{wallet:user.address,nonce:c.body.nonce,signature:await other.signMessage({message:c.body.message})});assert.equal(wrong.status,400);
 const login=await request('login',{wallet:user.address,nonce:c.body.nonce,signature:await user.signMessage({message:c.body.message})});assert.equal(login.status,200);const token=login.body.token;
 assert.equal((await request('login',{wallet:user.address,nonce:c.body.nonce,signature:await user.signMessage({message:c.body.message})})).status,400);
 let r=(await request('new-run',{character:'penguin'},token)).body.run;
 assert.equal((await request('claim',{runId:r.id},token)).status,400);
 for(let i=0;i<3;i++){const m=(await request('match',{runId:r.id},token)).body.ticket;const result=await request('result',{runId:r.id,matchId:m.id,proof:{frames:[[0,0,[]]],win:true}},token);assert.equal(result.status,200);r=result.body.run;assert.equal(r.earned,0);const again=await request('result',{runId:r.id,matchId:m.id,proof:{frames:[[0,0,[]]],win:true}},token);assert.equal(again.status,200)}assert.equal(verifierCalls,3);assert(r.closed);assert.equal((await request('claim',{runId:r.id},token)).status,400);
 verifierWins=true;r=(await request('new-run',{character:'penguin'},token)).body.run;
 for(let i=0;i<5;i++){const m=(await request('match',{runId:r.id},token)).body.ticket;r=(await request('result',{runId:r.id,matchId:m.id,proof:{frames:[[0,0,[]]]}},token)).body.run}assert.equal(r.earned,1000);
 const claim=await request('claim',{runId:r.id},token);assert.equal(claim.status,200);assert.equal(claim.body.reward.points,'1000');assert.equal(claim.body.reward.player,user.address.toLowerCase());assert.equal(claim.body.reward.feeWei,'4000000000000');assert.equal((await request('status',{},token)).body.pendingRuns.length,1);
 require.cache[require.resolve('viem')].exports=realViem;
});
