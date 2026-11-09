// tsx sheet.ts out.png id,id,... [appearance] [cols]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const R = '/home/user/foundry-mobileapps/';
const require = createRequire(R + 'package.json');
const { LoadSkiaWeb } = require(R + 'node_modules/@shopify/react-native-skia/lib/commonjs/web/LoadSkiaWeb');
(async () => {
  await LoadSkiaWeb();
  const H = require(R + 'node_modules/@shopify/react-native-skia/lib/commonjs/headless');
  const { Skia } = H.getSkiaExports();
  const { createShapeActorKit } = require(R + 'packages/shape-actors/src/kit');
  const { SkiaStageRenderer } = require(R + 'packages/shape-actors/src/view/SkiaStageRenderer');
  const { ManualClock } = require(R + 'packages/shape-actors/src/core/clock');
  const [out, list, appearance = 'round-friends-color', colsS = '8'] = process.argv.slice(2);
  const ids = list.split(','); const cols = +colsS, T = 220;
  const rows = Math.ceil(ids.length / cols);
  const surf = H.makeOffscreenSurface(cols * T, rows * T); const cv = surf.getCanvas(); cv.clear(Skia.Color('#FFFDF7'));
  const clock = new ManualClock();
  const kit = createShapeActorKit({ clock, random: () => 0.42, sound: { play() {} }, haptics: { pulse() {} }, speech: { say() {} }, ...(appearance === 'original' ? {} : { appearance }) });
  ids.forEach((id, i) => {
    const c = kit.createController(T, T);
    c.load({ actors: [{ blueprint: id }], height: T, fit: true, zones: false, doors: false, reducedMotion: true, minSize: false, feel: { alive: false, greet: false, quest: 0, fun: false, sleep: 0 }, backdrop: { sky: '#FFFDF7', ground: '#F3EEDD', groundY: 0.92, decor: [] } });
    c.start(); clock.advance(0.5);
    cv.save(); cv.translate((i % cols) * T, Math.floor(i / cols) * T);
    cv.clipRect(Skia.XYWHRect(0, 0, T, T), 1, true);
    new SkiaStageRenderer(Skia, c).draw(cv, T / c.world.width);
    cv.restore(); c.destroy?.();
  });
  surf.flush(); fs.writeFileSync(out, surf.makeImageSnapshot().encodeToBytes());
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
