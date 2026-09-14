/* Shared input replay adapter. The verifier loads this exact engine, never client code. */
(()=>{
 const raw={start,step,beginShot,endShot,clearInput,direction,finish,useDevice,movementDirection};
 let session=null,inside=false,replaying=false,rng=1,events=[],frames=[],tick=0,result=null,vector={x:0,y:0};
 const random=()=>{rng=(rng+0x6D2B79F5)|0;let t=Math.imul(rng^rng>>>15,1|rng);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296};
 function scope(fn){const previous=Math.random;Math.random=random;inside=true;try{return fn()}finally{Math.random=previous;inside=false}}
 const cleanVector=v=>({x:Math.round(Math.max(-1,Math.min(1,v.x))*1000)/1000,y:Math.round(Math.max(-1,Math.min(1,v.y))*1000)/1000});
 function apply(frame,restoreInput=false){vector={x:frame[0]/1000,y:frame[1]/1000};if(restoreInput){keys.clear();stick.x=vector.x;stick.y=vector.y;inputDevice='keyboard';padAxis={x:0,y:0}}for(const e of frame[2]){if(e[0]===0)raw.beginShot(e[1]===1?'lob':'normal',e[2]);else if(e[0]===1)raw.endShot(e[2]);else raw.clearInput()}}
 movementDirection=function(){if(!session||!inside)return raw.movementDirection();if(G.p.moveNeedsNeutral){if(Math.hypot(vector.x,vector.y)<=.12)G.p.moveNeedsNeutral=false;return{x:0,y:0}}if(G.p.recovery>0)return{x:0,y:0};return{...vector}};
 direction=function(){return session&&inside?{...vector}:raw.direction()};
 beginShot=function(kind,token){if(session&&!inside){if(state==='play'&&events.length<32)events.push([0,kind==='lob'?1:0,String(token).slice(0,64)]);return}return raw.beginShot(kind,token)};
 endShot=function(token){if(session&&!inside){if(events.length<32)events.push([1,0,String(token).slice(0,64)]);return}return raw.endShot(token)};
 clearInput=function(){if(session&&!inside&&state==='play'&&events.length<32)events.push([2,0,'']);return raw.clearInput()};
 useDevice=function(type){if(session&&!inside&&type!==inputDevice&&events.length<32)events.push([2,0,'']);return raw.useDevice(type)};
 step=function(dt){if(!session)return raw.step(dt);if(result!==null)return;if(tick>=180000){window.dispatchEvent(new Event('vendetta-replay-limit'));return}const v=cleanVector(raw.direction()),f=[Math.round(v.x*1000),Math.round(v.y*1000),events.splice(0)];frames.push(f);tick++;scope(()=>{apply(f);raw.step(DT)})};
 finish=function(win){if(session){result=!!win;const proof={version:1,ticks:tick,frames,win:result};window.dispatchEvent(new CustomEvent('vendetta-replay-complete',{detail:{ticket:session,proof}}));if(replaying||session.serverRunId)return}return raw.finish(win)};
 function initialize(ticket){if(!ticket||!Number.isInteger(ticket.seed)||ticket.seed<1||!Number.isInteger(ticket.stage)||ticket.stage<0||ticket.stage>4||!['penguin','moody','sauciii','luca','spartano'].includes(ticket.character))throw Error('Invalid match ticket');session=ticket;rng=ticket.seed;events=[];frames=[];tick=0;result=null;vector={x:0,y:0};}
 window.vendettaReplay={
  record(ticket){initialize(ticket)},stop(){session=null;events=[]},
  playback(ticket,proof){if(!Array.isArray(proof.frames)||proof.frames.length<1||proof.frames.length>180000)throw Error('Invalid replay length');initialize(ticket);replaying=true;padPolling=false;storyMemory.run={stage:ticket.stage,lives:3,earned:0,character:ticket.character,closed:false};storyActive=true;selectedCharacter=ticket.character;selectedRival=storyStages[ticket.stage].rival;selectedStadium=storyStages[ticket.stage].arena;mode='normal';state='replayInit';scope(()=>raw.start());clearTimeout(cinemaRevealTimer);closePanel();state='play';muted=true;
   for(const f of proof.frames){if(result!==null)throw Error('Replay continued after result');if(!Array.isArray(f)||f.length!==3||!Number.isInteger(f[0])||!Number.isInteger(f[1])||Math.abs(f[0])>1000||Math.abs(f[1])>1000||f[0]*f[0]+f[1]*f[1]>1001500||!Array.isArray(f[2])||f[2].length>32)throw Error('Invalid input');for(const e of f[2])if(!Array.isArray(e)||e.length!==3||![0,1,2].includes(e[0])||![0,1].includes(e[1])||typeof e[2]!=='string'||e[2].length>64)throw Error('Invalid action');tick++;scope(()=>{apply(f,true);raw.step(DT)})}
   const answer={complete:result!==null,win:result,ticks:tick};session=null;replaying=false;return answer;
  },snapshot(){return{ticket:session,tick,result,rng}},
 };
 // Start consumes the server seed before any gameplay random values.
 start=function(){if(!session)return raw.start();return scope(()=>raw.start())};
})();
