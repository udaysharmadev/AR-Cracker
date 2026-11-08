import type { Point } from '../types';

export type GroundMask = { mask: Uint8Array; labels: Uint8Array; width: number; height: number; timestamp: number };
export type GroundRegion = { at: Point; confidence: number; label: number; area: number };
export function smoothAnchor(current: Point, next: Point, aspect: number, gain = .45): Point {
  if (Math.hypot((next.x - current.x) * aspect, next.y - current.y) < .002) return current;
  return { x: current.x + (next.x - current.x) * gain, y: current.y + (next.y - current.y) * gain };
}
// Find connected confident ground, then choose an interior contact point with
// clearance for the largest prop. A lower screen coordinate alone is no evidence.
export function groundRegion(frame: GroundMask, aspect: number, bottom = .82, preferred?: Point): GroundRegion | null {
  const { mask, labels, width: w, height: h } = frame;
  const seen = new Uint8Array(mask.length), queue = new Int32Array(mask.length);
  let best: GroundRegion | null = null, score = -Infinity;
  for (let seed = 0; seed < mask.length; seed++) {
    if (seen[seed] || mask[seed] < 140) continue;
    let read = 0, count = 1; queue[0] = seed; seen[seed] = 1;
    while (read < count) {
      const p = queue[read++], x = p % w, y = Math.floor(p / w);
      for (const n of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (n >= 0 && !seen[n] && mask[n] >= 140) { seen[n] = 1; queue[count++] = n; }
      }
    }
    if (count < mask.length * .035) continue;
    const rx = Math.max(3, Math.ceil(.095 / aspect * w)), ry = Math.max(2, Math.ceil(.025 * h));
    for (let i = 0; i < count; i++) {
      const p = queue[i], x = p % w, y = Math.floor(p / w), at = { x: (x + .5) / w, y: (y + .5) / h };
      if (at.y < .28 || at.y > bottom || x < rx || x + rx >= w || y < ry || y + ry >= h) continue;
      let clear = true;
      for (let dy = -ry; dy <= ry && clear; dy++) for (let dx = -rx; dx <= rx; dx++) if (mask[(y + dy) * w + x + dx] < 140) { clear = false; break; }
      if (!clear) continue;
      const target = preferred ?? { x: .5, y: Math.min(.72, bottom - .03) };
      const value = mask[p] / 255 - Math.hypot((at.x - target.x) * aspect, at.y - target.y) * 1.8 + count / mask.length * .1;
      if (value > score) { score = value; best = { at, confidence: mask[p] / 255, label: labels[p], area: count / mask.length }; }
    }
  }
  return best;
}

// Bounded normalized patch correlation on video pixels, never the AR composite.
// Translation tracking is intentionally conservative: large motion/occlusion
// requires reacquiring semantic ground rather than sliding onto an unrelated object.
export function trackPatch(before: Uint8Array, after: Uint8Array, width: number, height: number, at: Point): Point | null {
  const cx = Math.round(at.x * width), cy = Math.round(at.y * height), radius = 5, search = 10;
  if (cx < radius + search || cy < radius + search || cx >= width - radius - search || cy >= height - radius - search) return null;
  let sum = 0, square = 0;
  for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++) { const v = before[(cy + y) * width + cx + x]; sum += v; square += v * v; }
  const count = (radius * 2 + 1) ** 2, variance = square - sum * sum / count;
  if (variance < count * 24) return null;
  let best = -.1, second = -.1, bx = 0, by = 0;
  for (let dy = -search; dy <= search; dy++) for (let dx = -search; dx <= search; dx++) {
    let other = 0, otherSquare = 0, product = 0;
    for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++) {
      const a = before[(cy + y) * width + cx + x], b = after[(cy + y + dy) * width + cx + x + dx];
      other += b; otherSquare += b * b; product += a * b;
    }
    const correlation = (product - sum * other / count) / Math.sqrt(variance * Math.max(1, otherSquare - other * other / count));
    if (correlation > best) { second = best; best = correlation; bx = dx; by = dy; } else second = Math.max(second, correlation);
  }
  if (best < .86 || best - second < .012) return null;
  return { x: at.x + bx / width, y: at.y + by / height };
}
