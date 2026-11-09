// Usage: NODE_PATH=node_modules npx tsx packages/shape-actors/scripts/proof/perf-rig.ts [theme,…] [--json out.json]
// The rig under load, on a phone stage (390 × 760): every carrier in the environment is loaded
// (two things per carrier where there are enough), then for 600 frames the child drives one
// carrier after another across the stage while the others are tapped (their bones animate). Each
// frame times the engine tick (which runs the rig pass), the rig pass alone, and the native draw
// (SkiaStageRenderer → picture, the iOS/Android path). The same scene with nothing loaded is the
// baseline, so the rig's share is the difference. A phone is ~4× slower than this machine: the
// frame budget here is 16.7 ms / 4 ≈ 4 ms for tick + draw.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..') + '/';
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const JSON_OUT = jsonAt >= 0 ? args[jsonAt + 1] : undefined;
const LIST = args.find((a, i) => !a.startsWith('--') && (jsonAt < 0 || i !== jsonAt + 1));
const { LoadSkiaWeb } = require(R + 'node_modules/@shopify/react-native-skia/lib/commonjs/web/LoadSkiaWeb');

const DEFAULT = ['veh-roads', 'veh-airport', 'veh-harbour', 'veh-railway', 'vehicle-show', 'haul-site', 'haul-farm', 'close-haul-crane', 'close-haul-dump', 'close-haul-pickup', 'close-build-car', 'close-vehroad-bike-garage', 'construction', 'farm', 'harbor'];
const W = 390, HG = 760, FRAMES = 600, WARM = 30;

type Stats = { mean: number; p95: number; max: number };
const stats = (xs: number[]): Stats => { const s = xs.slice(WARM).sort((a, b) => a - b); return { mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(3), p95: +s[Math.floor(s.length * 0.95)].toFixed(3), max: +s[s.length - 1].toFixed(3) }; };

