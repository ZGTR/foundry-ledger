// Interaction scenarios shared by every perf runner (engine, Skia renderer, web browser).
// Each one is a deterministic script of pointer input, driven per frame, so the same edge
// case is measured the same way on every rail and every run.
import type { StageController } from '../../src/controller/StageController';
import type { ActorController } from '../../src/controller/ActorController';

export interface Input { down(x: number, y: number, t: number, actor?: string): void; move(x: number, y: number, t: number): void; up(x: number, y: number, t: number): void; camera?(x: number): void }

export interface Scenario {
  name: string;
  /** What it stresses, in a sentence (printed in the report). */
  why: string;
  frames: number;
  /** Pointer events per 60 Hz frame (2 = a 120 Hz screen, 4 = a 240 Hz stylus/iPad digitiser). */
  movesPerFrame: number;
  /** Called once per frame before the tick; `t` is ms. */
  step(c: StageController, f: number, t: number, input: Input, state: Record<string, unknown>): void;
}

const centre = (a: ActorController): [number, number] => { const [x0, y0, x1, y1] = a.bounds(); return [(x0 + x1) / 2, (y0 + y1) / 2]; };
export const inView = (c: StageController) => { const [v0, v1] = c.visibleSpan(); return c.cast.filter((a) => !a.body.hidden && a.body.x > v0 && a.body.x < v1); };
/** The draggable actor nearest the middle of the view (the one a child would reach for). */
export function heldCandidate(c: StageController): ActorController | undefined {
  const [v0, v1] = c.visibleSpan(); const mid = (v0 + v1) / 2;
  return inView(c).filter((a) => a.draggable).sort((a, b) => Math.abs(a.body.x - mid) - Math.abs(b.body.x - mid))[0]
    ?? c.cast.find((a) => a.draggable && !a.body.hidden);
}

/** Grab at frame 0, follow `path(f)` for every sub-frame move, release at the end. */
function dragScenario(name: string, why: string, frames: number, movesPerFrame: number, path: (f: number, x0: number, y0: number, c: StageController) => [number, number]): Scenario {
  return {
    name, why, frames, movesPerFrame,
    step(c, f, t, input, s) {
      if (f === 0) {
        const a = heldCandidate(c); if (!a) return;
        const [x, y] = centre(a); s.x0 = x; s.y0 = y; s.id = a.id;
        input.down(x, y, t, a.id); return;
      }
      if (s.id === undefined) return;
      if (f === frames - 1) { const [x, y] = path(f, s.x0 as number, s.y0 as number, c); input.up(x, y, t); return; }
      for (let k = 1; k <= movesPerFrame; k++) {
        const ff = f - 1 + k / movesPerFrame;
        const [x, y] = path(ff, s.x0 as number, s.y0 as number, c);
        input.move(x, y, t - 16.67 + (16.67 * k) / movesPerFrame);
      }
    },
  };
}

const clampY = (c: StageController, y: number) => Math.max(20, Math.min(c.world.height - 20, y));

