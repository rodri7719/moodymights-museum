const fs=require('node:fs/promises'),path=require('node:path');
const {config}=require('./config.cjs');
let active=false;
async function verifyMatch(ticket,proof){
 if(!proof||!Array.isArray(proof.frames)||proof.frames.length<1||proof.frames.length>180000)throw Error('Invalid replay');
 if(active)throw Error('Verifier busy. Retry shortly.');active=true;let browser;try{const {chromium}=require('playwright-core'),binary=require('@sparticuz/chromium');
 browser=await chromium.launch({args:binary.args,executablePath:process.env.VENDETTA_CHROME_PATH||await binary.executablePath(),headless:true});
 const c=config(),page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(45000);
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!=='https://replay.invalid')return route.abort();const target=path.resolve(c.gameRoot,'.'+decodeURIComponent(url.pathname.replace(/^\/vendettacourt/,'')));if(!target.startsWith(c.gameRoot+path.sep)&&target!==c.gameRoot)return route.abort();if(target.endsWith(path.sep+'online-story.js')||target.includes(path.sep+'wallet'+path.sep))return route.abort();try{let filename=target===c.gameRoot||target.endsWith(path.sep)?path.join(target,'index.html'):target;let body=await fs.readFile(filename);if(filename.endsWith('index.html'))body=Buffer.from(body.toString().replace(/<script[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/<script[^>]*src="\.\/replay.js"[^>]*><\/script>/g,''));const ext=path.extname(filename),mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.css':'text/css','.json':'application/json'};await route.fulfill({body,contentType:mime[ext]||'application/octet-stream'})}catch{await route.abort()}});
 await page.goto('https://replay.invalid/vendettacourt/');await page.waitForFunction(()=>typeof storyReady==='function'&&storyReady());await page.addScriptTag({content:await fs.readFile(path.join(c.gameRoot,'replay.js'),'utf8')});
 const result=await page.evaluate(({ticket,proof})=>window.vendettaReplay.playback(ticket,proof),{ticket,proof});
 if(!result.complete)throw Error('The replay does not finish the match');return result;
 }finally{try{if(browser)await browser.close()}finally{active=false}}
}
module.exports={verifyMatch};
