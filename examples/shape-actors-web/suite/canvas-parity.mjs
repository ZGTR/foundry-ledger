// Usage: node packages/shape-actors/scripts/perf/canvas-parity.mjs [--dist demo-dist] [--themes a,b] [--out dir] [--dpr 2]
//
// Pixel parity of the web stage's two renderers on the SAME frozen scene: the demo stage mounts
// in svg mode, its controller is frozen, and a CanvasStage draws the same controller; the stage
// is then screenshotted as svg (canvas hidden) and as canvas (the svg drawings hidden, as canvas
// mode does). Three scroll positions per world. Reports the share of pixels that differ by more
// than 24/255 and writes svg / canvas / diff images with --out.
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', path.join(PKG, 'demo-dist')));
if (!arg('--dist')) execFileSync('node', ['scripts/build-demo.mjs', '--minify'], { cwd: PKG, stdio: 'ignore' });
const themes = arg('--themes', 'playground,market,zoo').split(',');
const out = arg('--out');
const dpr = Number(arg('--dpr', '2'));
if (out) fs.mkdirSync(out, { recursive: true });
const server = http.createServer((q, r) => { const p = new URL(q.url, 'http://x').pathname; const f = path.join(dist, p === '/' ? 'index.html' : path.normalize(p)); if (!f.startsWith(dist) || !fs.existsSync(f)) { r.writeHead(404).end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(0);
await new Promise((r) => server.once('listening', r));
const browser = await chromium.launch(process.env.SHAPE_ACTORS_CHROMIUM ? { executablePath: process.env.SHAPE_ACTORS_CHROMIUM } : {});
const rows = [];
try {
  for (const theme of themes) for (const frac of [0, 0.4, 0.8]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 700 }, deviceScaleFactor: dpr });
    await page.addInitScript(([c]) => { window.__SHAPE_ACTORS_CONFIG__ = c; window.__SHAPE_ACTORS_RENDERER__ = 'svg'; }, [{ view: 'stage', scene: { theme, sound: false, speak: false, height: 640 } }]);
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.waitForSelector('body[data-ready="true"]');
    await page.addStyleTag({ content: 'header,#tabs,nav,[data-testid="controls"]{display:none!important} main{padding:0!important} body{margin:0} [data-layer=zone-nav]{display:none!important}' });
    await page.evaluate((fr) => { scrollTo(0, 0); const h = document.querySelector('[data-testid="shape-actor-stage"]').parentElement; h.scrollLeft = (h.scrollWidth - h.clientWidth) * fr; }, frac);
    await page.waitForTimeout(1500);
    // Full quality before freezing: at quality 2+ svg mode redraws idle objects on alternate frames,
    // so its last frame can lag the controller (the canvas always draws the current state).
    await page.waitForFunction(() => (document.querySelector('[data-testid="shape-actor-stage"]').getAttribute('data-quality') ?? '0') === '0', null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => new Promise((done) => {
      const handle = window.shapeActors.stage(); const c = handle.controller;
      c.freeze();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const svg = document.querySelector('[data-testid="shape-actor-stage"]'); const host = svg.parentElement;
        const sr = svg.getBoundingClientRect(), hr = host.getBoundingClientRect(); const m = svg.getScreenCTM();
        const cs = window.shapeActors.CanvasStage.create(host, svg, c);
        const frame = { x: sr.left - hr.left - host.clientLeft + host.scrollLeft, y: sr.top - hr.top - host.clientTop + host.scrollTop, w: sr.width, h: sr.height, view: host.clientWidth, left: host.scrollLeft, quality: Number(svg.getAttribute('data-quality') ?? 0), k: m.a, ox: m.e - sr.left, oy: m.f - sr.top };
        cs.draw(frame, '');
        window.__cs = cs; done();
      }));
    }));
    const shot = async (mode) => {
      await page.evaluate((md) => {
        const svgs = document.querySelectorAll('svg[data-testid="shape-actor-stage"], svg[data-layer="word-card-svg"]');
        for (const s of svgs) { if (md === 'canvas') s.setAttribute('data-renderer', 'canvas'); else s.removeAttribute('data-renderer'); }
        window.__cs.canvas.style.visibility = md === 'canvas' ? 'visible' : 'hidden';
        document.querySelector('[data-layer="particle-canvas"]')?.style.setProperty('visibility', 'hidden');
      }, mode);
      const host = await page.$('[data-testid="shape-actor-stage"] >> xpath=..');
      return host.screenshot();
    };
    const a = await shot('svg'), b = await shot('canvas');
    const res = await page.evaluate(async ([pa, pb]) => {
      const load = (d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + d; });
      const [ia, ib] = await Promise.all([load(pa), load(pb)]);
      const cv = document.createElement('canvas'); cv.width = ia.width; cv.height = ia.height; const g = cv.getContext('2d');
      g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, cv.width, cv.height).data; g.clearRect(0, 0, cv.width, cv.height); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, cv.width, cv.height).data;
      const o = g.createImageData(cv.width, cv.height); let big = 0, any = 0;
      for (let i = 0; i < da.length; i += 4) { const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])); if (d) any++; if (d > 24) big++; const v = Math.min(255, d * 6); o.data[i] = d > 24 ? 255 : v; o.data[i + 1] = d > 24 ? 0 : v; o.data[i + 2] = d > 24 ? 0 : v; o.data[i + 3] = 255; }
      g.putImageData(o, 0, 0);
      return { px: da.length / 4, any, big, diff: cv.toDataURL() };
    }, [a.toString('base64'), b.toString('base64')]);
    const row = { theme, frac, pxDifferPct: +((100 * res.any) / res.px).toFixed(2), pxOver24Pct: +((100 * res.big) / res.px).toFixed(3) };
    rows.push(row); console.log(JSON.stringify(row));
    if (out) {
      const name = `${theme}-${frac}`;
      fs.writeFileSync(path.join(out, `${name}-svg.png`), a); fs.writeFileSync(path.join(out, `${name}-canvas.png`), b);
      fs.writeFileSync(path.join(out, `${name}-diff.png`), Buffer.from(res.diff.split(',')[1], 'base64'));
    }
    await page.close();
  }
} finally { await browser.close(); server.close(); }
if (out) fs.writeFileSync(path.join(out, 'parity.json'), JSON.stringify(rows, null, 1));
