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
 const rewardStyle=document.createElement('style');rewardStyle.textContent=`
 .vc-balance{position:relative;display:flex;align-items:center;gap:18px;padding:22px 26px;margin:22px 0;border:1px solid #9871c5;border-left:4px solid #c2ff45;border-radius:4px 20px 4px 20px;background:radial-gradient(ellipse at 100% 0,#7344a53b,transparent 65%),linear-gradient(115deg,#1d2623,#171222);box-shadow:0 12px 36px #0005;overflow:hidden}
 .vc-coin{display:grid;place-items:center;flex-shrink:0;width:58px;height:58px;border:2px solid #c2ff45;border-radius:50%;box-shadow:inset 0 0 0 5px #263927,0 0 24px #c2ff4519;color:#c2ff45;font-size:27px;font-weight:900;transform:rotate(-12deg)}
 .vc-balance-copy{flex:1}.vc-kicker{display:block;font-size:10px;font-weight:800;letter-spacing:2px;color:#c3acd9;text-transform:uppercase}.vc-amount{display:block;font-family:Impact,'Arial Narrow',sans-serif;font-size:clamp(38px,5vw,58px);line-height:1.15;letter-spacing:1px;color:#c2ff45;text-shadow:0 2px 0 #071406}.vc-amount small{font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;color:#d6c6e5;margin-left:10px}.vc-balance-note{margin:5px 0 0!important;font-size:12px!important;color:#c6b8d2!important}.vc-balance-tag{align-self:flex-start;padding:7px 10px;border:1px solid #5c6c48;border-radius:4px;color:#c2ff45;font-size:9px;letter-spacing:1.5px;font-weight:800}
 .vc-reward-state{padding:24px;margin:20px 0;border:1px solid #63477e;border-radius:12px;background:linear-gradient(130deg,#23182f,#141a24);min-height:130px}.vc-reward-state[data-state=ready]{border-color:#b1e848;background:linear-gradient(130deg,#263022,#191725)}.vc-reward-state h2{font-family:Impact,'Arial Narrow',sans-serif!important;font-size:clamp(26px,4vw,40px)!important;letter-spacing:1px!important;margin:10px 0!important;color:#f3eaff}.vc-reward-state p{max-width:650px;color:#cdbfdc;line-height:1.6;font-size:14px}.vc-reward-state[data-state=ready] h2{color:#c2ff45}.vc-reward-list{display:grid;gap:12px;margin-top:18px}.vc-reward-item{display:flex;justify-content:space-between;align-items:center;gap:18px;border:1px solid #806a96;border-radius:8px;padding:18px;background:#0d131ec4}.vc-reward-item strong{display:block;font:32px Impact,'Arial Narrow',sans-serif;color:#c2ff45}.vc-reward-item small{display:block;margin-top:5px;color:#c6b6d5;font-size:12px}.vc-reward-item button{flex-shrink:0}.vc-reward-state progress{width:min(320px,100%);height:6px;accent-color:#c2ff45}.vc-reward-footer{font-size:12px!important;color:#a998bc!important}.vc-balance~.story-stats:empty{display:none}
 @media(min-width:1000px){.story-panel:has(>#ecoContinue) .vc-balance{max-width:500px}}
 @media(max-width:600px){.vc-balance{padding:18px 16px;gap:12px}.vc-coin{width:42px;height:42px;font-size:21px}.vc-balance-tag{display:none}.vc-reward-item{align-items:stretch;flex-direction:column}.vc-reward-state{padding:18px}}
 `;document.head.append(rewardStyle);
 const number=value=>{try{return BigInt(value).toLocaleString('en-US')}catch{return '—'}};
 function balanceCard(){return '<div class="vc-balance"><div class="vc-coin" aria-hidden="true">V</div><div class="vc-balance-copy"><span class="vc-kicker">Your Vendetta balance</span><strong class="vc-amount" data-vc-points>—</strong><p class="vc-balance-note" data-vc-balance-note></p></div><span class="vc-balance-tag" data-vc-balance-tag>ABSTRACT</span></div>'}
 function updateBalance(){const w=window.vendettaWallet;document.querySelectorAll('[data-vc-points]').forEach(el=>{el.textContent=w?.ready?number(w.points):'—';const unit=document.createElement('small');unit.textContent='POINTS';el.append(unit)});document.querySelectorAll('[data-vc-balance-note]').forEach(el=>el.textContent=!w?.address?'Connect your wallet to view your balance.':w.ready?'In your wallet · Spend points to unlock champions.':'Reading your wallet balance…');document.querySelectorAll('[data-vc-balance-tag]').forEach(el=>el.textContent=w?.ready?'ON-CHAIN':'ABSTRACT')}
 const rewardsHome=storyHome;
 storyHome=function(){rewardsHome();const stats=document.querySelector('.story-panel>.story-stats');if(stats){const old=[...stats.children].find(el=>el.textContent.includes('ON-CHAIN POINTS')||el.textContent.includes('LOCAL PREVIEW POINTS'));old?.remove();stats.insertAdjacentHTML('beforebegin',balanceCard());updateBalance()}};
 window.addEventListener('vendetta-economy',()=>{if(document.querySelector('.story-panel #ecoRewards'))storyHome();else if(document.getElementById('vcRewardsState'))rewardsPanel183()});
 const localRewards=rewardsPanel183;
 let rewardsRefresh=null;
 window.addEventListener('vendetta-wallet',e=>{updateBalance();if(document.getElementById('vcRewardsState'))rewardsRefresh?.(e.detail?.ready||!e.detail?.address)});
 rewardsPanel183=function(){
  if(!window.vendettaOnlineConfig?.enabled){
   localRewards();const root=document.querySelector('.story-panel');if(root){root.querySelector('.eyebrow').textContent='REWARDS · LOCAL TEST';const stats=root.querySelector('.story-stats');if(stats){stats.insertAdjacentHTML('beforebegin',balanceCard());stats.remove()}const title=document.createElement('div');title.className='vc-reward-state';title.innerHTML='<span class="vc-kicker">Local preview only</span><h2>'+(pending183()?'TEST REWARDS AVAILABLE':'NO TEST REWARDS YET')+'</h2><p>This local server is for testing gameplay. Test rewards are separate from your wallet and cannot be claimed on-chain here.</p>';root.querySelector('.vc-balance').after(title);updateBalance()}return;
  }
  storyPanel('<div class="eyebrow">THE REWARD VAULT</div><h1>YOUR REWARDS</h1>'+balanceCard()+'<div class="vc-reward-state" id="vcRewardsState" aria-live="polite"><span class="vc-kicker" id="vcRewardKicker"></span><h2 id="vcRewardTitle"></h2><p id="verifiedRewardStatus"></p><div id="vcRewardList" class="vc-reward-list"></div></div><div class="row"><button class="primary" id="loadVerifiedRewards">CHECK REWARDS</button><button class="secondary" id="ecoBack">BACK TO STORY</button></div><p class="vc-reward-footer">Earned points enter your wallet after a successful claim. Claim fee: approximately $0.01 in ETH, plus the network fee.</p><div id="storyWalletSlot"></div>');
  updateBalance();$('ecoBack').onclick=storyHome;
  const root=$('vcRewardsState'),button=$('loadVerifiedRewards');let request=0,busy=false,readyRun=null;
  function show(kind,kicker,title,message){root.dataset.state=kind;$('vcRewardKicker').textContent=kicker;$('vcRewardTitle').textContent=title;$('verifiedRewardStatus').textContent=message;$('vcRewardList').replaceChildren()}
  async function refresh(force=false){
   if(!root.isConnected||busy&&!force)return;
   const version=++request,service=window.vendettaOnline,wallet=window.vendettaWallet?.address;busy=true;readyRun=null;button.disabled=true;button.textContent='CHECKING…';
   const current=()=>root.isConnected&&version===request&&window.vendettaOnline===service&&window.vendettaWallet?.address===wallet;
   try{
    if(!service||!wallet){show('empty','Wallet required','CONNECT TO VIEW REWARDS','Connect your AGW below to check rewards linked to your wallet.');return}
    show('loading','Checking your rewards','LOADING YOUR REWARDS…','Checking saved results and unclaimed rewards. Please wait.');const progress=document.createElement('progress');progress.setAttribute('aria-label','Checking rewards');$('vcRewardList').append(progress);
    const queue=await loadPending(service.wallet);if(!current())return;
    const ready=queue.find(x=>!x.ticket.deferred||x.nextRun?.closed);
    if(ready){readyRun=ready.ticket.serverRunId;show('pending','Results saved on this device','RESULTS NEED VERIFICATION','Your story has ended. Load your saved results to confirm your earned points before claiming.');return}
    const {run,pendingRuns=[]}=await service.status();if(!current())return;
    const rewards=[...new Map(pendingRuns.filter(r=>r.earned>0&&!r.claimed).map(r=>[r.id,r])).values()];
    if(!rewards.length&&run?.closed&&!run.claimed&&run.earned>0)rewards.push(run);
    if(rewards.length){const total=rewards.reduce((sum,r)=>sum+BigInt(r.earned),0n);show('ready','Ready to claim',number(total)+' POINTS WAITING',rewards.length===1?'Your results are confirmed. Claim these points to add them to your wallet.':rewards.length+' separate story runs are ready. Each run has its own claim.');for(const item of rewards){const card=document.createElement('div');card.className='vc-reward-item';const copy=document.createElement('div'),amount=document.createElement('strong'),detail=document.createElement('small'),claim=document.createElement('button');amount.textContent=number(item.earned)+' POINTS';detail.textContent=(item.stage===5?'Story complete':'Run ended')+' · '+item.stage+'/5 rivals defeated · Run '+item.id.slice(-6).toUpperCase();copy.append(amount,detail);claim.className='primary';claim.textContent='CLAIM '+number(item.earned)+' POINTS';claim.onclick=()=>window.dispatchEvent(new CustomEvent('vendetta-claim',{detail:{runId:item.id}}));card.append(copy,claim);$('vcRewardList').append(card)}return}
    if(run?.claimed)show('claimed','Rewards collected','ALL CLAIMED','Your completed story rewards have already been added to your wallet. There is nothing left to claim.');
    else if(run&&!run.closed)show('progress','Story in progress','FINISH YOUR RUN',number(run.earned||0)+' points confirmed so far. Complete the story or use all three lives, then load your results to claim.');
    else show('empty','No pending rewards','NOTHING TO CLAIM YET',run?.closed?'This run ended without reward points. Defeat a rival in your next story to earn points.':'Play Story Mode and defeat rivals to earn points. Rewards become available when your run ends.');
   }catch(e){if(current())show('error','Could not check rewards','TRY AGAIN','Your balance has not been reset. '+e.message)}
   finally{if(root.isConnected&&version===request){busy=false;button.disabled=false;button.textContent=readyRun?'LOAD RESULTS':'REFRESH REWARDS'}}
  }
  button.onclick=()=>{if(readyRun){pendingRun=readyRun;submit()}else refresh()};
  rewardsRefresh=force=>{if(force)refresh(true)};
  refresh();
 };
})();