(async () => {
  await LoadSkiaWeb();
  const H = require(R + 'node_modules/@shopify/react-native-skia/lib/commonjs/headless');
  const { Skia } = H.getSkiaExports();
  const { createShapeActorKit } = require(R + 'packages/shape-actors/src/kit');
  const { ALL_DECOR } = require(R + 'packages/shape-actors/src/catalog/decorAll.js');
  const { SkiaStageRenderer } = require(R + 'packages/shape-actors/src/view/SkiaStageRenderer');
  const { ManualClock } = require(R + 'packages/shape-actors/src/core/clock');
  const quiet = { sound: { play() {} }, haptics: { pulse() {} }, speech: { say() {} } };
  const probe = createShapeActorKit({ decor: ALL_DECOR, clock: new ManualClock(), ...quiet });
  const themes = LIST ? LIST.split(',') : DEFAULT.filter((t) => probe.catalog.themes.has?.(t) ?? probe.catalog.themes.ids().includes(t));

  const run = (theme: string, loaded: boolean) => {
    let seed = 11; const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const clock = new ManualClock();
    const kit = createShapeActorKit({ decor: ALL_DECOR, clock, random, ...quiet });
    const c = kit.createController(W, HG);
    c.load({ theme, height: HG, feel: { quest: 0, sleep: 0, greet: false } });
    c.start(); clock.advance(0.3);
    const ic = (c as any).interactions;
    const real = (a: any) => { const m = a.blueprint.metrics; const h = a.blueprint.realHeight ?? 0.3; return h * h * (m.width / m.height); };
    const carriers = c.cast.filter((a: any) => a.blueprint.traits?.cargo?.length && !a.body.hidden);
    let riders = 0;
    if (loaded) {
      const free = new Set(c.cast.filter((a: any) => !a.body.hidden && !a.body.restOn && a.draggable && a.mode === 'grounded' && !a.blueprint.traits?.cargo?.length).map((a: any) => a.id));
      for (const host of carriers) {
        for (const spot of host.blueprint.traits.cargo.slice(0, 2)) {
          const rider = c.cast.filter((a: any) => free.has(a.id) && real(a) < real(host) * 0.4).sort((p: any, q: any) => Math.abs(p.body.x - host.body.x) - Math.abs(q.body.x - host.body.x))[0];
          if (!rider) continue;
          free.delete(rider.id);
          ic.lift(rider);
          const [x0, y0, x1] = host.bounds();
          ic.load(rider, host, spot, (x0 + x1) / 2, y0, (c as any).config);
          if (rider.body.restOn === host.id) riders++;
        }
      }
      clock.advance(0.5);
    }
    const r = new SkiaStageRenderer(Skia, c);
    const rig = (c as any).rig; const applyOrig = rig.apply.bind(rig); let rigMs = 0;
    rig.apply = (...a: unknown[]) => { const t = performance.now(); const out = applyOrig(...a); rigMs += performance.now() - t; return out; };
    const drivable = carriers.filter((a: any) => a.draggable && !a.body.hidden);
    const tick: number[] = [], draw: number[] = [], rigF: number[] = [];
    let drive: any; let t = 1000;
    for (let f = 0; f < FRAMES; f++) {
      // Drive a carrier for 90 frames, then the next one; the camera follows it.
      if (f % 90 === 0 && drivable.length) {
        if (drive) c.pointerUp(drive.x, drive.y, t);
        const host = drivable[(f / 90) % drivable.length | 0];
        const [x0, y0, x1, y1] = host.bounds(); drive = { x: (x0 + x1) / 2, y: y0 + (y1 - y0) * 0.85, host };
        c.camera(drive.x); c.pointerDown(drive.x, drive.y, t, host.id);
      }
      if (drive) { drive.x += Math.sin(f / 9) * 6 + 2; drive.y += Math.cos(f / 7) * 2; c.pointerMove(drive.x, drive.y, t); }
      // Tap another carrier every 20 frames: its parts animate and its riders follow the bones.
      if (f % 20 === 10 && carriers.length > 1) { const a = carriers[(f / 20) % carriers.length | 0]; if (a !== drive?.host) { const [x0, y0, x1, y1] = a.bounds(); c.pointerDown((x0 + x1) / 2, (y0 + y1) / 2, t, a.id); c.pointerUp((x0 + x1) / 2, (y0 + y1) / 2, t + 30); } }
      t += 16;
      rigMs = 0;
      let t0 = performance.now(); clock.advance(1 / 60); tick.push(performance.now() - t0); rigF.push(rigMs);
      const rec = Skia.PictureRecorder();
      const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, W, HG));
      t0 = performance.now(); r.draw(canvas, 1); draw.push(performance.now() - t0);
      rec.finishRecordingAsPicture().dispose?.();
    }
    const frame = tick.map((x, i) => x + draw[i]);
    const worst = frame.map((x, i) => ({ f: i, tick: +tick[i].toFixed(2), draw: +draw[i].toFixed(2), rig: +rigF[i].toFixed(3) })).slice(WARM).sort((a, b) => (b.tick + b.draw) - (a.tick + a.draw)).slice(0, 4);
    const out = { actors: c.cast.length, carriers: carriers.length, riders, tick: stats(tick), rig: stats(rigF), draw: stats(draw), frame: stats(frame), over4ms: frame.slice(WARM).filter((x) => x > 4).length, worst };
    c.dispose();
    return out;
  };

  const rows: Record<string, unknown>[] = [];
  for (const theme of themes) {
    const base = run(theme, false), load = run(theme, true);
    const row = { theme, actors: load.actors, carriers: load.carriers, riders: load.riders, base: { tick: base.tick, draw: base.draw, frame: base.frame, over4ms: base.over4ms, worst: base.worst }, loaded: load };
    rows.push(row);
    console.log(`${theme.padEnd(26)} riders ${String(load.riders).padStart(3)}  frame p95 ${base.frame.p95.toFixed(2)} → ${load.frame.p95.toFixed(2)} ms (max ${load.frame.max.toFixed(2)})  tick p95 ${base.tick.p95.toFixed(2)} → ${load.tick.p95.toFixed(2)}  rig p95 ${load.rig.p95.toFixed(3)}  draw p95 ${base.draw.p95.toFixed(2)} → ${load.draw.p95.toFixed(2)}  frames>4ms ${base.over4ms} → ${load.over4ms}`);
    if (process.env.PERF_WORST) console.log('   base worst', JSON.stringify(base.worst), '\n   load worst', JSON.stringify(load.worst));
  }
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(rows, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
