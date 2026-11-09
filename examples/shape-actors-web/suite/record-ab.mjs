// Usage: node packages/shape-actors/scripts/perf/record-ab.mjs --before <demo-dist> --after <demo-dist> --out <dir>
//          [--theme playground] [--cpu 6] [--labels "Before,After"] [--renderers svg,canvas] [--gpu]
//
// Screen recordings for a performance change: the SAME real-touch script (slow drag, hold,
// fast zigzag, tap spam, background swipes) on two builds of the demo stage, under the same CPU
// throttle, with a live HUD (fps, frame-time sparkline: red bars are dropped frames) and a
// finger marker. Writes <label>.webm per build, side-by-side.mp4, and a mid-drag screenshot
// per build. Needs ffmpeg on PATH for the side-by-side; SHAPE_ACTORS_CHROMIUM for a browser.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'perf-results/recordings'));
const theme = arg('--theme', 'playground');
const cpu = Number(arg('--cpu', '6'));
const [labelA, labelB] = arg('--labels', 'Before,After').split(',');
const builds = [[labelA, path.resolve(arg('--before'))], [labelB, path.resolve(arg('--after'))]];
// --renderers svg,canvas: the stage renderer per build (the same build can be recorded both ways).
const renderers = (arg('--renderers') ?? ',').split(',').map((r) => r || undefined);
const VIEW = { width: 390, height: 700 };
fs.mkdirSync(out, { recursive: true });

