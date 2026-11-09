// Browser recording of opening a world on a low-end phone: the demo stage of each build, under the
// same CPU throttle, from navigation to the first frame that shows the world.
//   node startup-video.mjs <out-dir> <label>=<demo-dist> [<label>=<demo-dist> …] [--theme farm] [--cpu 6] [--reps 3]
// Writes <label>.webm (first rep), startup.json (time to world per rep: navigation → stage visible
// with its objects and scenery drawn) and side-by-side.mp4 (needs ffmpeg).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const out = path.resolve(args[0]);
const builds = args.slice(1).filter((a) => a.includes('=') && !a.startsWith('--')).map((a) => a.split('='));
const theme = opt('--theme', 'farm'), cpu = Number(opt('--cpu', '6')), reps = Number(opt('--reps', '3'));
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.map': 'application/json' };
const serve = (dir) => new Promise((ok) => { const s = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0, () => ok(s)); });
const browser = await chromium.launch(process.env.SHAPE_ACTORS_CHROMIUM ? { executablePath: process.env.SHAPE_ACTORS_CHROMIUM } : {});
const report = {};
for (const [label, dist] of builds) {
  const server = await serve(path.resolve(dist));
  report[label] = [];
  for (let rep = 0; rep < reps; rep++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, ...(rep === 0 ? { recordVideo: { dir: out, size: { width: 390, height: 700 } } } : {}) });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.addInitScript((c) => { window.__SHAPE_ACTORS_CONFIG__ = c; }, { view: 'stage', scene: { theme, sound: false, speak: false, height: 640 } });
    const t0 = Date.now();
    await page.goto(`http://localhost:${server.address().port}/`);
    // The world is "shown" when the stage is visible, has its objects, and has drawn scenery.
    await page.waitForFunction(() => {
      const svg = document.querySelector('[data-testid="shape-actor-stage"]');
      return !!svg && getComputedStyle(svg).visibility !== 'hidden' && svg.querySelectorAll('[data-testid^="sa-actor-"]').length > 5 && svg.querySelectorAll('path,rect,circle,ellipse').length > 400;
    }, undefined, { timeout: 120000, polling: 50 });
    const ms = Date.now() - t0;
    report[label].push(ms);
    await page.waitForTimeout(1500);
    const video = page.video();
    await ctx.close();
    if (video) fs.renameSync(await video.path(), path.join(out, `${label}.webm`));
    console.log(label, 'rep', rep + 1, 'time to world', ms, 'ms');
  }
  server.close();
}
await browser.close();
fs.writeFileSync(path.join(out, 'startup.json'), JSON.stringify({ kind: 'startup-browser', theme, cpuThrottle: cpu, msToWorld: report }, null, 2) + '\n');
if (builds.length >= 2) {
  const inputs = builds.flatMap(([l]) => ['-i', path.join(out, `${l}.webm`)]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${builds.map((_, i) => `[${i}:v]`).join('')}hstack=inputs=${builds.length}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', path.join(out, 'side-by-side.mp4')]);
}
console.log('→', out);
