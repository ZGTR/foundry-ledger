// Usage: node packages/shape-actors/scripts/perf/record-open.mjs --before <demo-dist> --after <demo-dist> --out <dir>
//          [--theme market] [--cpu 6] [--labels "Before,After"]
//
// Screen recording of OPENING A WORLD (what every door costs): each build loads the world again
// under the same CPU throttle; the two recordings are stitched side by side with a clock burned
// in (needs ffmpeg). Prints the measured open time (load → two painted frames) for each.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'perf-results/open'));
const theme = arg('--theme', 'market'), cpu = Number(arg('--cpu', '6'));
const [la, lb] = arg('--labels', 'Before,After').split(',');
fs.mkdirSync(out, { recursive: true });
const VIEW = { width: 390, height: 560 };
const b = await chromium.launch(process.env.SHAPE_ACTORS_CHROMIUM ? { executablePath: process.env.SHAPE_ACTORS_CHROMIUM } : {});
const files = [];
for (const [label, dist] of [[la, path.resolve(arg('--before'))], [lb, path.resolve(arg('--after'))]]) {
  const srv = http.createServer((q, r) => { const p = new URL(q.url, 'http://x').pathname; const f = path.join(dist, p === '/' ? 'index.html' : path.normalize(p)); if (!f.startsWith(dist) || !fs.existsSync(f)) { r.writeHead(404).end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(0);
  await new Promise((r) => srv.once('listening', r));
  // A first context loads the app (not recorded); the recorded one only opens the world.
  const ctx = await b.newContext({ viewport: VIEW, recordVideo: { dir: out, size: VIEW } });
  const pg = await ctx.newPage();
  await pg.addInitScript((c) => { window.__SHAPE_ACTORS_CONFIG__ = c; }, { view: 'stage', scene: { theme: 'farm', sound: false, speak: false, height: 520 } });
  await pg.goto(`http://localhost:${srv.address().port}/`);
  await pg.waitForSelector('body[data-ready="true"]');
  await pg.addStyleTag({ content: 'header,#tabs,nav,[data-testid="controls"]{display:none!important} main{padding:0!important} body{margin:0}' });
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await pg.waitForTimeout(1500);
  const ms = await pg.evaluate((t) => new Promise((done) => {
    const t0 = performance.now();
    window.shapeActors.load({ view: 'stage', scene: { theme: t, sound: false, speak: false, height: 520 } });
    requestAnimationFrame(() => requestAnimationFrame(() => done(Math.round(performance.now() - t0))));
  }), theme);
  await pg.waitForTimeout(2500);
  const v = pg.video(); await ctx.close(); srv.close();
  const file = path.join(out, `${label.toLowerCase().replace(/\W+/g, '-')}.webm`);
  fs.renameSync(await v.path(), file); files.push([label, file]);
  console.log(`${label}: ${theme} open ${ms} ms at ${cpu}x CPU`);
}
await b.close();
try {
  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const txt = (l) => fs.existsSync(font) ? `drawtext=fontfile=${font}:text='${l}  %{pts\\:hms}':x=10:y=10:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7,` : '';
  const sbs = path.join(out, 'open-side-by-side.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', files[0][1], '-i', files[1][1], '-filter_complex',
    `[0:v]${txt(files[0][0])}pad=iw+12:ih:0:0:white[a];[1:v]${txt(files[1][0])}null[b];[a][b]hstack=inputs=2,format=yuv420p[v]`, '-map', '[v]', '-r', '30', '-c:v', 'libx264', '-crf', '26', sbs]);
  console.log(`side by side ${sbs}`);
} catch (e) { console.log(`side by side skipped (ffmpeg): ${e.message.split('\n')[0]}`); }
