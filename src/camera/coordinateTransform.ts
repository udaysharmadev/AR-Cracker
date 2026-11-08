import type { Point } from '../types';
export function coverTransform(sourceW: number, sourceH: number, width: number, height: number, mirror = true) {
  const scale = Math.max(width / sourceW, height / sourceH);
  const drawnW = sourceW * scale, drawnH = sourceH * scale;
  const x = (width - drawnW) / 2, y = (height - drawnH) / 2;
  return {
    x, y, drawnW, drawnH,
    // Inference always sees RAW frames. Mirror exactly once here, matching the
    // canvas draw transform. CSS never mirrors the output canvas a second time.
    map: (p: Point): Point => ({ ...p, x: (x + (mirror ? 1 - p.x : p.x) * drawnW) / width, y: (y + p.y * drawnH) / height }),
  };
}
export const distance = (a: Point, b: Point, aspect = 1) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export function captureCrop(width: number, height: number, targetW: number, targetH: number) {
  const scale = Math.max(targetW / width, targetH / height);
  const w = targetW / scale, h = targetH / scale;
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}
export function inside(p: Point, polygon: Point[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}