function serve(root) {
  const s = http.createServer((req, res) => {
    const p = new URL(req.url ?? '/', 'http://x').pathname;
    const file = path.join(root, p === '/' ? 'index.html' : path.normalize(p));
    if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(0);
  return new Promise((r) => s.once('listening', () => r(s)));
}

// The HUD: fps over the last second and the last 90 frame intervals (red = over 1.5 frames).
const HUD = (label) => {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;background:rgba(20,18,30,.82);color:#fff;font:700 13px/1.25 system-ui;padding:8px 10px;border-radius:12px;pointer-events:none;min-width:170px';
  box.innerHTML = `<div style="font-size:16px">${label}</div><div data-fps>– fps</div><div data-drop>dropped –</div><canvas width="170" height="40" style="display:block;margin-top:4px"></canvas>`;
  document.body.appendChild(box);
  const dot = document.createElement('div');
  dot.style.cssText = 'position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(255,80,80,.35);border:3px solid #ff5050;z-index:99998;pointer-events:none;display:none';
  document.body.appendChild(dot);
  window.__finger = (x, y, on) => { dot.style.display = on ? 'block' : 'none'; dot.style.left = `${x}px`; dot.style.top = `${y}px`; };
  const g = box.querySelector('canvas').getContext('2d');
  const fps = box.querySelector('[data-fps]'), drop = box.querySelector('[data-drop]');
  const ivs = []; let last = 0, total = 0, dropped = 0;
  const loop = (t) => {
    if (last) { const d = t - last; ivs.push(d); if (ivs.length > 90) ivs.shift(); total++; if (d > 25) dropped++; }
    last = t;
    const sec = ivs.slice(-30).reduce((a, b) => a + b, 0) || 1;
    fps.textContent = `${Math.round((Math.min(30, ivs.length) * 1000) / sec)} fps`;
    drop.textContent = `dropped ${total ? Math.round((100 * dropped) / total) : 0}%`;
    g.clearRect(0, 0, 170, 40);
    ivs.forEach((d, i) => { const h = Math.min(40, d / 2); g.fillStyle = d > 25 ? '#ff5a5a' : '#5ad17a'; g.fillRect(i * 1.9, 40 - h, 1.4, h); });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};

const browser = await chromium.launch({ ...(process.env.SHAPE_ACTORS_CHROMIUM ? { executablePath: process.env.SHAPE_ACTORS_CHROMIUM } : {}),
  // --gpu: GPU rasterisation and compositing on SwiftShader (see web-trace.mjs).
  args: process.argv.includes('--gpu') ? ['--use-angle=swiftshader', '--use-gl=angle', '--enable-gpu-rasterization', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-accelerated-2d-canvas', '--enable-gpu-compositing'] : [] });
const videos = [];
try {
  for (const [label, dist] of builds) {
    const server = await serve(dist);
    const ctx = await browser.newContext({ viewport: VIEW, hasTouch: true, isMobile: true, deviceScaleFactor: 1, recordVideo: { dir: out, size: VIEW } });
    const page = await ctx.newPage();
    await page.addInitScript(([c, r]) => { window.__SHAPE_ACTORS_CONFIG__ = c; if (r) window.__SHAPE_ACTORS_RENDERER__ = r; }, [{ view: 'stage', scene: { theme, sound: false, speak: false, height: 640 } }, renderers[builds.findIndex((b) => b[0] === label)]]);
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.waitForSelector('body[data-ready="true"]');
    await page.addStyleTag({ content: 'header,#tabs,nav,[data-testid="controls"]{display:none!important} main{padding:0!important} body{margin:0}' });
    await page.evaluate(() => { scrollTo(0, 0); const h = document.querySelector('[data-testid="shape-actor-stage"]').parentElement; h.scrollLeft = (h.scrollWidth - h.clientWidth) / 3; });
    await page.evaluate(HUD, `${label} · ${cpu}× CPU`);
    await page.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    const s = await page.evaluate(() => {
      const c = window.shapeActors.stage().controller; const svg = document.querySelector('[data-testid="shape-actor-stage"]');
      const box = svg.getBoundingClientRect(); const { width, height } = c.world;
      const tp = (x, y) => [box.left + (x / width) * box.width, box.top + (y / height) * box.height];
      const all = c.cast.filter((a) => !a.body.hidden).map((a) => { const [x0, y0, x1, y1] = a.bounds(); return { drag: a.draggable, p: tp((x0 + x1) / 2, (y0 + y1) / 2) }; })
        .filter(({ p: [x, y] }) => x > 30 && x < innerWidth - 30 && y > 90 && y < innerHeight - 30);
      return { held: (all.find((a) => a.drag) ?? all[0]).p, taps: all.map((a) => a.p) };
    });
    const touch = async (type, x, y) => {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
      await page.evaluate(([a, b, on]) => window.__finger(a, b, on), [x ?? 0, y ?? 0, type !== 'touchEnd']).catch(() => {});
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let [x, y] = s.held;
    await touch('touchStart', x, y);
    for (let k = 0; k < 90; k++) { x = s.held[0] + Math.sin(k / 14) * 110; y = s.held[1] - Math.abs(Math.sin(k / 22)) * 160; await touch('touchMove', x, y); await wait(16); } // slow carry
    for (let k = 0; k < 60; k++) { await touch('touchMove', x + Math.sin(k) * 1.5, y + Math.cos(k) * 1.5); await wait(16); } // hold
    for (let k = 0; k < 60; k++) { await touch('touchMove', VIEW.width / 2 + Math.sin(k / 3) * 150, y + Math.sin(k / 2) * 90); await wait(16); } // fast zigzag
    await touch('touchEnd');
    if (label === labelA || label === labelB) await page.screenshot({ path: path.join(out, `${label.toLowerCase()}-after-drag.png`) });
    for (let i = 0; i < 16; i++) { const [tx, ty] = s.taps[i % s.taps.length]; await touch('touchStart', tx, ty); await touch('touchEnd'); await wait(110); } // tap spam
    for (let r = 0; r < 6; r++) { // background swipes in the sky (the whole nearby cast reacts)
      const y = 60, x0 = VIEW.width / 2; await touch('touchStart', x0, y);
      for (let p = 1; p < 10; p++) { await touch('touchMove', x0 + p * 12 * (r % 2 ? -1 : 1), y + p * 2); await wait(16); }
      await touch('touchEnd'); await wait(160);
    }
    await wait(800);
    const video = page.video();
    await ctx.close();
    server.close();
    const file = path.join(out, `${label.toLowerCase()}.webm`);
    fs.renameSync(await video.path(), file);
    videos.push(file);
    console.log(`recorded ${path.relative(process.cwd(), file)}`);
  }
} finally { await browser.close(); }

try {
  const sbs = path.join(out, 'side-by-side.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', videos[0], '-i', videos[1], '-filter_complex',
    '[0:v]pad=iw+12:ih:0:0:white[a];[a][1:v]hstack=inputs=2,format=yuv420p[v]', '-map', '[v]', '-r', '30', '-c:v', 'libx264', '-crf', '24', '-shortest', sbs]);
  console.log(`side by side ${path.relative(process.cwd(), sbs)}`);
} catch (e) { console.log(`side by side skipped (ffmpeg): ${e.message.split('\n')[0]}`); }
