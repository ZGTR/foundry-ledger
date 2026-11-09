// Published bundle size for ONE checkout: builds packages/shape-actors (npm run build) and sums
// dist/: what an app loads up front vs the per-environment scenery chunks fetched on demand.
// Usage: node bundle.mjs <checkout> > bundle.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
const pkg = path.join(path.resolve(process.argv[2] ?? '.'), 'packages/shape-actors');
execFileSync('npm', ['run', '-s', 'build'], { cwd: pkg, stdio: ['ignore', 'ignore', 'inherit'] });
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
walk(path.join(pkg, 'dist'));
const decorDir = path.join(pkg, 'src/catalog/decor');
const decorNames = new Set(fs.existsSync(decorDir) ? fs.readdirSync(decorDir).map((f) => f.replace('.json', '')) : []);
// A scenery chunk is named after its environment (chunks/<theme>-<hash>.js).
const isDecor = (p) => path.basename(path.dirname(p)) === 'chunks' && decorNames.has(path.basename(p).replace(/-[A-Z0-9]{8}\.js$/, ''));
const sum = (list) => { let raw = 0, gz = 0; for (const p of list) { const b = fs.readFileSync(p); raw += b.length; gz += zlib.gzipSync(b, { level: 9 }).length; } return { files: list.length, MB: +(raw / 1e6).toFixed(2), gzipMB: +(gz / 1e6).toFixed(2) }; };
const version = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')).version;
console.log(JSON.stringify({ kind: 'bundle', version, upFront: sum(files.filter((p) => !isDecor(p))), sceneryChunks: sum(files.filter(isDecor)) }, null, 2));
