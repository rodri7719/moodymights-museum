(()=>{
 function applyEconomy(config){const v3=config?.enabled&&config?.contractVersion===3;const luca=champions183.find(c=>c.id==='luca'),spartan=champions183.find(c=>c.id==='spartano');delete luca.usd;delete spartan.usd;luca.price=v3?0:15000;spartan.price=v3?15000:0;(v3?luca:spartan).usd=1;}
 window.addEventListener('vendetta-economy',e=>applyEconomy(e.detail));if(window.vendettaOnlineConfig)applyEconomy(window.vendettaOnlineConfig);
 const startLocal=start;
 let starting=false,submitting=false,pendingRun=null;
 const dbReady=new Promise((resolve,reject)=>{const req=indexedDB.open('vendetta-verified-replays',1);req.onupgradeneeded=()=>req.result.createObjectStore('pending',{keyPath:'key'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
 async function savePending(value){const db=await dbReady;return new Promise((resolve,reject)=>{const tx=db.transaction('pending','readwrite');tx.objectStore('pending').put(value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
 async function deletePending(key){const db=await dbReady;return new Promise((resolve,reject)=>{const tx=db.transaction('pending','readwrite');tx.objectStore('pending').delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
 async function loadPending(wallet,runId){const db=await dbReady;return new Promise((resolve,reject)=>{const req=db.transaction('pending').objectStore('pending').getAll();req.onsuccess=()=>resolve(req.result.filter(x=>x.wallet.toLowerCase()===wallet.toLowerCase()&&(!runId||x.ticket.serverRunId===runId)).sort((a,b)=>(a.ticket.attempt??a.ticket.issuedAt??0)-(b.ticket.attempt??b.ticket.issuedAt??0)));req.onerror=()=>reject(req.error)})}
 function resultsPanel(message,busy=false){
  state='verifying';silenceCourtSounds();
  panel('<div class="eyebrow">STORY RESULTS</div><h2>'+(busy?'LOADING RESULTS…':'RESULTS PENDING')+'</h2>'+(busy?'<progress aria-label="Loading story results" style="width:min(320px,80vw);height:8px;accent-color:#c1ff45"></progress>':'')+'<p id="onlineVerifyMessage" role="status" aria-live="polite"></p>'+(busy?'<p class="note">Please wait. Your matches are saved on this device.</p>':'<div class="row"><button class="primary" id="onlineRetry">LOAD RESULTS</button><button class="secondary" id="onlineBack">BACK TO STORY</button></div>'));
  $('onlineVerifyMessage').textContent=message;
  if(!busy){$('onlineRetry').onclick=submit;$('onlineBack').onclick=storyHome}
 }
 function outcome(run,win){
  if(run.closed)rewardsPanel183();else storyIntro();
  const root=document.querySelector('.story-panel'),message=document.createElement('p');message.id='onlineMatchResult';message.setAttribute('role','status');
  message.textContent=run.closed?(run.stage===5?'STORY COMPLETE · ':'RUN ENDED · ')+run.earned+' POINTS EARNED':win?'VICTORY · '+run.earned+' TOTAL POINTS · NEXT CHALLENGE READY':'MATCH LOST · '+run.lives+' LIVES LEFT · TRY AGAIN';root?.prepend(message);
 }
 async function submit(){
  if(submitting||!pendingRun)return;submitting=true;let slow;
  try{
   const service=window.vendettaOnline;if(!service)throw Error('Connect the wallet that played this story.');
   const queue=await loadPending(service.wallet,pendingRun);if(!queue.length){rewardsPanel183();return}
   resultsPanel('Preparing your story results. Please wait…',true);
   slow=setTimeout(()=>{const el=$('onlineVerifyMessage');if(state==='verifying'&&el)el.textContent='Still preparing your results. Your matches are saved; please keep this page open.'},15000);
   let last;
   for(let i=0;i<queue.length;i++){
    const saved=queue[i];
    if(window.vendettaOnline?.wallet.toLowerCase()!==saved.wallet.toLowerCase())throw Error('Reconnect the wallet that played this story.');
    const message=$('onlineVerifyMessage');if(message)message.textContent='Loading results · '+(i+1)+' / '+queue.length+' matches. Please wait…';
    last=await service.submit(saved.ticket,saved.proof);
    await deletePending(saved.key);
    if(saved.nextRun&&(saved.nextRun.stage!==last.run.stage||saved.nextRun.lives!==last.run.lives)){
     storyMemory.run={...saved.localRun,stage:last.run.stage,lives:last.run.lives,earned:last.run.earned,closed:last.run.closed,onlineAttempt:last.run.revision};storySave();
     throw Error('A saved match differs from the server result. Your confirmed progress is saved. Return to Story before continuing.');
    }
   }
   const local=queue.at(-1).nextRun||queue.at(-1).localRun;
   storyMemory.run={...local,stage:last.run.stage,lives:last.run.lives,earned:last.run.earned,closed:last.run.closed,onlineAttempt:last.run.revision,resultsPending:false};storySave();
   pendingRun=null;vendettaReplay.stop();storyActive=false;G=null;outcome(storyMemory.run,last.result.win);
  }catch(e){
   const technical=/page\.(goto|evaluate)|browser has been closed|Target page|Call log|replay\.invalid/i.test(e.message);
   resultsPanel(technical?'The results service could not finish yet. Your matches are saved. Please try again.':e.message);
  }finally{clearTimeout(slow);submitting=false}
 }
 start=async function(){
  if(!window.vendettaOnlineConfig?.enabled)return startLocal();if(starting)return;
  if(!window.vendettaOnline){storyPanel('<h2>CONNECT AGW TO PLAY ONLINE</h2><div id="storyWalletSlot"></div><button class="secondary" id="onlineStartBack">BACK</button>');$('onlineStartBack').onclick=storyHome;return}
  starting=true;
  try{
   const r=storyMemory.run,service=window.vendettaOnline;
   const queue=r.serverId?await loadPending(service.wallet,r.serverId):[];
   const latest=queue.at(-1);
   if(queue.some(x=>!x.ticket.deferred)||latest?.nextRun?.closed){pendingRun=latest.ticket.serverRunId;resultsPanel('Your story results are saved. Load them to continue.');return}
   if(latest?.nextRun&&(r.onlineAttempt??0)<latest.nextRun.onlineAttempt){storyMemory.run=latest.nextRun;storySave();storyIntro();return}
   const entry=$('storyPlay'),session=await service.prepareMatch(r);storySave();
   if(storyMemory.run!==r||!entry?.isConnected||state!=='story')return;
   if(!session.ticket.deferred&&(session.run.stage!==r.stage||session.run.lives!==r.lives)){r.stage=session.run.stage;r.lives=session.run.lives;r.earned=session.run.earned;storySave();storyIntro();return}
   vendettaReplay.record(session.ticket);startLocal();
  }catch(e){storyPanel('<h2>COULD NOT START ONLINE MATCH</h2><p id="onlineStartError"></p><div id="storyWalletSlot"></div><button class="secondary" id="onlineStartBack">BACK</button>');$('onlineStartError').textContent=e.message;$('onlineStartBack').onclick=storyHome}finally{starting=false}
 };
 window.addEventListener('vendetta-replay-complete',async e=>{
  if(!e.detail.ticket.serverRunId)return;
  const {ticket,proof}=e.detail,localRun=structuredClone(storyMemory.run);
  const saved={key:ticket.wallet.toLowerCase()+':'+ticket.id,wallet:ticket.wallet,ticket,proof,localRun};
  state='verifying';silenceCourtSounds();
  try{
   if(ticket.deferred){
    const next=structuredClone(localRun);if(proof.win){next.earned+=[50,100,150,200,500][next.stage];next.stage++}else next.lives--;
    next.closed=next.stage===5||next.lives===0;next.onlineAttempt=ticket.attempt+1;next.resultsPending=true;saved.nextRun=next;
   }
   await savePending(saved);pendingRun=ticket.serverRunId;
   if(saved.nextRun){storyMemory.run=saved.nextRun;storySave();vendettaReplay.stop();storyActive=false;G=null;if(!saved.nextRun.closed){outcome(saved.nextRun,proof.win);return}}
   await submit();
  }catch(error){resultsPanel('Unable to save this match: '+error.message)}
 });
 window.addEventListener('vendetta-replay-limit',()=>{vendettaReplay.stop();storyPanel('<h2>MATCH TIME LIMIT</h2><p>This match exceeded 25 minutes of active play. You can restart this match.</p><button class="primary" id="onlineLimitBack">BACK TO STORY</button>');$('onlineLimitBack').onclick=storyHome});
 const localRewards=rewardsPanel183;
 rewardsPanel183=function(){
  if(!window.vendettaOnlineConfig?.enabled)return localRewards();
  storyPanel('<div class="eyebrow">STORY REWARDS</div><h1>YOUR REWARDS</h1><div id="storyWalletSlot"></div><p id="verifiedRewardStatus">Finish your story or use your three lives to collect your results.</p><div class="row"><button class="primary" id="loadVerifiedRewards">CHECK REWARDS</button><button class="secondary" id="ecoBack">BACK TO STORY</button></div>');$('ecoBack').onclick=storyHome;
  $('loadVerifiedRewards').onclick=async()=>{try{
   if(!window.vendettaOnline)throw Error('Connect AGW first.');
   const queue=await loadPending(window.vendettaOnline.wallet);
   const ready=queue.find(x=>!x.ticket.deferred||x.nextRun?.closed);
   if(ready){pendingRun=ready.ticket.serverRunId;await submit();return}
   const {run,pendingRuns=[]}=await window.vendettaOnline.status();
   if(pendingRuns.length){$('verifiedRewardStatus').textContent='Your rewards are ready:';$('loadVerifiedRewards').hidden=true;for(const item of pendingRuns){const button=document.createElement('button');button.className='primary';button.textContent='CLAIM '+item.earned+' POINTS';button.onclick=()=>window.dispatchEvent(new CustomEvent('vendetta-claim',{detail:{runId:item.id}}));$('verifiedRewardStatus').after(button)}return}
   $('verifiedRewardStatus').textContent=run?(run.claimed?'Rewards already claimed.':run.closed?run.earned+' points earned.':'Your current story is still in progress.'):'No completed story yet.';
   if(run?.closed&&!run.claimed&&run.earned>0){$('loadVerifiedRewards').textContent='CLAIM '+run.earned+' POINTS';$('loadVerifiedRewards').onclick=()=>window.dispatchEvent(new CustomEvent('vendetta-claim',{detail:{runId:run.id}}))}
  }catch(e){const status=$('verifiedRewardStatus');if(status)status.textContent=e.message}};
 };
})();