export const SCENARIOS: Scenario[] = [
  { name: 'idle', why: 'no input: breathing, ambience, life (the floor every other case adds to)', frames: 300, movesPerFrame: 0, step() {} },
  dragScenario('drag-slow', 'a careful child: 2 px per frame, hover and spotlight on the whole time', 300, 1,
    (f, x0, y0, c) => [x0 + f * 2, clampY(c, y0 - Math.sin(f / 30) * 60)]),
  dragScenario('drag-fast', 'a wild zigzag: 40 px per frame across the view', 300, 1,
    (f, x0, y0, c) => { const [v0, v1] = c.visibleSpan(); const w = v1 - v0; return [v0 + ((x0 - v0 + f * 40) % w + w) % w, clampY(c, y0 + Math.sin(f / 4) * 160)]; }),
  dragScenario('drag-120hz', 'a 120 Hz phone: two pointer events per frame', 300, 2,
    (f, x0, y0, c) => [x0 + Math.sin(f / 20) * 140, clampY(c, y0 - Math.abs(Math.sin(f / 15)) * 120)]),
  dragScenario('drag-240hz', 'an iPad digitiser: four pointer events per frame', 300, 4,
    (f, x0, y0, c) => [x0 + Math.sin(f / 20) * 140, clampY(c, y0 - Math.abs(Math.sin(f / 15)) * 120)]),
  {
    name: 'drag-over-targets', why: 'carry one object over every other object in view (hover target changes each visit)', frames: 360, movesPerFrame: 2,
    step(c, f, t, input, s) {
      if (f === 0) {
        const a = heldCandidate(c); if (!a) return; const [x, y] = centre(a); s.id = a.id;
        s.stops = inView(c).filter((b) => b !== a).map(centre); s.at = [x, y]; input.down(x, y, t, a.id); return;
      }
      const stops = s.stops as [number, number][] | undefined; if (!stops?.length) return;
      const [tx, ty] = stops[Math.floor(f / 24) % stops.length];
      const at = s.at as [number, number];
      if (f === 359) { input.up(at[0], at[1], t); return; }
      for (let k = 0; k < 2; k++) { at[0] += (tx - at[0]) * 0.18; at[1] += (ty - at[1]) * 0.18; input.move(at[0], at[1], t - 8 + k * 8); }
    },
  },
  dragScenario('drag-hold', 'grab and hold nearly still for 6 s (spotlight + beckon pulses, finger jitter)', 360, 1,
    (f, x0, y0) => [x0 + 30 + Math.sin(f) * 1.5, y0 - 40 + Math.cos(f * 1.3) * 1.5]),
  {
    name: 'throw-spam', why: 'grab, flick, release every 18 frames (landings, haptics, particles)', frames: 360, movesPerFrame: 1,
    step(c, f, t, input) {
      const p = f % 18;
      if (p === 0) { const a = heldCandidate(c); if (!a) return; const [x, y] = centre(a); input.down(x, y, t, a.id); }
      else if (p < 4) { const a = c.cast.find((x) => x.body.grab); if (!a) return; input.move(a.body.x + p * 50, a.body.y - p * 70, t); }
      else if (p === 4) { const a = c.cast.find((x) => x.body.grab); if (a) input.up(a.body.x + 200, a.body.y - 280, t); }
    },
  },
  {
    name: 'drag-with-taps', why: 'drag while every 6th frame something else is tapped (particle + reaction storm)', frames: 300, movesPerFrame: 1,
    step(c, f, t, input, s) {
      // Interleaved gestures are one pointer at a time in the controller; alternate drag bursts and taps.
      const cast = inView(c);
      if (f % 6 === 0 && cast.length) {
        if (s.held) { const [x, y] = s.held as [number, number]; input.up(x, y, t); s.held = undefined; }
        const a = cast[(f / 6) % cast.length | 0]; const [x, y] = centre(a); input.down(x, y, t, a.id); input.up(x, y, t + 30); return;
      }
      if (f % 6 === 1) { const a = heldCandidate(c); if (!a) return; const [x, y] = centre(a); input.down(x, y, t, a.id); s.held = [x, y]; return; }
      if (s.held) { const h = s.held as [number, number]; h[0] += 22; h[1] -= 6; input.move(h[0], h[1], t); }
    },
  },
  {
    name: 'drag-scroll', why: 'drag while the world scrolls under the finger (edge auto-scroll / camera every frame)', frames: 300, movesPerFrame: 1,
    step(c, f, t, input, s) {
      if (f === 0) { const a = heldCandidate(c); if (!a) return; const [x, y] = centre(a); s.p = [x, y]; s.cam = (c.visibleSpan()[0] + c.visibleSpan()[1]) / 2; input.down(x, y, t, a.id); return; }
      const p = s.p as [number, number] | undefined; if (!p) return;
      const step = Math.min(9, Math.max(0, c.world.width - (s.cam as number) - 200) / 300);
      s.cam = (s.cam as number) + step; input.camera?.(s.cam as number);
      p[0] += step;
      if (f === 299) input.up(p[0], p[1], t); else input.move(p[0], p[1] + Math.sin(f / 9) * 4, t);
    },
  },
  {
    name: 'tap-spam', why: 'ten taps a second on whatever is in view (reactions, word cards, speech)', frames: 300, movesPerFrame: 0,
    step(c, f, t, input) { if (f % 6) return; const cast = inView(c); const a = cast[(f / 6) % Math.max(1, cast.length) | 0]; if (!a) return; const [x, y] = centre(a); input.down(x, y, t, a.id); input.up(x, y, t + 40); },
  },
  {
    name: 'swipe-nudge', why: 'background swipes back and forth (the whole cast reacts)', frames: 300, movesPerFrame: 2,
    step(c, f, t, input) {
      const p = f % 30; const [v0, v1] = c.visibleSpan(); const y = c.world.height * 0.15;
      if (p === 0) input.down((v0 + v1) / 2, y, t);
      else if (p < 10) for (let k = 0; k < 2; k++) input.move((v0 + v1) / 2 + (p * 2 + k) * 14 * (f % 60 < 30 ? 1 : -1), y, t - 8 + k * 8);
      else if (p === 10) input.up((v0 + v1) / 2 + 260, y, t);
    },
  },
  {
    name: 'drop-chain', why: 'drag each draggable onto its nearest partner and drop (snaps, stacks, celebrations)', frames: 360, movesPerFrame: 1,
    step(c, f, t, input, s) {
      const p = f % 30;
      if (p === 0) {
        const movers = inView(c).filter((a) => a.draggable); const a = movers[(f / 30) % Math.max(1, movers.length) | 0]; if (!a) return;
        const others = inView(c).filter((b) => b !== a);
        const b = others.sort((m, n) => Math.hypot(m.body.x - a.body.x, m.body.y - a.body.y) - Math.hypot(n.body.x - a.body.x, n.body.y - a.body.y))[0];
        const [x, y] = centre(a); s.from = [x, y]; s.to = b ? centre(b) : [x + 100, y]; input.down(x, y, t, a.id); return;
      }
      const from = s.from as [number, number] | undefined; const to = s.to as [number, number] | undefined; if (!from || !to) return;
      const k = Math.min(1, p / 20); const x = from[0] + (to[0] - from[0]) * k, y = from[1] + (to[1] - from[1]) * k;
      if (p === 22) input.up(x, y, t); else if (p < 22) input.move(x, y, t);
    },
  },
];

