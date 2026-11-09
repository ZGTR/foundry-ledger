// Usage: node packages/shape-actors/scripts/perf/leak-check.mjs [--dist dir] [--theme market] [--reloads 10]
// Memory-leak check for the web stage: remount the stage (a page swap) and reload the world in
// place (a door) N times each, forcing GC before every reading. DOM nodes and event listeners
// must not grow; JS heap may settle but must plateau. Exit 1 on growth.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', path.join(PKG, 'demo-dist')));
if (!process.argv.includes('--dist')) execFileSync('node', ['scripts/build-demo.mjs', '--minify'], { cwd: PKG, stdio: 'ignore' });
const theme = arg('--theme', 'market'), N = Number(arg('--reloads', '10'));
const srv = http.createServer((q, r) => { const p = new URL(q.url, 'http://x').pathname; const f = path.join(dist, p === '/' ? 'index.html' : path.normalize(p)); if (!f.startsWith(dist) || !fs.existsSync(f)) { r.writeHead(404).end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(0);
await new Promise((r) => srv.once('listening', r));
const b = await chromium.launch(process.env.SHAPE_ACTORS_CHROMIUM ? { executablePath: process.env.SHAPE_ACTORS_CHROMIUM } : {});
let bad = 0;
try {
  for (const mode of ['remount', 'door']) {
    const ctx = await b.newContext({ viewport: { width: 360, height: 740 } }); const pg = await ctx.newPage();
    await pg.addInitScript((c) => { window.__SHAPE_ACTORS_CONFIG__ = c; }, { view: 'stage', scene: { theme, sound: false, speak: false } });
    await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForSelector('body[data-ready="true"]');
    const cdp = await ctx.newCDPSession(pg); await cdp.send('Performance.enable');
    const read = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); const x = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((v) => [v.name, v.value])); return { nodes: x.Nodes, heapMB: x.JSHeapUsedSize / 1048576, listeners: x.JSEventListeners }; };
    const reload = () => pg.evaluate((m) => { if (m === 'door') { const c = window.shapeActors.stage().controller; c.load({ ...c.scene }); } else window.shapeActors.load({ view: 'stage', scene: { ...window.shapeActors.stage().controller.scene } }); }, mode);
    await reload(); await pg.waitForTimeout(400);
    const first = await read();
    const half = []; for (let i = 0; i < N; i++) { await reload(); await pg.waitForTimeout(300); if (i >= N / 2) half.push((await read()).heapMB); }
    const last = await read();
    const nodeGrowth = last.nodes - first.nodes, lis = last.listeners - first.listeners, plateau = half.length > 1 ? half[half.length - 1] - half[0] : 0;
    const ok = nodeGrowth <= Math.max(50, first.nodes * 0.02) && lis <= 5 && plateau < 2;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'LEAK'} ${mode.padEnd(8)} ${N}x ${theme}: nodes ${first.nodes} → ${last.nodes}, listeners ${first.listeners} → ${last.listeners}, heap ${first.heapMB.toFixed(1)} → ${last.heapMB.toFixed(1)} MB (second-half drift ${plateau.toFixed(2)} MB)`);
    await ctx.close();
  }
} finally { await b.close(); srv.close(); }
process.exit(bad ? 1 : 0);
