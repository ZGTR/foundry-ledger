#!/usr/bin/env node
// The shape-actors performance suite: one command, every rail, every edge case.
//
//   npm run perf                       node rails (engine + Skia) and the web rail, gated
//   npm run perf -- --quick            3 themes, 1 rep, low device only (a fast local check)
//   npm run perf -- --only node        just the engine + Skia rails (no browser)
//   npm run perf -- --only web --devices low,mid --themes market --scenarios drag-slow,drag-hold
//   npm run perf -- --all              every theme in the catalogue on the node rails
//   npm run perf -- --update-baseline  record this run's web numbers as the ratchet baseline
//   npm run perf -- --strict           also fail on the absolute web targets (real devices / GPU runners)
//
// Writes perf-results/<stamp>/{node.json,web.json,report.md}. Exit 0 = within budget,
// 1 = over budget, 3 = a rail could not run (named skip, not a pass).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const budgets = JSON.parse(fs.readFileSync(path.join(HERE, 'budgets.json'), 'utf8'));
const BASELINE = path.join(HERE, 'perf-baseline.json');
const SLOWDOWN = { high: 1.5, mid: 3, low: 6 };

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.resolve(arg('--out') ?? path.join(ROOT, 'perf-results', stamp));
fs.mkdirSync(outDir, { recursive: true });
const only = arg('--only');
const quick = has('--quick');
const failures = [], skips = [], notes = [];
const report = [`# Shape-actors performance report`, '', `Run ${stamp} on ${process.platform}-${process.arch}, node ${process.version}.`, ''];

