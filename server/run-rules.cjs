const rewards=[50,100,150,200,500];
function applyResult(run,match,result){if(run.closed||!run.match||run.match.id!==match.id||run.match.stage!==run.stage)throw Error('Stale or consumed match');if(!result.complete||typeof result.win!=='boolean')throw Error('Unverified result');const next=structuredClone(run);if(result.win){next.earned+=rewards[next.stage];next.stage++}else next.lives--;next.closed=next.stage===5||next.lives===0;next.match=null;next.revision++;return next}
module.exports={applyResult,rewards};
