import { distance } from '../camera/coordinateTransform';
import { TUNING } from '../config/tuning';
import type { Point } from '../types';
export class PinchDetector {
  active = false;
  private since: number | null = null;
  private released: number | null = null;
  private observed = -Infinity;
  update(points: Point[], now: number, aspect: number) {
    if (points.length < 21) { this.missing(now); return false; }
    if (now - this.observed > TUNING.pinchTrackingGrace) this.reset();
    this.observed = now;
    const scale = Math.max(distance(points[0], points[9], aspect), distance(points[5], points[17], aspect), 0.0001);
    const ratio = distance(points[4], points[8], aspect) / scale;
    if (ratio < (this.active ? TUNING.pinchOff : TUNING.pinchOn)) {
      this.released = null; this.since ??= now;
      if (now - this.since >= TUNING.pinchHold) this.active = true;
    } else if (this.active) {
      this.released ??= now;
      if (now - this.released > TUNING.releaseGrace) this.reset();
    } else this.since = null;
    return this.active;
  }
  missing(now: number) { if (!this.active || now - this.observed > TUNING.pinchTrackingGrace) this.reset(); }
  reset() { this.active = false; this.since = null; this.released = null; this.observed = -Infinity; }
}