// ---- node rails: engine + Skia recording -------------------------------------------------
if (!only || only === 'node') {
  const args = ['tsx', path.join(HERE, 'node-bench.ts'), '--out', path.join(outDir, 'node.json')];
  if (has('--all')) args.push('--all');
  else if (arg('--themes')) args.push('--themes', arg('--themes'));
  else if (quick) args.push('--themes', 'playground,market,zoo');
  if (arg('--scenarios')) args.push('--scenarios', arg('--scenarios'));
  const r = spawnSync('npx', args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NODE_PATH: path.join(ROOT, 'node_modules'), NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --expose-gc`.trim() } });
  if (r.status !== 0) skips.push(`node rails did not run (exit ${r.status})`);
  else {
    const node = JSON.parse(fs.readFileSync(path.join(outDir, 'node.json'), 'utf8'));
    const devs = ['low', 'mid', 'high'];
    const prior = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')).node : undefined;
    const before = new Map((prior?.rows ?? []).map((r) => [r.scenario, r]));
    const ntol = 1 + budgets.node.ratchetTolerancePct / 100;
    report.push('## Engine + Skia recording (JS thread), projected per device class', '',
      `Measured on this runner, then × the device's CPU slowdown (low ${SLOWDOWN.low}×, mid ${SLOWDOWN.mid}×, high ${SLOWDOWN.high}×). Gated: no regression vs perf-baseline.json (${budgets.node.ratchetTolerancePct}% + ${budgets.node.noiseFloorMs} ms floor). Absolute projections (budgets.json) are gated only with --strict: a slow shared VM is not a phone CPU.`, '',
      '| scenario | engine p95 | record p95 | raster p95 (info) | canvas calls p95 | allocs p95 | low-end JS / frame | verdict |', '|---|---:|---:|---:|---:|---:|---:|---|');
    for (const row of node.rows) {
      const bad = [], over = [];
      // Gate: no regression against the recorded baseline (tolerance + an absolute noise floor).
      const p = before.get(row.scenario);
      if (p) {
        if (row.engineMs.p95 > p.engineMs.p95 * ntol && row.engineMs.p95 - p.engineMs.p95 > budgets.node.noiseFloorMs) bad.push(`engine p95 ${p.engineMs.p95} → ${row.engineMs.p95} ms`);
        if (row.renderMs && p.renderMs && row.renderMs.p95 > p.renderMs.p95 * ntol && row.renderMs.p95 - p.renderMs.p95 > budgets.node.noiseFloorMs) bad.push(`record p95 ${p.renderMs.p95} → ${row.renderMs.p95} ms`);
      }
      for (const d of devs) {
        const e = row.engineMs.p95 * SLOWDOWN[d], rec = (row.renderMs?.p95 ?? 0) * SLOWDOWN[d];
        if (e > budgets.node.engineP95ProjectedMs[d]) over.push(`engine ${d} ${e.toFixed(1)}ms > ${budgets.node.engineP95ProjectedMs[d]}ms`);
        if (row.renderMs && rec > budgets.node.recordP95ProjectedMs[d]) over.push(`record ${d} ${rec.toFixed(1)}ms > ${budgets.node.recordP95ProjectedMs[d]}ms`);
      }
      if (row.canvasCallsPerFrame && row.canvasCallsPerFrame.p95 > budgets.node.canvasCallsP95) over.push(`canvas calls ${row.canvasCallsPerFrame.p95} > ${budgets.node.canvasCallsP95}`);
      if (row.allocsPerFrame && row.allocsPerFrame.p95 > budgets.node.allocsP95) over.push(`allocs ${row.allocsPerFrame.p95} > ${budgets.node.allocsP95}`);
      for (const b of bad) failures.push(`${row.scenario}: regressed ${b} (worst theme ${row.worstTheme.theme})`);
      if (has('--strict')) for (const o of over) failures.push(`${row.scenario}: ${o}`);
      const js = (row.engineMs.p95 + (row.renderMs?.p95 ?? 0)) * SLOWDOWN.low;
      report.push(`| ${row.scenario} | ${row.engineMs.p95.toFixed(2)} ms | ${row.renderMs?.p95.toFixed(2) ?? '–'} ms | ${row.rasterMs?.p95.toFixed(1) ?? '–'} ms | ${row.canvasCallsPerFrame?.p95 ?? '–'} | ${row.allocsPerFrame?.p95 ?? '–'} | ${js.toFixed(1)} ms of ${budgets.frameMs} | ${bad.length ? 'REGRESSED' : over.length ? `ok (projection over: ${over.length})` : 'ok'} |`);
    }
    report.push('', '_Raster is CanvasKit software rasterisation on the runner: relative only (a device GPU fills translucent layers far faster)._', '');
    if (node.startup) {
      const st = node.startup, ps = prior ? fs.existsSync(BASELINE) && JSON.parse(fs.readFileSync(BASELINE, 'utf8')).node?.startup : undefined;
      report.push('## Startup (main thread blocked before the first world can open)', '',
        '| | this runner | low-end projection | baseline |', '|---|---:|---:|---:|',
        `| kit build (catalogue) | ${st.kitMs} ms | ${(st.kitMs * SLOWDOWN.low / 1000).toFixed(1)} s | ${ps ? `${ps.kitMs} ms` : '–'} |`,
        `| world open | ${st.loadMs} ms | ${(st.loadMs * SLOWDOWN.low).toFixed(0)} ms | ${ps ? `${ps.loadMs} ms` : '–'} |`, '');
      if (ps && st.kitMs > ps.kitMs * ntol && st.kitMs - ps.kitMs > 50) failures.push(`startup: kit build ${ps.kitMs} → ${st.kitMs} ms`);
      if (ps && st.loadMs > ps.loadMs * ntol && st.loadMs - ps.loadMs > 5) failures.push(`startup: world open ${ps.loadMs} → ${st.loadMs} ms`);
    }
    if (node.memory) {
      const pmem = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')).node?.memory : undefined;
      report.push('## Memory (engine, after GC)', '', '| | this run | baseline |', '|---|---:|---:|',
        `| one kit (catalogue) | ${node.memory.kitHeapMB} MB | ${pmem ? `${pmem.kitHeapMB} MB` : '–'} |`,
        `| one loaded world | ${node.memory.worldHeapMB} MB | ${pmem ? `${pmem.worldHeapMB} MB` : '–'} |`, '');
      if (pmem && node.memory.kitHeapMB > pmem.kitHeapMB * 1.15 + 2) failures.push(`memory: kit ${pmem.kitHeapMB} → ${node.memory.kitHeapMB} MB`);
      if (pmem && node.memory.worldHeapMB > pmem.worldHeapMB * 1.15 + 1) failures.push(`memory: world ${pmem.worldHeapMB} → ${node.memory.worldHeapMB} MB`);
    }
  }
}

