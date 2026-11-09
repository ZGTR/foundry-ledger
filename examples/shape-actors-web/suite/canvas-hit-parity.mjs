// Usage: node packages/shape-actors/scripts/perf/canvas-hit-parity.mjs [--dist demo-dist] [--themes a,b] [--step 8]
//
// Does a press land on the same thing in both web renderers? On one frozen svg-mode stage, every
// point of a grid over the view is resolved twice: by the browser's own hit test on the svg
// (elementFromPoint → data-actor / data-part, exactly as the view's input does), and by
// CanvasStage.hit (the canvas drawing replayed as a hit test). Reports agreement on the actor and
// on actor + part, and lists where they differ. Exit 1 if actor agreement is below --min (99.5 %).
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
const themes = arg('--themes', 'playground,market,zoo,kitchen').split(',');
const step = Number(arg('--step', '8'));
const min = Number(arg('--min', '99.5'));
const server = http.createServer((q, r) => { const p = new URL(q.url, 'http://x').pathname; const f = path.join(dist, p === '/' ? 'index.html' : path.normalize(p)); if (!f.startsWith(dist) || !fs.existsSync(f)) { r.writeHead(404).end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(0);
await new Promise((r) => server.once('listening', r));
const browser = await chromium.launch(process.env.SHAPE_ACTORS_CHROMIUM ? { executablePath: process.env.SHAPE_ACTORS_CHROMIUM } : {});
let worst = 100;
try {
  for (const theme of themes) for (const frac of [0, 0.5]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
    await page.addInitScript(([c]) => { window.__SHAPE_ACTORS_CONFIG__ = c; window.__SHAPE_ACTORS_RENDERER__ = 'svg'; }, [{ view: 'stage', scene: { theme, sound: false, speak: false, height: 640 } }]);
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.waitForSelector('body[data-ready="true"]');
    await page.addStyleTag({ content: 'header,#tabs,nav,[data-testid="controls"]{display:none!important} main{padding:0!important} body{margin:0} [data-layer=zone-nav],[data-layer=word-card-svg],[data-layer=particle-canvas],[data-sa-speak],[data-sa-toys]{display:none!important}' });
    await page.evaluate((fr) => { scrollTo(0, 0); const h = document.querySelector('[data-testid="shape-actor-stage"]').parentElement; h.scrollLeft = (h.scrollWidth - h.clientWidth) * fr; }, frac);
    await page.waitForTimeout(1500);
    // Full quality before freezing: at quality 2+ svg mode redraws idle objects on alternate frames,
    // so its last frame can lag the controller (the canvas always draws the current state).
    await page.waitForFunction(() => (document.querySelector('[data-testid="shape-actor-stage"]').getAttribute('data-quality') ?? '0') === '0', null, { timeout: 15000 }).catch(() => {});
    const r = await page.evaluate(([st]) => new Promise((done) => {
      const c = window.shapeActors.stage().controller;
      c.freeze();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const svg = document.querySelector('[data-testid="shape-actor-stage"]'); const host = svg.parentElement;
        const cs = window.shapeActors.CanvasStage.create(host, svg, c);
        cs.canvas.style.display = 'none';
        const sr = svg.getBoundingClientRect(); const m = svg.getScreenCTM();
        const fit = !!c.scene.fit; const k = fit ? sr.width / c.world.width : 1;
        const pad = 64 / (k || 1);
        const domHit = (x, y) => {
          let node = document.elementFromPoint(x, y); let part;
          while (node && node !== svg) {
            if (!part && node.getAttribute('data-part') && node.getAttribute('data-inert') !== 'true') part = node.getAttribute('data-part');
            const actor = node.getAttribute('data-actor') ?? node.getAttribute('data-actor-seg');
            if (actor) return { actor, part };
            node = node.parentElement;
          }
          return {};
        };
        const hr = host.getBoundingClientRect();
        let n = 0, actorSame = 0, bothSame = 0; const diffs = [];
        for (let y = Math.max(hr.top, sr.top) + 2; y < Math.min(hr.bottom, sr.bottom) - 2; y += st) for (let x = hr.left + 2; x < hr.right - 2; x += st) {
          const top = document.elementFromPoint(x, y);
          if (!top || !svg.contains(top)) continue; // a toy button or nav over the stage
          const a = domHit(x, y);
          const wx = (x - m.e) / m.a, wy = (y - m.f) / m.d;
          // The svg's own pad boxes, as canvas mode passes them (SvgStageView padHitArea).
          const b = cs.hit(wx, wy, pad, (id) => {
            const r = svg.querySelector(`[data-actor="${id}"] > rect.sa-hit`);
            if (!r || r.getAttribute('visibility') === 'hidden') return undefined;
            const [px, py, pw, ph] = ['x', 'y', 'width', 'height'].map((a) => Number(r.getAttribute(a)));
            return [px, py, px + pw, py + ph];
          });
          n++;
          if ((a.actor ?? '') === (b.actor ?? '')) { actorSame++; if ((a.part ?? '') === (b.part ?? '') || !a.actor) bothSame++; else if (diffs.length < 6) diffs.push({ at: [Math.round(x), Math.round(y)], svg: a, canvas: b }); }
          else if (diffs.length < 6) diffs.push({ at: [Math.round(x), Math.round(y)], svg: a, canvas: b });
        }
        done({ n, actorPct: +((100 * actorSame) / n).toFixed(2), partPct: +((100 * bothSame) / n).toFixed(2), diffs });
      }));
    }), [step]);
    worst = Math.min(worst, r.actorPct);
    console.log(JSON.stringify({ theme, frac, ...r }));
    await page.close();
  }
} finally { await browser.close(); server.close(); }
console.log(`worst actor agreement ${worst} %`);
process.exitCode = worst >= min ? 0 : 1;
