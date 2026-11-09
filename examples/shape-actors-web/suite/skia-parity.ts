// Usage (repo root): NODE_PATH=node_modules npx tsx packages/shape-actors/scripts/perf/skia-parity.ts [theme,…] [--png dir]
// --png writes, per theme, the native frame at x=1024: chunked, direct and an amplified diff.
// Pixel parity for the chunked backdrop: the stage drawn with backdrop chunks (only chunks near
// the view replayed) must match the same frame with every backdrop op painted directly, at several camera
// positions including tile seams. Exits 1 on any visible difference.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..') + '/';
const require = createRequire(import.meta.url);
(async () => {
  const { LoadSkiaWeb } = require(ROOT + 'node_modules/@shopify/react-native-skia/lib/commonjs/web/LoadSkiaWeb');
  await LoadSkiaWeb();
  const { Skia } = require(ROOT + 'node_modules/@shopify/react-native-skia/lib/commonjs/headless').getSkiaExports();
  const { createShapeActorKit } = require(ROOT + 'packages/shape-actors/src/kit');
  const { ALL_DECOR } = require(ROOT + 'packages/shape-actors/src/catalog/decorAll.js');
  const { ManualClock } = require(ROOT + 'packages/shape-actors/src/core/clock');
  const { SkiaStageRenderer } = require(ROOT + 'packages/shape-actors/src/view/SkiaStageRenderer');
  const W = 390, H = 760;
  let bad = 0;
  const list = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'market,zoo,playground,kitchen';
  for (const theme of list.split(',')) {
    const kit = createShapeActorKit({ decor: ALL_DECOR, clock: new ManualClock(), random: () => 0.42, sound: { play() {} }, haptics: { pulse() {} }, speech: { say() {} } });
    const c = kit.createController(W, H);
    c.load({ theme, height: H });
    const shot = (renderer: any, cam: number, k: number) => {
      c.camera(cam);
      const surface = Skia.Surface.Make(W, H);
      const canvas = surface.getCanvas();
      canvas.translate(-(cam - W / 2), 0);
      renderer.draw(canvas, 1);
      surface.flush();
      return surface.makeImageSnapshot().readPixels(0, 0, { width: W, height: H, colorType: k, alphaType: 1 }) as Uint8Array;
    };
    // Chunked = the real renderer. Whole = the same renderer on a canvas without drawPicture, which
    // paints every backdrop op directly, in order (the reference: no pictures, no culling).
    const chunked = new SkiaStageRenderer(Skia, c);
    const whole = new SkiaStageRenderer(Skia, c);
    const noClip = (canvas: any) => new Proxy(canvas, { get: (t, p) => (p === 'drawPicture' ? undefined : typeof t[p] === 'function' ? t[p].bind(t) : t[p]) });
    const wholeShot = (cam: number) => { c.camera(cam); const s = Skia.Surface.Make(W, H); const cv = s.getCanvas(); cv.translate(-(cam - W / 2), 0); whole.draw(noClip(cv), 1); s.flush(); return s.makeImageSnapshot().readPixels(0, 0, { width: W, height: H, colorType: 4, alphaType: 1 }) as Uint8Array; };
    const cams = [W / 2, 1024, 1024 + 3, 2048 - W / 2 + 1, c.world.width / 2, c.world.width - W / 2];
    const pngAt = process.argv.indexOf('--png');
    if (pngAt > 0) {
      const dir = process.argv[pngAt + 1]; fs.mkdirSync(dir, { recursive: true });
      const save = (name: string, draw: (cv: any) => void) => {
        const surf = Skia.Surface.Make(W, H); const cv = surf.getCanvas(); c.camera(1024); cv.translate(-(1024 - W / 2), 0); draw(cv); surf.flush();
        const img = surf.makeImageSnapshot(); fs.writeFileSync(path.join(dir, `${theme}-${name}.png`), Buffer.from(img.encodeToBytes())); return img.readPixels(0, 0, { width: W, height: H, colorType: 4, alphaType: 1 }) as Uint8Array;
      };
      const a = save('chunked', (cv) => chunked.draw(cv, 1));
      const b = save('whole', (cv) => whole.draw(noClip(cv), 1));
      const diff = Skia.Surface.Make(W, H); const dc = diff.getCanvas(); const paint = Skia.Paint();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const d = Math.min(255, 8 * Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]))); if (d) { paint.setColor(Skia.Color(`rgb(255,${255 - d},${255 - d})`)); dc.drawRect(Skia.XYWHRect(x, y, 1, 1), paint); } }
      diff.flush(); fs.writeFileSync(path.join(dir, `${theme}-diff-x8.png`), Buffer.from(diff.makeImageSnapshot().encodeToBytes()));
    }
    for (const cam of cams) {
      const a = shot(chunked, cam, 4), b = wholeShot(cam);
      let diff = 0, worst = 0;
      for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > 2) diff++; worst = Math.max(worst, d); }
      const ok = diff === 0; // unclipped and in paint order: identical, not merely close
      if (!ok) bad++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${theme.padEnd(12)} camera ${Math.round(cam).toString().padStart(6)}  differing channels ${diff} (worst ${worst})`);
    }
    c.dispose();
  }
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
