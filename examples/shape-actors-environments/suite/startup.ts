// Kit start-up and catalogue parse for ONE foundry-mobileapps checkout.
// Usage (from that checkout's root, so its node_modules resolve):
//   NODE_PATH=node_modules npx tsx <this file> <checkout> [--reps 9] > startup.json
// Measures, median of --reps after one warm-up, all in this process:
//   kitMs[look]        createShapeActorKit({ appearance }) — the catalogue build a host pays before any world
//   kitOpenMarketMs    a kit plus opening the market (the heaviest built-in environment)
//   parseMs / parseMB  JSON.parse of the catalogue string the published bundle ships up front
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(process.argv[2] ?? '.');
const reps = Number(process.argv[process.argv.indexOf('--reps') + 1]) || 9;
const require = createRequire(path.join(root, 'package.json'));
const pkg = path.join(root, 'packages/shape-actors');
const { createShapeActorKit } = require(path.join(pkg, 'src/kit'));
const { ManualClock } = require(path.join(pkg, 'src/core/clock'));
const quiet = { sound: { play() {} }, haptics: { pulse() {} }, speech: { say() {} }, decor: false };
const median = (f: () => void) => { f(); const t: number[] = []; for (let i = 0; i < reps; i++) { const a = performance.now(); f(); t.push(performance.now() - a); } t.sort((x, y) => x - y); return +t[reps >> 1].toFixed(1); };

(async () => {
  const kitMs: Record<string, number> = {};
  for (const look of ['original', 'round-friends-color'] as const) kitMs[look] = median(() => createShapeActorKit({ ...quiet, ...(look === 'original' ? {} : { appearance: look }) }));
  const kitOpenMarketMs = median(() => { const k = createShapeActorKit({ ...quiet, clock: new ManualClock(), appearance: 'round-friends-color' }); k.createController(390, 760).load({ theme: 'market', height: 760 }); });
  const { catalogModule } = await import(path.join(pkg, 'scripts/catalog-bundle.mjs'));
  const src: string = await catalogModule(path.join(pkg, 'src/catalog/index.js'));
  // The first statement is `export const BUILTIN_CATALOG = JSON.parse("<catalogue>");`.
  const at = src.indexOf('JSON.parse(') + 'JSON.parse('.length;
  const str = JSON.parse(src.slice(at, src.indexOf(');\n', at)));
  const parseMs = median(() => JSON.parse(str));
  const version = require(path.join(pkg, 'package.json')).version;
  console.log(JSON.stringify({ kind: 'startup', version, node: process.version, reps, kitMs, kitOpenMarketMs, parseMB: +(str.length / 1e6).toFixed(2), parseMs }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
