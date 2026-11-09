// Usage (repo root): NODE_PATH=node_modules npx tsx packages/shape-actors/scripts/perf/node-bench.ts [--themes a,b] [--all] [--scenarios x,y] [--no-skia] [--out file.json]
//
// Per frame of every scenario × theme it measures, on this machine:
//   engine  = all pointer events of the frame + one controller tick (the JS work behind a frame)
//   render  = SkiaStageRenderer.draw() into a picture on headless CanvasKit (the native paint)
//   allocs  = Skia objects created by draw() (rects, paths, colours): on iOS/Android each is a
//             JSI host object, so this count is the native GC pressure per frame
//   raster  = replaying that frame's picture into a phone-sized surface (the UI/raster thread
//             on device: every op recorded, including the backdrop, is played back here)
//   calls   = canvas calls made by draw() (save/translate/draw…): each one crosses JSI on device,
//             so this count is the native recording cost per frame
// The result is projected onto device classes by scripts/perf/run.mjs (budgets.json).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DEFAULT_THEMES, SCENARIOS, stats, type Input } from './scenarios';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..') + '/';
const require = createRequire(import.meta.url);
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const W = 390, H = 760;

(async () => {
  const { createShapeActorKit } = require(ROOT + 'packages/shape-actors/src/kit');
  const { ALL_DECOR } = require(ROOT + 'packages/shape-actors/src/catalog/decorAll.js');
  const { ManualClock } = require(ROOT + 'packages/shape-actors/src/core/clock');
  const { SkiaStageRenderer } = require(ROOT + 'packages/shape-actors/src/view/SkiaStageRenderer');
  let Skia: any;
  if (!process.argv.includes('--no-skia')) {
    const { LoadSkiaWeb } = require(ROOT + 'node_modules/@shopify/react-native-skia/lib/commonjs/web/LoadSkiaWeb');
    await LoadSkiaWeb();
    Skia = require(ROOT + 'node_modules/@shopify/react-native-skia/lib/commonjs/headless').getSkiaExports().Skia;
  }
  // Counts every Skia object the renderer creates (Paint is made once in the constructor).
  let allocs = 0, calls = 0, lastRaster = 0; let surface: any;
  const counted = Skia && {
    Paint: () => Skia.Paint(), Color: (c: string) => { allocs++; return Skia.Color(c); },
    XYWHRect: (x: number, y: number, w: number, h: number) => { allocs++; return Skia.XYWHRect(x, y, w, h); },
    RRectXY: (r: unknown, x: number, y: number) => { allocs++; return Skia.RRectXY(r, x, y); },
    Path: { Make: () => { allocs++; return Skia.Path.Make(); }, MakeFromSVGString: (d: string) => { allocs++; return Skia.Path.MakeFromSVGString(d); } },
    PictureRecorder: () => Skia.PictureRecorder(),
  };

  const probe = createShapeActorKit({ decor: ALL_DECOR, clock: new ManualClock(), sound: { play() {} }, haptics: { pulse() {} }, speech: { say() {} } });
  const known: string[] = probe.catalog.themes.ids();
  const themes = process.argv.includes('--all') ? known.sort() : (arg('--themes')?.split(',') ?? DEFAULT_THEMES).filter((t) => known.includes(t));
  const wanted = arg('--scenarios')?.split(',');
  const scenarios = SCENARIOS.filter((s) => !wanted || wanted.includes(s.name));
  const rows: Record<string, unknown>[] = [];
  const kitMs: number[] = [], loadMs: number[] = [];

  for (const scenario of scenarios) {
    const engine: number[] = [], render: number[] = [], alloc: number[] = [], call: number[] = [], raster: number[] = [];
    let worst = { theme: '', p95: 0 };
    for (const theme of themes) {
      let seed = 7; const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const clock = new ManualClock();
      let ts = performance.now();
      const kit = createShapeActorKit({ decor: ALL_DECOR, clock, random, sound: { play() {} }, haptics: { pulse() {} }, speech: { say() {} } });
      kitMs.push(performance.now() - ts);
      const c = kit.createController(W, H);
      ts = performance.now();
      c.load({ theme, height: H });
      loadMs.push(performance.now() - ts);
      c.start();
      c.camera(Math.min(c.world.width, W * 1.5) / 2);
      const renderer = Skia && new SkiaStageRenderer(counted, c);
      const input: Input = {
        down: (x, y, t, id) => c.pointerDown(x, y, t, id), move: (x, y, t) => c.pointerMove(x, y, t),
        up: (x, y, t) => c.pointerUp(x, y, t), camera: (x) => c.camera(x),
      };
      // Warm up (caches, first paints) so the numbers are steady-state frames.
      for (let i = 0; i < 30; i++) { clock.advance(1 / 60); if (renderer) draw(renderer, c); }
      allocs = 0;
      const state: Record<string, unknown> = {};
      const mine: number[] = [];
      for (let f = 0; f < scenario.frames; f++) {
        const t = 1000 + f * 16.67;
        const t0 = performance.now();
        scenario.step(c, f, t, input, state);
        clock.advance(1 / 60);
        const e = performance.now() - t0;
        engine.push(e); mine.push(e);
        if (renderer) {
          allocs = 0;
          const t1 = performance.now();
          draw(renderer, c);
          render.push(performance.now() - t1 - lastRaster); // recording only (the JS thread)
          raster.push(lastRaster);
          alloc.push(allocs); call.push(calls);
        }
      }
      const p = stats(mine).p95; if (p > worst.p95) worst = { theme, p95: +p.toFixed(3) };
      c.dispose();
    }
    const e = stats(engine), r = stats(render), a = stats(alloc), k = stats(call), ra = stats(raster);
    const row = {
      scenario: scenario.name, why: scenario.why, themes: themes.length,
      engineMs: { mean: +e.mean.toFixed(3), p95: +e.p95.toFixed(3), p99: +e.p99.toFixed(3), max: +e.max.toFixed(3) },
      renderMs: Skia ? { mean: +r.mean.toFixed(3), p95: +r.p95.toFixed(3), p99: +r.p99.toFixed(3), max: +r.max.toFixed(3) } : undefined,
      rasterMs: Skia ? { mean: +ra.mean.toFixed(3), p95: +ra.p95.toFixed(3), max: +ra.max.toFixed(3) } : undefined,
      allocsPerFrame: Skia ? { mean: Math.round(a.mean), p95: a.p95 } : undefined,
      canvasCallsPerFrame: Skia ? { mean: Math.round(k.mean), p95: k.p95 } : undefined,
      worstTheme: worst,
    };
    rows.push(row);
    console.log(`${scenario.name.padEnd(18)} engine p95 ${row.engineMs.p95.toFixed(2)}ms` + (Skia ? `  render p95 ${row.renderMs!.p95.toFixed(2)}ms  raster p95 ${row.rasterMs!.p95.toFixed(2)}ms  allocs ${row.allocsPerFrame!.mean}  calls ${row.canvasCallsPerFrame!.mean}` : '') + `  (worst: ${worst.theme})`);
  }
  // Startup: building the kit (catalogue + validation) is what a phone does before the first
  // world can open; loading a world is what every door costs. Medians over every run above.
  // Memory (needs --expose-gc; run.mjs sets it): heap held by one kit, and by one loaded world.
  const gc = (globalThis as { gc?: () => void }).gc;
  let memory: { kitHeapMB: number; worldHeapMB: number } | undefined;
  if (gc) {
    const heap = () => { gc(); gc(); return process.memoryUsage().heapUsed / 1048576; };
    const h0 = heap();
    const kit = createShapeActorKit({ clock: new ManualClock(), sound: { play() {} }, haptics: { pulse() {} }, speech: { say() {} } });
    const h1 = heap();
    const c = kit.createController(W, H); c.load({ theme: themes[0], height: H });
    const h2 = heap();
    memory = { kitHeapMB: +(h1 - h0).toFixed(1), worldHeapMB: +(h2 - h1).toFixed(1) };
    console.log(`memory             kit ${memory.kitHeapMB} MB  one world (${themes[0]}) ${memory.worldHeapMB} MB`);
    c.dispose(); void kit;
  }
  const med = (xs: number[]) => +[...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)].toFixed(1);
  const startup = { kitMs: med(kitMs), loadMs: med(loadMs), samples: kitMs.length };
  console.log(`startup            kit build ${startup.kitMs}ms  world open ${startup.loadMs}ms  (median of ${startup.samples})`);
  const out = { kind: 'node', machine: `${process.platform}-${process.arch} node ${process.version}`, viewport: [W, H], themes, rows, startup, memory };
  const file = arg('--out');
  if (file) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(out, null, 1)); }
  else console.log(JSON.stringify(out, null, 1));

  function draw(renderer: any, c: any) {
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, c.world.width, c.world.height));
    calls = 0;
    const spy = new Proxy(canvas, { get(t, p) { const v = t[p]; return typeof v === 'function' ? (...a: unknown[]) => { calls++; return v.apply(t, a); } : v; } });
    renderer.draw(spy, 1);
    const pic = rec.finishRecordingAsPicture();
    // Replay into a phone-sized raster surface at the camera, as the device's UI thread does.
    const [v0] = c.visibleSpan();
    surface ??= Skia.Surface.Make(W, H);
    const sc = surface.getCanvas();
    const t = performance.now();
    sc.save(); sc.translate(-v0, 0); sc.drawPicture(pic); sc.restore();
    surface.flush();
    lastRaster = performance.now() - t;
    pic.dispose?.();
  }
})().catch((e) => { console.error(e); process.exit(1); });