// ---- web rail: real Chromium, CPU-throttled, real touch/mouse --------------------------------
if (!only || only === 'web') {
  const args = [path.join(HERE, 'web-bench.mjs'), '--out', path.join(outDir, 'web.json'), '--reps', arg('--reps') ?? (quick ? '1' : '3')];
  args.push('--devices', arg('--devices') ?? (quick ? 'low' : 'low,mid,high'));
  args.push('--themes', arg('--themes') ?? (quick ? 'playground' : 'playground,market,zoo'));
  if (arg('--scenarios')) args.push('--scenarios', arg('--scenarios'));
  if (arg('--dist')) args.push('--dist', arg('--dist'));
  const r = spawnSync('node', args, { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) skips.push(`web rail did not run (exit ${r.status}; set SHAPE_ACTORS_CHROMIUM to a Chromium binary if Playwright's own is missing)`);
  else {
    const web = JSON.parse(fs.readFileSync(path.join(outDir, 'web.json'), 'utf8'));
    const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : undefined;
    const key = (r) => `${r.device}|${r.theme}|${r.scenario}`;
    const prior = new Map((base?.rows ?? []).map((r) => [key(r), r]));
    const tol = 1 + budgets.web.ratchetTolerancePct / 100;
    report.push('## Web stage (real Chromium, DevTools CPU throttling, real input)', '',
      base ? `Ratchet: each cell must stay within ${budgets.web.ratchetTolerancePct}% of perf-baseline.json (${base.recorded ?? 'unknown date'}).` : 'No perf-baseline.json yet: run with --update-baseline to record one.', '',
      '| device | theme | scenario | frame p95 | dropped | input→frame p95 | long frames | vs baseline (dropped) | target |', '|---|---|---|---:|---:|---:|---:|---:|---|');
    for (const row of web.rows) {
      const t = budgets.web.targets[row.device];
      const meets = row.droppedPct <= t.droppedPct && (row.scenario === 'idle' || row.inputLatencyMs.p95 <= t.inputLatencyP95Ms);
      const p = prior.get(key(row));
      let vs = '–';
      if (p) {
        // A regression must be real: over tolerance AND more than 3 points of dropped frames.
        const worse = row.droppedPct > p.droppedPct * tol && row.droppedPct - p.droppedPct > 3;
        const lagWorse = row.scenario !== 'idle' && row.inputLatencyMs.p95 > p.inputLatencyMs.p95 * tol && row.inputLatencyMs.p95 - p.inputLatencyMs.p95 > 8;
        vs = `${p.droppedPct}% → ${row.droppedPct}%`;
        if (worse || lagWorse) failures.push(`web ${key(row)} regressed: dropped ${p.droppedPct}% → ${row.droppedPct}%, input p95 ${p.inputLatencyMs.p95} → ${row.inputLatencyMs.p95} ms`);
      }
      if (!meets && has('--strict')) failures.push(`web ${key(row)} misses its ${row.device} target (dropped ${row.droppedPct}% / input p95 ${row.inputLatencyMs.p95} ms)`);
      report.push(`| ${row.device} | ${row.theme} | ${row.scenario} | ${row.frameMs.p95} ms | ${row.droppedPct}% | ${row.inputLatencyMs.p95} ms | ${row.longFrames} | ${vs} | ${meets ? 'met' : 'missed'} |`);
    }
    if (has('--update-baseline')) recordBaseline({ rows: web.rows });
    if (web.opens?.length) {
      report.push('', '### World open and memory (web, after GC)', '', '| device | theme | world open | JS heap | DOM nodes |', '|---|---|---:|---:|---:|');
      for (const o of web.opens) report.push(`| ${o.device} | ${o.theme} | ${o.openMs} ms | ${o.jsHeapMB} MB | ${o.domNodes} |`);
    }
    report.push('', '_Targets are what a real device must reach; a GPU-less VM composites in software, so here they are reported, and gated only with --strict._', '');
  }
}

if (has('--update-baseline') && fs.existsSync(path.join(outDir, 'node.json'))) { const n = JSON.parse(fs.readFileSync(path.join(outDir, 'node.json'), 'utf8')); recordBaseline({ node: { rows: n.rows, startup: n.startup, memory: n.memory } }); }

/** Merge this run's rows into perf-baseline.json (the web rows stay top-level `rows`). */
function recordBaseline(part) {
  const cur = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
  fs.writeFileSync(BASELINE, JSON.stringify({ ...cur, ...part, recorded: stamp, machine: `${process.platform}-${process.arch}` }, null, 1));
  notes.push(`baseline recorded → ${path.relative(ROOT, BASELINE)}`);
}

report.push('## Verdict', '', failures.length ? failures.map((f) => `- OVER: ${f}`).join('\n') : '- All gated budgets met.', ...skips.map((s) => `- SKIPPED: ${s}`), ...notes.map((n) => `- ${n}`), '');
fs.writeFileSync(path.join(outDir, 'report.md'), report.join('\n'));
console.log(`\nreport → ${path.relative(ROOT, path.join(outDir, 'report.md'))}`);
for (const f of failures) console.log(`OVER  ${f}`);
for (const s of skips) console.log(`SKIP  ${s}`);
process.exit(failures.length ? 1 : skips.length ? 3 : 0);
