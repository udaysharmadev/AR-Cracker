import type { Firework, Point } from '../types';

export const FIREWORKS: Firework[] = ['Laxmi', 'Rocket', 'Anaar', 'Gola'];
export const FIREWORK_LABELS: Record<Firework, string> = { Laxmi: 'Laxmi Bomb', Rocket: 'Rocket', Anaar: 'Anaar', Gola: 'Gola Bomb' };
export const PROP_SCALE: Record<Firework, number> = { Laxmi: 1, Rocket: 1.12, Anaar: 1.15, Gola: 1.35 };
const BOTTOM: Record<Firework, number> = { Laxmi: 45, Rocket: 108, Anaar: 61, Gola: 70 };
export const propBottom = (kind: Firework) => BOTTOM[kind] * PROP_SCALE[kind] / 1280;
// Fractions of a 1280-high scene, shared by painted fuse, collision target and
// burning-fuse particles. Prop drawing and interaction have the same endpoints.
const GEOMETRY: Record<Firework, { top: number; lift: number; side: number }> = {
  Laxmi: { top: -45, lift: 116, side: 35 },
  Rocket: { top: -22, lift: 112, side: 48 },
  Anaar: { top: -85, lift: 153, side: 32 },
  Gola: { top: -63, lift: 172, side: 48 },
};
export function fuseTip(kind: Firework, at: Point, aspect: number): Point {
  const shape = GEOMETRY[kind];
  return { x: at.x + shape.side * PROP_SCALE[kind] / 1280 / aspect, y: at.y - shape.lift * PROP_SCALE[kind] / 1280 };
}
export function fusePoint(kind: Firework, at: Point, tip: Point, progress: number): Point {
  const t = Math.max(0, Math.min(1, progress));
  const base = { x: at.x, y: at.y + GEOMETRY[kind].top * PROP_SCALE[kind] / 1280 };
  return { x: tip.x + (base.x - tip.x) * t, y: tip.y + (base.y - tip.y) * t + Math.sin(t * Math.PI) * .008 };
}
// The selected reference's boom is at ~4.94s. Retain its original pitch: start
// the final 1.8s of whistle, then continue the original explosion and tail.
export const ROCKET_FLIGHT = 1800;
export const ROCKET_AUDIO_OFFSET = 3.14;
export const REFERENCE_AUDIO = {
  Rocket: { url: 'audio/rocket.mp3', gain: .72 },
  Laxmi: { url: 'audio/laxmi.mp3', gain: .7 },
  Gola: { url: 'audio/gola.mp3', gain: .88 },
} as const;
export type SampleKind = keyof typeof REFERENCE_AUDIO;
export const BLAST_PRESETS = {
  Laxmi: { count: 440, speed: 255, life: .55, tail: .85, smoke: 20, radius: 65 },
  Rocket: { count: 1450, speed: 485, life: 1.4, tail: 1.6, smoke: 55, radius: 150 },
  Gola: { count: 2500, speed: 900, life: 1.3, tail: 2.4, smoke: 170, radius: 480 },
} as const;
