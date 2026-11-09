// Usage: node packages/shape-actors/scripts/perf/web-bench.mjs [--devices low,mid,high] [--themes a,b] [--scenarios x,y]
//          [--reps 3] [--out file.json] [--no-build] [--dist dir] [--label name] [--renderer svg|canvas] [--gpu]
// --dist serves another build of the demo (e.g. one made from an older commit) for A/B runs;
// --reps repeats every cell and reports the median (a shared CI VM's frame times are noisy).
//
// The web stage (SvgStageView) in real Chromium, under the CPU of each device class
// (DevTools CPU throttling), driven by REAL input (CDP touch on phone, mouse on desktop),
// through the same edge cases as the engine bench. Measured in the page:
//   frame interval p50/p95/p99, dropped frames (interval > 1.5 × the display's frame),
//   long animation frames (> 50 ms), and input latency (pointer event → the next painted frame);
//   and memory after each scenario, after a forced GC: JS heap, DOM nodes, layout objects.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
/** 0 = any free port (never collides with a dev server or another bench). */
const PORT = Number(process.env.PERF_PORT ?? 0);

/** CPU slowdown vs this machine and the viewport each class is measured at (scripts/perf/scenarios.ts DEVICES). */
const DEVICES = {
  high: { slowdown: 1.5, viewport: { width: 1280, height: 800 }, touch: false, label: 'high-end desktop/tablet' },
  mid: { slowdown: 3, viewport: { width: 412, height: 915 }, touch: true, label: 'mid-range phone' },
  low: { slowdown: 6, viewport: { width: 360, height: 740 }, touch: true, label: 'low-end phone' },
};
const THEMES = (arg('--themes') ?? 'playground,market,zoo').split(',');
const DEVS = (arg('--devices') ?? 'low,mid,high').split(',');

/**
 * Browser edge cases (the same names as scripts/perf/scenarios.ts). Each returns a list of
 * input steps {type, x, y, wait} in CSS px relative to the stage's page box; `wait` is ms
 * of real time before the next step.
 */
const SCENARIOS = {
  idle: () => [{ type: 'wait', wait: 3000 }],
  'drag-slow': (s) => drag(s, 180, 16, (k) => [k * 2, -Math.sin(k / 30) * 50]),
  'drag-fast': (s) => drag(s, 180, 16, (k) => [((k * 30) % (s.vw * 0.8)) - s.vw * 0.4, Math.sin(k / 4) * 120]),
  'drag-240hz': (s) => drag(s, 720, 4, (k) => [Math.sin(k / 80) * 120, -Math.abs(Math.sin(k / 60)) * 100]),
  'drag-over-targets': (s) => {
    const out = [{ type: 'down', x: s.held[0], y: s.held[1] }]; let [x, y] = s.held;
    for (const [tx, ty] of s.targets) for (let i = 0; i < 24; i++) { x += (tx - x) * 0.18; y += (ty - y) * 0.18; out.push({ type: 'move', x, y, wait: 8 }); }
    out.push({ type: 'up', x, y }); return out;
  },
  'drag-hold': (s) => drag(s, 300, 16, (k) => [30 + Math.sin(k) * 1.5, -40 + Math.cos(k * 1.3) * 1.5]),
  'throw-spam': (s) => { const out = []; for (let r = 0; r < 12; r++) { out.push({ type: 'down', x: s.held[0], y: s.held[1] }); for (let p = 1; p < 4; p++) out.push({ type: 'move', x: s.held[0] + p * 40, y: s.held[1] - p * 50, wait: 16 }); out.push({ type: 'up', x: s.held[0] + 160, y: s.held[1] - 200, wait: 260 }); } return out; },
  'drag-edge-scroll': (s) => drag(s, 200, 16, (k) => [Math.min(s.vw - 8 - s.held[0], k * 6), 0]),
  'tap-spam': (s) => { const out = []; for (let i = 0; i < 30; i++) { const [x, y] = s.targets[i % Math.max(1, s.targets.length)] ?? s.held; out.push({ type: 'down', x, y }, { type: 'up', x, y, wait: 100 }); } return out; },
  'swipe-nudge': (s) => { const out = []; for (let r = 0; r < 8; r++) { const y = s.sky; const x0 = s.vw / 2; out.push({ type: 'down', x: x0, y }); for (let p = 1; p < 12; p++) out.push({ type: 'move', x: x0 + p * 14 * (r % 2 ? -1 : 1), y, wait: 8 }); out.push({ type: 'up', x: x0, y, wait: 200 }); } return out; },
};
function drag(s, n, every, path) {
  const out = [{ type: 'down', x: s.held[0], y: s.held[1] }];
  for (let k = 1; k <= n; k++) { const [dx, dy] = path(k); out.push({ type: 'move', x: s.held[0] + dx, y: s.held[1] + dy, wait: every }); }
  const [dx, dy] = path(n); out.push({ type: 'up', x: s.held[0] + dx, y: s.held[1] + dy, wait: 300 });
  return out;
}
const WANT = arg('--scenarios')?.split(',') ?? Object.keys(SCENARIOS);
const REPS = Math.max(1, Number(arg('--reps') ?? 1));

