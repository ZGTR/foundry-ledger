// Usage: node packages/shape-actors/scripts/perf/stage-parity.mjs --before <demo-dist> --after <demo-dist> [--no-cast] [--out dir]
//
// Pixel parity of two builds of the web stage: screenshots of three worlds at three scroll
// positions, compared pixel by pixel. --no-cast hides everything that animates (objects,
// shadows, ambience, particles, nav), so the static world must be IDENTICAL; with the cast,
// compare against a before-vs-before run (animation timing differs between runs).
// Exit 1 if --no-cast and any pixel differs.
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DIST = { before: path.resolve(arg('--before')), after: path.resolve(arg('--after')) };
const OUT = arg('--out');
const b = await chromium.launch(process.env.SHAPE_ACTORS_CHROMIUM ? { executablePath: process.env.SHAPE_ACTORS_CHROMIUM } : {});
const shots = {};
const hideCast = process.argv.includes('--no-cast');
for (const v of ['before', 'after']) for (const theme of ['playground', 'market', 'zoo']) {
  const dist = DIST[v];
  const s = http.createServer((q, r) => { const p = new URL(q.url, 'http://x').pathname; const f = path.join(dist, p === '/' ? 'index.html' : p); if (!fs.existsSync(f)) return r.writeHead(404).end(); r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(0);
  await new Promise((r) => s.once('listening', r));
  const p = await b.newPage({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 1 });
  await p.addInitScript((c) => { window.__SHAPE_ACTORS_CONFIG__ = c; }, { view: 'stage', scene: { theme, sound: false, speak: false, height: 640 } });
  await p.goto(`http://localhost:${s.address().port}/`); await p.waitForSelector('body[data-ready="true"]');
  await p.addStyleTag({ content: 'header,#tabs,nav,[data-testid="controls"]{display:none!important} main{padding:0!important} body{margin:0} [data-layer=zone-nav]{display:none!important} canvas{display:none!important}' + (hideCast ? '[data-layer=cast],[data-layer=shadows],[data-layer=hover-rings],[data-layer=doors],[data-layer^=ambience],[data-layer=focus-wash],[data-layer=word-card-svg]{display:none!important}' : '') });
  for (const frac of [0, 0.4, 0.8]) {
    await p.evaluate((fr) => { scrollTo(0, 0); const h = document.querySelector('[data-testid="shape-actor-stage"]').parentElement; h.scrollLeft = (h.scrollWidth - h.clientWidth) * fr; }, frac);
    await p.waitForTimeout(1500);
    const host = await p.$('[data-testid="shape-actor-stage"] >> xpath=..');
    shots[`${theme}-${frac}-${v}`] = await host.screenshot();
  }
  await p.close(); s.close();
}
// compare in a page
const pg = await b.newPage();
const out = [];
for (const theme of ['playground', 'market', 'zoo']) for (const frac of [0, 0.4, 0.8]) {
  const A = shots[`${theme}-${frac}-before`].toString('base64'), B = shots[`${theme}-${frac}-after`].toString('base64');
  out.push([theme, frac, await pg.evaluate(async ([a, c]) => {
    const load = (d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + d; });
    const [ia, ib] = await Promise.all([load(a), load(c)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] };
    const cv = document.createElement('canvas'); cv.width = ia.width; cv.height = ia.height; const g = cv.getContext('2d');
    g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, cv.width, cv.height).data; g.clearRect(0, 0, cv.width, cv.height); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, cv.width, cv.height).data;
    let diff = 0, big = 0; for (let i = 0; i < da.length; i += 4) { const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])); if (d) diff++; if (d > 8) big++; }
    return { px: da.length / 4, diff, big };
  }, [A, B])]);
}
for (const o of out) console.log(JSON.stringify(o));
if (OUT) { fs.mkdirSync(OUT, { recursive: true }); for (const [k, v] of Object.entries(shots)) fs.writeFileSync(path.join(OUT, `${k}${hideCast ? '-nocast' : ''}.png`), v); }
await b.close();
if (hideCast && out.some(([, , r]) => r.diff || r.size)) process.exitCode = 1;
