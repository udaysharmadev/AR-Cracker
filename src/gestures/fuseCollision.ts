import type { Point } from '../types';
import { distance } from '../camera/coordinateTransform';
import { TUNING } from '../config/tuning';
export class FuseCollision {
  progress = 0;
  private since: number | null = null;
  private startFuse: Point | null = null;
  update(head: Point, fuse: Point, now: number, aspect: number, allowed: boolean) {
    if (!allowed || distance(head, fuse, aspect) > TUNING.fuseRadius) { this.reset(); return false; }
    if (this.startFuse && distance(this.startFuse, fuse, aspect) > TUNING.fuseAnchorTolerance) this.reset();
    if (this.since === null) { this.since = now; this.startFuse = { ...fuse }; }
    this.progress = Math.min(1, (now - this.since) / TUNING.fuseDwell);
    return this.progress >= 1;
  }
  reset() { this.since = null; this.startFuse = null; this.progress = 0; }
}