/** The per-cell median over repetitions (each metric on its own). */
function median(reps) {
  if (reps.length === 1) return reps[0];
  const mid = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const out = { ...reps[0] };
  for (const k of ['seconds', 'frames', 'droppedPct', 'longFrames', 'longFrameMs']) out[k] = mid(reps.map((r) => r[k]));
  for (const k of ['frameMs', 'inputLatencyMs', 'memory']) out[k] = Object.fromEntries(Object.keys(reps[0][k]).map((q) => [q, mid(reps.map((r) => r[k][q]))]));
  return out;
}

/** A static server for a demo build (no dependencies). */
function serve(root, port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', '.json': 'application/json', '.ttf': 'font/ttf' };
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const file = path.join(root, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
    if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(port);
}

// In-page probe: rAF intervals, long animation frames, input→frame latency.
const PROBE = () => {
  const w = window; const p = (w.__perf = { frames: [], lat: [], loaf: [], pending: [] });
  let last = 0;
  const loop = (t) => { if (last) p.frames.push(t - last); last = t; const now = performance.now(); for (const e of p.pending) p.lat.push(now - e); p.pending.length = 0; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  for (const type of ['pointermove', 'pointerdown']) addEventListener(type, (e) => p.pending.push(e.timeStamp), { capture: true, passive: true });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) p.loaf.push(e.duration); }).observe({ type: 'long-animation-frame', buffered: false }); } catch { /* older Chromium */ }
  w.__perfReset = () => { p.frames = []; p.lat = []; p.loaf = []; p.pending = []; last = 0; };
};

const q = (s, f) => { const a = [...s].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * f))] : 0; };
const r2 = (n) => Math.round(n * 100) / 100;

