import type { Point } from '../types';
import { distance } from '../camera/coordinateTransform';
export function torsoFromPose(pose: Point[], aspect: number): Point[] {
  const a = pose[11], b = pose[12];
  if (!a || !b || (a.visibility ?? 0) < 0.45 || (b.visibility ?? 0) < 0.45) return [];
  const width = distance(a, b, aspect);
  if (width < 0.08) return [];
  const shoulders = [a, b].sort((l, r) => l.x - r.x);
  const left = shoulders[0], right = shoulders[1];
  const hips = [pose[23], pose[24]];
  const usable = hips.every(h => h && (h.visibility ?? 0) > 0.5 && h.y < 1.15 && h.y > Math.max(a.y, b.y) + 0.08);
  const sortedHips = usable ? hips.sort((l, r) => l.x - r.x) : [
    { x: left.x + (right.x - left.x) * 0.08, y: Math.min(1.1, left.y + width * 1.5) },
    { x: right.x - (right.x - left.x) * 0.08, y: Math.min(1.1, right.y + width * 1.5) },
  ];
  const inset = (right.x - left.x) * 0.13;
  return [{ x: left.x + inset, y: left.y + width * 0.12 }, { x: right.x - inset, y: right.y + width * 0.12 },
    { x: sortedHips[1].x - inset, y: sortedHips[1].y }, { x: sortedHips[0].x + inset, y: sortedHips[0].y }];
}