// Presentation-only fixes: keep the recorded match engine unchanged.
(()=>{
 const drawOriginal=drawSauciii;
 drawSauciii=function(a,player){
  const id=sauciiiPose(a);
  if(id<4||id>7||a.mx>=-.15)return drawOriginal(a,player);
  const v=sauciiiView(a,player);if(!v.image)return;
  const q=project(a.x,a.y),unit=q.f*.88,u=unit*SAUCIII_SCALE*sauciiiPoseScale(v,id);
  c.save();c.translate(q.x,q.y);c.fillStyle='#07192355';c.beginPath();c.ellipse(a.emergencyT>0?sauciiiBodyMotion(a).x*unit:0,3,24*unit,5*unit,0,0,Math.PI*2);c.fill();
  const motion=sauciiiBodyMotion(a);c.translate(motion.x*unit,motion.y*unit);c.rotate(motion.angle);
  c.scale(-u,u);c.drawImage(v.image,id%4*512,Math.floor(id/4)*512,512,512,-256,-440,512,512);c.restore();
 };
 const css=document.createElement('style');css.textContent=`
 body.epic-home #staticMenuBackground{display:none!important}
 body.epic-home #overlay{background:#160d26!important}
 body.epic-home #overlay::before{content:none!important;background:none!important}
 body.epic-home .epic-art{mask-image:none!important}
 body.epic-home #overlay>.card{width:100vw!important;height:100dvh!important;max-height:none!important;display:grid;place-items:center;padding:0!important;overflow:hidden!important}
 body.epic-home .epic-stage{margin:0;width:max(100vw,calc(100dvh * 1916 / 821));height:auto;aspect-ratio:1916/821;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
 body.epic-home.home-art-loading .epic-stage{visibility:hidden}
 body.epic-home.home-art-loading #overlay::before{background-image:none}
 body.epic-home.home-art-loading #overlay::after{content:'LOADING VENDETTA COURT…';position:fixed;inset:0;display:grid;place-items:center;pointer-events:none;color:#c2ff45;font:700 12px Arial,sans-serif;letter-spacing:3px}
 body.epic-home .epic-stage,body.epic-home .epic-art{animation:none!important;transition:none!important}
 `;document.head.append(css);
 const fullMenuImage='/vendettacourt/assets/16d6bfe021463d85c374.jpg';
 const fullStyle=document.createElement('style');fullStyle.textContent=`
 #epicStory{left:14.2%;top:49.5%;width:26.5%;height:13.2%}
 #epicPvp{left:15.6%;top:63.7%;width:23.5%;height:11.1%}
 #epicTournament{left:15.6%;top:75%;width:23.5%;height:11.4%}
 #epicOptions{left:15.5%;top:91%;width:5.8%;height:5%}
 #epicCredits{left:23%;top:91%;width:5.8%;height:5%}
 .epic-world-link{position:absolute;left:78.8%;top:93.4%;width:6%;height:3.9%;display:grid;place-items:center;background:#171027;color:#c2ff45;border:1px solid #9c76b7;border-radius:4px;font:10px Arial;text-decoration:none;z-index:2}
 body.epic-home #backMoodyworld{display:none}
 @media(max-aspect-ratio:3/2){body.epic-home .epic-stage{left:calc(-1 * 100dvh * 250 / 821);transform:translateY(-50%)}}
 `;document.head.append(fullStyle);
 function applyFullMenu(){const art=document.querySelector('.epic-art');if(!art)return;art.src=fullMenuImage;if(!art.parentElement.querySelector('.epic-world-link')){const link=document.createElement('a');link.href='/';link.textContent='MOODYWORLD';link.className='epic-world-link';art.parentElement.append(link)}}
 const previousMenu=menu;menu=function(){previousMenu();applyFullMenu()};applyFullMenu();
 const current=document.querySelector('.epic-art');
 if(!current?.complete||!current.naturalWidth)document.body.classList.add('home-art-loading');
 const load=src=>new Promise(resolve=>{const im=new Image();im.onload=()=>im.decode().catch(()=>{}).then(resolve);im.onerror=resolve;im.src=src});
 Promise.all([load(fullMenuImage)]).then(()=>document.body.classList.remove('home-art-loading'));
})();