async function main() {
  const dist = path.resolve(arg('--dist') ?? path.join(PKG, 'demo-dist'));
  if (!arg('--dist') && !process.argv.includes('--no-build')) execFileSync('node', ['scripts/build-demo.mjs', '--minify'], { cwd: PKG, stdio: 'inherit' });
  const server = serve(dist, PORT);
  await new Promise((r, j) => { server.once('listening', r); server.once('error', j); });
  const port = server.address().port;
  const browser = await chromium.launch({ ...(process.env.SHAPE_ACTORS_CHROMIUM ? { executablePath: process.env.SHAPE_ACTORS_CHROMIUM } : {}), args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    // --gpu: GPU rasterisation and compositing on SwiftShader (a CPU implementation of the GPU
    // API), the code path of a phone's browser; without it headless Chromium composites in
    // software (like a phone whose GPU the browser blocklists). See web-trace.mjs.
    ...(process.argv.includes('--gpu') ? ['--use-angle=swiftshader', '--use-gl=angle', '--enable-gpu-rasterization', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-accelerated-2d-canvas', '--enable-gpu-compositing'] : [])] });
  const rows = [];
  const opensOut = [];
  try {
    for (const dev of DEVS) {
      const d = DEVICES[dev];
      for (const theme of THEMES) {
        const ctx = await browser.newContext({ viewport: d.viewport, hasTouch: d.touch, isMobile: d.touch, deviceScaleFactor: d.touch ? 2 : 1 });
        const page = await ctx.newPage();
        await page.addInitScript(([c, r]) => { window.__SHAPE_ACTORS_CONFIG__ = c; if (r) window.__SHAPE_ACTORS_RENDERER__ = r; }, [{ view: 'stage', scene: { theme, sound: false, speak: false } }, arg('--renderer')]);
        await page.addInitScript(PROBE);
        await page.goto(`http://localhost:${port}/`);
        await page.waitForSelector('body[data-ready="true"]');
        // The demo's header lists every theme (hundreds of buttons); the product shows the stage
        // alone, so measure that: header, tabs and the control panel are removed from layout.
        await page.addStyleTag({ content: 'header,#tabs,nav,[data-testid="controls"]{display:none!important} main{padding:0!important}' });
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: d.slowdown });
        // World open: load the world again and wait for two painted frames (DOM build + first paint).
        const opens = [];
        for (let k = 0; k < 2; k++) opens.push(await page.evaluate(() => new Promise((done) => {
          const t0 = performance.now();
          window.shapeActors.load({ view: 'stage', scene: { ...window.shapeActors.stage().controller.scene } });
          requestAnimationFrame(() => requestAnimationFrame(() => done(performance.now() - t0)));
        })));
        const openMs = r2(Math.min(...opens));
        await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
        await cdp.send('Performance.enable').catch(() => {});
        const om = Object.fromEntries(((await cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] }))).metrics).map((x) => [x.name, x.value]));
        opensOut.push({ device: dev, theme, openMs, jsHeapMB: r2((om.JSHeapUsedSize ?? 0) / 1048576), domNodes: om.Nodes ?? 0 });
        console.log(`${dev.padEnd(4)} ${theme.padEnd(11)} world-open         ${openMs} ms  heap ${r2((om.JSHeapUsedSize ?? 0) / 1048576)}MB  nodes ${om.Nodes ?? 0}`);
        for (const name of WANT) {
          if (!SCENARIOS[name]) continue;
          const reps = [];
          for (let rep = 0; rep < REPS; rep++) {
          await page.evaluate(() => { window.shapeActors.load({ view: 'stage', scene: { ...window.shapeActors.stage().controller.scene } }); });
          await page.waitForTimeout(600);
          await page.evaluate(() => { scrollTo(0, 0); const host = document.querySelector('[data-testid="shape-actor-stage"]').parentElement; host.scrollLeft = Math.max(0, (host.scrollWidth - host.clientWidth) / 3); });
          await page.waitForTimeout(200);
          // Where things are, in page px: the most central draggable, everything else in view, the sky.
          const s = await page.evaluate(() => {
            const c = window.shapeActors.stage().controller; const svg = document.querySelector('[data-testid="shape-actor-stage"]');
            const box = svg.getBoundingClientRect(); const { width, height } = c.world;
            const host = svg.parentElement; const mid = (host.scrollLeft + host.clientWidth / 2) / (box.width / width);
            const toPage = (x, y) => [box.left + (x / width) * box.width, box.top + (y / height) * box.height];
            const vis = c.cast.filter((a) => { if (a.body.hidden) return false; const [px, py] = toPage(a.body.x, a.body.y); return px > 10 && px < innerWidth - 10 && py > 10 && py < innerHeight - 10; });
            const ctr = (a) => { const [x0, y0, x1, y1] = a.bounds(); return toPage((x0 + x1) / 2, (y0 + y1) / 2); };
            const held = vis.filter((a) => a.draggable).sort((a, b) => Math.abs(a.body.x - mid) - Math.abs(b.body.x - mid))[0];
            return { held: held ? ctr(held) : [innerWidth / 2, innerHeight / 2], targets: vis.filter((a) => a !== held).slice(0, 10).map(ctr), sky: box.top + 30, vw: innerWidth, actors: c.cast.length };
          });
          await page.evaluate(() => window.__perfReset());
          const t0 = Date.now();
          for (const step of SCENARIOS[name](s)) await send(cdp, d.touch, step);
          await page.waitForTimeout(300);
          const m = await page.evaluate(() => window.__perf);
          // Memory after the scenario, after a forced GC (what stays resident, not garbage).
          await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
          await cdp.send('Performance.enable').catch(() => {});
          const pm = Object.fromEntries(((await cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] }))).metrics).map((x) => [x.name, x.value]));
          const budget = 1000 / 60;
          const frames = m.frames.slice(2);
          const row = {
            device: dev, theme, scenario: name, actors: s.actors, seconds: r2((Date.now() - t0) / 1000), frames: frames.length,
            frameMs: { p50: r2(q(frames, 0.5)), p95: r2(q(frames, 0.95)), p99: r2(q(frames, 0.99)), max: r2(Math.max(0, ...frames)) },
            droppedPct: r2((100 * frames.filter((f) => f > budget * 1.5).length) / Math.max(1, frames.length)),
            longFrames: m.loaf.length, longFrameMs: r2(m.loaf.reduce((a, b) => a + b, 0)),
            inputLatencyMs: { p50: r2(q(m.lat, 0.5)), p95: r2(q(m.lat, 0.95)) },
            memory: { jsHeapMB: r2((pm.JSHeapUsedSize ?? 0) / 1048576), domNodes: pm.Nodes ?? 0, layoutObjects: pm.LayoutObjects ?? 0, listeners: pm.JSEventListeners ?? 0 },
          };
          reps.push(row);
          }
          const row = median(reps);
          rows.push(row);
          console.log(`${dev.padEnd(4)} ${theme.padEnd(11)} ${name.padEnd(18)} frame p95 ${String(row.frameMs.p95).padStart(6)}ms  dropped ${String(row.droppedPct).padStart(5)}%  input p95 ${row.inputLatencyMs.p95}ms  LoAF ${row.longFrames}  heap ${row.memory.jsHeapMB}MB  nodes ${row.memory.domNodes}  layout ${row.memory.layoutObjects}`);
        }
        await ctx.close();
      }
    }
  } finally { await browser.close(); server.close(); }
  const out = { kind: 'web', label: arg('--label') ?? path.basename(dist), reps: REPS, rows, opens: opensOut };
  const file = arg('--out');
  if (file) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(out, null, 1)); }
}

async function send(cdp, touch, step) {
  if (step.type !== 'wait') {
    if (touch) {
      const type = step.type === 'down' ? 'touchStart' : step.type === 'move' ? 'touchMove' : 'touchEnd';
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: step.x, y: step.y, id: 1 }] });
    } else {
      const type = step.type === 'down' ? 'mousePressed' : step.type === 'move' ? 'mouseMoved' : 'mouseReleased';
      await cdp.send('Input.dispatchMouseEvent', { type, x: step.x, y: step.y, button: 'left', buttons: step.type === 'up' ? 0 : 1, clickCount: 1 });
    }
  }
  if (step.wait) await new Promise((r) => setTimeout(r, step.wait));
}

main().catch((e) => { console.error(e); process.exit(1); });
