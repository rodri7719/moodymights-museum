const fs = require('node:fs/promises');
const path = require('node:path');
const { config } = require('./config.cjs');
let active = false, cached = null;
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
async function closeVerifier() {
  const old = cached; cached = null;
  try { await old?.browser.close(); } catch {}
}
async function engine() {
  const c = config();
  if (cached?.version === c.engineVersion && cached.browser.isConnected() && !cached.page.isClosed()) return cached.page;
  await closeVerifier();
  const { chromium } = require('playwright-core'), binary = require('@sparticuz/chromium');
  const browser = await chromium.launch({ args: binary.args, executablePath: process.env.VENDETTA_CHROME_PATH || await binary.executablePath(), headless: true });
  try {
    const html = await fs.readFile(path.join(c.gameRoot, 'index.html'), 'utf8');
    // Scenery is visual only. Character loading hooks retain all contact metadata.
    const scenery = new Set([...html.matchAll(/(?:spaceArt|iceArt|crowdAtlas|rooftopArt|olympusArt|olympusCrowdAtlas|neonArt|fightArt|championArt)\.src=['"]([^'"]+)['"]/g)].map(m => m[1]));
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(80000);
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.route('**/*', async route => {
      try {
        const url = new URL(route.request().url());
        if (url.origin !== 'https://replay.invalid') return await route.abort();
        if (scenery.has(url.pathname)) return await route.fulfill({ body: pixel, contentType: 'image/png' });
        const target = path.resolve(c.gameRoot, '.' + decodeURIComponent(url.pathname.replace(/^\/vendettacourt/, '')));
        if (!target.startsWith(c.gameRoot + path.sep) && target !== c.gameRoot) return await route.abort();
        if (target.endsWith(path.sep + 'online-story.js') || target.includes(path.sep + 'wallet' + path.sep)) return await route.abort();
        const filename = target === c.gameRoot || target.endsWith(path.sep) ? path.join(target, 'index.html') : target;
        let body = await fs.readFile(filename);
        if (filename.endsWith('index.html')) body = Buffer.from(body.toString()
          .replace(/<script[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g, '')
          .replace(/<script[^>]*src="\.\/replay.js"[^>]*><\/script>/g, '')
          .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ''));
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.css': 'text/css', '.json': 'application/json' };
        await route.fulfill({ body, contentType: mime[path.extname(filename)] || 'application/octet-stream' });
      } catch { try { await route.abort(); } catch {} }
    });
    await page.goto('https://replay.invalid/vendettacourt/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof storyReady === 'function' && storyReady(), null, { polling: 100 });
    await page.addScriptTag({ content: await fs.readFile(path.join(c.gameRoot, 'replay.js'), 'utf8') });
    cached = { browser, page, version: c.engineVersion };
    return page;
  } catch (error) { try { await browser.close(); } catch {} throw error; }
}
async function verifyMatch(ticket, proof) {
  if (!proof || !Array.isArray(proof.frames) || proof.frames.length < 1 || proof.frames.length > 180000) throw Error('Invalid replay');
  if (active) { const e = Error('The results service is busy. Your match is saved. Please retry shortly.'); e.status = 503; throw e; }
  active = true;
  try {
    // One fresh-browser retry, retaining the exact same server ticket and inputs.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const page = await engine();
        const result = await page.evaluate(({ ticket, proof }) => window.vendettaReplay.playback(ticket, proof), { ticket, proof });
        if (!result.complete) throw Error('The replay does not finish the match');
        return result;
      } catch (error) {
        const temporary = /closed|crash|Target|Timeout|launch|executable|ENOMEM|EAGAIN/i.test(error.message);
        await closeVerifier();
        if (temporary && attempt === 0) continue;
        if (temporary) {
          console.error('Vendetta verifier unavailable', { name: error.name, stage: ticket.stage, attempt: attempt + 1 });
          const e = Error('The results service could not finish yet. Your match is saved. Please retry shortly.'); e.status = 503; throw e;
        }
        throw error;
      }
    }
  } finally { active = false; }
}
module.exports = { verifyMatch, closeVerifier };
