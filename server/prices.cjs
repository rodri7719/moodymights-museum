const {parseUnits}=require('viem');
async function ethUsd(fetcher=fetch){const responses=await Promise.all([
 fetcher('https://api.coinbase.com/v2/prices/ETH-USD/spot',{signal:AbortSignal.timeout(10000),cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Price source unavailable');const {data}=await r.json();if(data?.base!=='ETH'||data.currency!=='USD')throw Error('Invalid Coinbase quote');return data.amount}),
 fetcher('https://api.kraken.com/0/public/Ticker?pair=ETHUSD',{signal:AbortSignal.timeout(10000),cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Price source unavailable');const d=await r.json();if(d.error?.length)throw Error('Invalid Kraken quote');return Object.values(d.result||{})[0]?.c?.[0]})
 ]);const values=responses.map(v=>{if(typeof v!=='string'||!/^\d+(\.\d{1,8})?$/.test(v))throw Error('Invalid price format');const n=parseUnits(v,8);if(n<100000000n||n>100000000000000n)throw Error('Price out of bounds');return n});if((values[0]>values[1]?values[0]-values[1]:values[1]-values[0])*100n>values[0]*3n)throw Error('Price sources disagree. Try again later.');return(values[0]+values[1])/2n}
function weiForUsd(usdE8,ethUsdE8){return(10n**18n*usdE8+ethUsdE8-1n)/ethUsdE8}
module.exports={ethUsd,weiForUsd};
