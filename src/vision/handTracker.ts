import { distance, midpoint } from '../camera/coordinateTransform';
import { TUNING } from '../config/tuning';
import type { Hand, Point } from '../types';
type Detection = { label: string; points: Point[] };
type Motion = { raw: Point[]; filtered: Point[]; velocity: Point[]; seen: number };
const alpha = (dt: number, cutoff: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
export class HandTracker {
  private tracks: Hand[] = [];
  private nextId = 1;
  private motion = new Map<number, Motion>();
  update(detections: Detection[], now: number, arrival = now) {
    const available = this.tracks.filter(h => now - h.seen < TUNING.identityRetention);
    const assigned = new Set<number>();
    const tracked: Hand[] = [];
    const hands = detections.map(d => {
      const center = midpoint(d.points[0], d.points[9]);
      const candidates = available.filter(h => !assigned.has(h.id)).map(h => ({ h, dist: distance(center, midpoint(h.points[0], h.points[9])) }));
      candidates.sort((a, b) => (a.dist + (a.h.label !== d.label ? 0.065 : 0)) - (b.dist + (b.h.label !== d.label ? 0.065 : 0)));
      const best = candidates[0];
      const id = best && best.dist < TUNING.identityRadius ? best.h.id : this.nextId++;
      assigned.add(id);
      const previous = this.motion.get(id);
      const dt = previous ? (now - previous.seen) / 1000 : 0;
      const continuous = !!previous && dt > 0 && dt <= .22 && previous.raw.length === d.points.length;
      const velocity: Point[] = [];
      const filtered = d.points.map((raw, i) => {
        const oldRaw = continuous ? previous!.raw[i] : raw;
        const oldFiltered = continuous ? previous!.filtered[i] : raw;
        const oldVelocity = continuous ? previous!.velocity[i] : { x: 0, y: 0 };
        const derivativeAlpha = continuous ? alpha(dt, 1) : 0;
        const vx = continuous ? oldVelocity.x + derivativeAlpha * ((raw.x - oldRaw.x) / dt - oldVelocity.x) : 0;
        const vy = continuous ? oldVelocity.y + derivativeAlpha * ((raw.y - oldRaw.y) / dt - oldVelocity.y) : 0;
        velocity.push({ x: vx, y: vy });
        const ax = continuous ? alpha(dt, TUNING.handFilterCutoff + TUNING.handFilterBeta * Math.abs(vx)) : 1;
        const ay = continuous ? alpha(dt, TUNING.handFilterCutoff + TUNING.handFilterBeta * Math.abs(vy)) : 1;
        return { ...raw, x: oldFiltered.x + ax * (raw.x - oldFiltered.x), y: oldFiltered.y + ay * (raw.y - oldFiltered.y) };
      });
      this.motion.set(id, { raw: d.points, filtered, velocity, seen: now });
      const hand = { ...d, id, points: filtered, seen: now };
      tracked.push(hand);

      // The worker returns an older camera frame. Apply a small, bounded
      // translation prediction to the current display time, while keeping the
      // smoothed observations as the filter's non-predicted source state.
      const lead = Math.min(TUNING.handPredictionMs / 1000, Math.max(0, (arrival - now) / 1000));
      const mean = velocity.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
      const shiftX = clamp(mean.x / Math.max(1, velocity.length) * lead, TUNING.handPredictionLimit);
      const shiftY = clamp(mean.y / Math.max(1, velocity.length) * lead, TUNING.handPredictionLimit);
      return { ...hand, points: filtered.map(p => ({ ...p, x: p.x + shiftX, y: p.y + shiftY })) };
    });
    this.tracks = [...tracked, ...available.filter(h => !assigned.has(h.id))];
    const retained = new Set(this.tracks.map(h => h.id));
    for (const id of this.motion.keys()) if (!retained.has(id)) this.motion.delete(id);
    return hands;
  }
  reset() { this.tracks = []; this.motion.clear(); }
}
