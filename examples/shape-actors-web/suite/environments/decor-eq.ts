import fs from 'node:fs';
import path from 'node:path';
import { createShapeActorKit } from '/home/user/foundry-mobileapps/packages/shape-actors/src/kit';
import { ManualClock } from '/home/user/foundry-mobileapps/packages/shape-actors/src/core/clock';
import { backdropPlan } from '/home/user/foundry-mobileapps/packages/shape-actors/src/core/backdropPlan';
import { ALL_DECOR } from '/home/user/foundry-mobileapps/packages/shape-actors/src/catalog/decorAll.js';
const B = process.argv[2];
const read = (d: string) => fs.readdirSync(path.join(B, d)).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(B, d, f), 'utf8')));
const old = { blueprints: read('blueprints'), skins: read('skins'), themes: read('themes'), names: { en: JSON.parse(fs.readFileSync(path.join(B, 'names/en.json'), 'utf8')), ar: JSON.parse(fs.readFileSync(path.join(B, 'names/ar.json'), 'utf8')) },
  interactions: JSON.parse(fs.readFileSync(path.join(B, 'interactions.json'), 'utf8')), particles: JSON.parse(fs.readFileSync(path.join(B, 'particles.json'), 'utf8')), cleaning: JSON.parse(fs.readFileSync(path.join(B, 'cleaning.json'), 'utf8')) };
const ports = () => ({ clock: new ManualClock(), random: () => 0.42, sound: { play() {} }, haptics: { pulse() {} }, speech: { say() {} } });
const a = createShapeActorKit({ ...ports(), catalog: old as never });
const b = createShapeActorKit({ ...ports(), decor: ALL_DECOR });
let diff = 0, n = 0;
for (const t of old.themes) {
  for (const zones of [undefined, false] as const) {
    const ca = a.createController(746, 420), cb = b.createController(746, 420);
    ca.load({ theme: t.id, height: 420, ...(zones === false ? { zones: false } : {}) }); cb.load({ theme: t.id, height: 420, ...(zones === false ? { zones: false } : {}) });
    n++;
    if (JSON.stringify(backdropPlan(ca.world)) !== JSON.stringify(backdropPlan(cb.world))) { diff++; if (diff < 6) console.log('DIFF', t.id, zones); }
  }
}
console.log(n, 'loads compared, differences:', diff);
