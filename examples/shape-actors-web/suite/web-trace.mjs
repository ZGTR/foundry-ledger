// Usage: node packages/shape-actors/scripts/perf/web-trace.mjs [idle|drag|swipe] [theme] [cpuSlowdown] [--dist dir] [--no-focus] [--css '<extra css>'] [--profile] [--stacks] [--attrs] [--eval '<js>'] [--renderer svg|canvas] [--gpu]
//
// Where a web frame's time goes: a DevTools timeline trace of the demo stage under CPU
// throttling (idle, or a real touch drag), summed by event (script, style, layout, paint,
// layerize, commit, raster), plus the stage's adaptive quality level at the end. Use it to
// find the next bottleneck after web-bench.mjs says a scenario is over budget.
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pos = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !['--dist', '--css', '--eval', '--renderer'].includes(all[i - 1]));
const ci = process.argv.indexOf('--css');
const extraCss = ci > 0 ? process.argv[ci + 1] : '';
const [scenario = 'drag', theme = 'playground', rate = '6'] = pos;
const di = process.argv.indexOf('--dist');
const dist = path.resolve(di > 0 ? process.argv[di + 1] : path.join(PKG, 'demo-dist'));
if (di < 0) execFileSync('node', ['scripts/build-demo.mjs', '--minify'], { cwd: PKG, stdio: 'ignore' });
const server = http.createServer((req, res) => {
  const p = new URL(req.url ?? '/', 'http://x').pathname;
  const file = path.join(dist, p === '/' ? 'index.html' : path.normalize(p));
  if (!file.startsWith(dist) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
await new Promise((r) => server.once('listening', r));
const port = server.address().port;

const browser = await chromium.launch({ ...(process.env.SHAPE_ACTORS_CHROMIUM ? { executablePath: process.env.SHAPE_ACTORS_CHROMIUM } : {}),
  // --gpu: GPU rasterisation and compositing on SwiftShader (a CPU implementation of the GPU API):
  // the code path of a phone's browser, where a canvas reaches the compositor without a copy on
  // the main thread. Without it, headless Chromium composites in software (like a phone whose GPU
  // the browser blocklists).
  args: process.argv.includes('--gpu') ? ['--use-angle=swiftshader', '--use-gl=angle', '--enable-gpu-rasterization', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-accelerated-2d-canvas', '--enable-gpu-compositing'] : [] });
try {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const ri = process.argv.indexOf('--renderer'); // svg | canvas (the stage's renderer for this run)
  await page.addInitScript(([c, r]) => { window.__SHAPE_ACTORS_CONFIG__ = c; if (r) window.__SHAPE_ACTORS_RENDERER__ = r; }, [{ view: 'stage', scene: { theme, sound: false, speak: false, ...(process.argv.includes('--no-focus') ? { feel: { focus: 0 } } : {}) } }, ri > 0 ? process.argv[ri + 1] : undefined]);
  await page.goto(`http://localhost:${port}/`);
  await page.waitForSelector('body[data-ready="true"]');
  await page.addStyleTag({ content: 'header,#tabs,nav,[data-testid="controls"]{display:none!important} main{padding:0!important}' + extraCss });
  await page.evaluate(() => { scrollTo(0, 0); const h = document.querySelector('[data-testid="shape-actor-stage"]').parentElement; h.scrollLeft = (h.scrollWidth - h.clientWidth) / 3; });
  // --eval '<js>': run a page snippet before measuring (prototype a change without a build).
  const ev = process.argv.indexOf('--eval');
  if (ev > 0) await page.evaluate(process.argv[ev + 1]);
  await page.waitForTimeout(300);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(rate) });
  const held = await page.evaluate(() => {
    const c = window.shapeActors.stage().controller; const svg = document.querySelector('[data-testid="shape-actor-stage"]');
    const box = svg.getBoundingClientRect(); const { width, height } = c.world;
    const tp = (x, y) => [box.left + (x / width) * box.width, box.top + (y / height) * box.height];
    const vis = c.cast.filter((a) => a.draggable && !a.body.hidden).map((a) => { const [x0, y0, x1, y1] = a.bounds(); return tp((x0 + x1) / 2, (y0 + y1) / 2); });
    return vis.find(([x, y]) => x > 20 && x < innerWidth - 20 && y > 20 && y < innerHeight - 20);
  });
  // --attrs: count DOM attribute writes by name over the scenario (what the per-frame setAttribute cost is spent on).
  if (process.argv.includes('--attrs')) await page.evaluate(() => { const c = window.__attrs = new Map(); const set = Element.prototype.setAttribute; Element.prototype.setAttribute = function (k, v) { c.set(k, (c.get(k) ?? 0) + 1); return set.call(this, k, v); }; });
  const events = [];
  cdp.on('Tracing.dataCollected', (d) => events.push(...d.value));
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  const profile = process.argv.includes('--profile'); // JS self time by function (build without --minify for names)
  if (profile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline' + (process.argv.includes('--stacks') ? ',disabled-by-default-devtools.timeline.stack' : ''), transferMode: 'ReportEvents' });
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  if (scenario === 'swipe') {
    // Background swipes in the sky (what swipe-nudge measures): the cast reacts, the world may scroll.
    for (let r = 0; r < 8; r++) {
      const y = 60, x0 = 180; await touch('touchStart', x0, y);
      for (let p = 1; p < 12; p++) { await touch('touchMove', x0 + p * 14 * (r % 2 ? -1 : 1), y); await new Promise((res) => setTimeout(res, 8)); }
      await touch('touchEnd'); await new Promise((res) => setTimeout(res, 200));
    }
  } else if (scenario === 'idle' || !held) await new Promise((r) => setTimeout(r, 3000));
  else {
    await touch('touchStart', ...held);
    for (let k = 0; k < 150; k++) { await touch('touchMove', held[0] + 30 + Math.sin(k / 10) * 30, held[1] - 40); await new Promise((r) => setTimeout(r, 16)); }
    await touch('touchEnd');
  }
  const prof = profile ? (await cdp.send('Profiler.stop')).profile : null;
  await cdp.send('Tracing.end');
  await done;
  if (prof) {
    const self = new Map(), byId = new Map(prof.nodes.map((n) => [n.id, n]));
    const dt = new Map(); prof.samples.forEach((id, i) => dt.set(id, (dt.get(id) ?? 0) + (prof.timeDeltas[i] ?? 0)));
    for (const [id, us] of dt) { const f = byId.get(id).callFrame; const k = `${f.functionName || '(anon)'} ${path.basename(f.url)}:${f.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + us); }
    console.log('JS self time (top 25):');
    for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${(v / 1000).toFixed(0).padStart(7)} ms  ${k}`);
  }
  const sum = new Map();
  for (const e of events) if (e.ph === 'X' && e.dur) sum.set(e.name, (sum.get(e.name) ?? 0) + e.dur);
  // Forced (synchronous) style/layout: Layout / UpdateLayoutTree events nested inside script
  // (rAF callbacks, event handlers, timers) on the same thread, by the script that triggered it.
  const scripts = events.filter((e) => e.ph === 'X' && ['FireAnimationFrame', 'EventDispatch', 'FunctionCall', 'TimerFire'].includes(e.name));
  const forced = new Map();
  for (const e of events) {
    if (e.ph !== 'X' || !['Layout', 'UpdateLayoutTree'].includes(e.name)) continue;
    const host = scripts.find((s) => s.tid === e.tid && s.pid === e.pid && s.ts <= e.ts && s.ts + s.dur >= e.ts + e.dur);
    if (!host) continue;
    const st = e.args?.beginData?.stackTrace ?? e.args?.data?.stackTrace;
    const at = st?.length ? ` @ ${st.slice(0, 3).map((f) => `${f.functionName || '(anon)'}:${f.lineNumber}`).join(' < ')}` : '';
    const k = `${e.name} in ${host.name}${host.args?.data?.type ? `(${host.args.data.type})` : ''}${at}`;
    const v = forced.get(k) ?? { ms: 0, n: 0 }; v.ms += e.dur / 1000; v.n++; forced.set(k, v);
  }
  if (forced.size) { console.log('forced style/layout (inside script):'); for (const [k, v] of [...forced].sort((a, b) => b[1].ms - a[1].ms)) console.log(`${v.ms.toFixed(0).padStart(7)} ms  ${String(v.n).padStart(5)}×  ${k}`); }
  if (process.argv.includes('--attrs')) { const top = await page.evaluate(() => [...window.__attrs].sort((a, b) => b[1] - a[1]).slice(0, 15)); console.log('attribute writes:'); for (const [k, n] of top) console.log(`${String(n).padStart(8)}  ${k}`); }
  const quality = await page.evaluate(() => document.querySelector('[data-testid="shape-actor-stage"]').getAttribute('data-quality') ?? '0');
  console.log(`${scenario} · ${theme} · ${rate}x CPU · adaptive quality ${quality}`);
  for (const [k, v] of [...sum].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`${(v / 1000).toFixed(0).padStart(7)} ms  ${k}`);
} finally { await browser.close(); server.close(); }