/**
 * The worlds measured by default: the Dunyati product's ten worlds' environments plus the
 * heaviest scenes in the catalogue (largest cast / widest world). `--all` measures every theme.
 */
export const DEFAULT_THEMES = ['playground', 'market', 'library', 'museum', 'music', 'mosque', 'close-garden-potting', 'close-job-vet', 'in-toolbox', 'zoo', 'farm', 'kitchen'];

/** Device classes the projection uses. `slowdown` = how much slower than this machine's CPU. */
export const DEVICES = {
  high: { label: 'high-end (A17 / Snapdragon 8 Gen 2, 120 Hz)', slowdown: 1.5, hz: 120 },
  mid: { label: 'mid-range (Snapdragon 7-series, 90 Hz)', slowdown: 3, hz: 90 },
  low: { label: 'low-end (Helio G35 / Snapdragon 4xx, 60 Hz)', slowdown: 6, hz: 60 },
} as const;
export type DeviceClass = keyof typeof DEVICES;

export function stats(samples: number[]): { mean: number; p50: number; p95: number; p99: number; max: number } {
  const s = [...samples].sort((a, b) => a - b); const at = (q: number) => s[Math.min(s.length - 1, Math.floor(s.length * q))] ?? 0;
  return { mean: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length), p50: at(0.5), p95: at(0.95), p99: at(0.99), max: s[s.length - 1] ?? 0 };
}
