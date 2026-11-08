import type { Point } from '../types';
import { inside, midpoint, distance } from '../camera/coordinateTransform';
import { TUNING } from '../config/tuning';

function nearShirt(p: Point, polygon: Point[], margin: number, aspect: number) {
  if (inside(p, polygon)) return true;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const dx = (b.x - a.x) * aspect, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * aspect * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    if (distance(p, { x: a.x + (b.x - a.x) * t, y: a.y + dy * t }, aspect) <= margin) return true;
  }
  return false;
}
export class ShirtStrikeDetector {
  progress = 0;
  friction = false;
  contact = false;
  private previous: { p: Point; time: number } | null = null;
  private start = 0;
  private origin: Point = { x: 0, y: 0 };
  private extreme = 0;
  private axis: Point | null = null;
  private cooldown = 0;
  private lastContact = -Infinity;
  private contactLost = false;
  private needsRebase = false;
  update(head: Point, torso: Point[], width: number, now: number, aspect: number, grip?: Point) {
    this.friction = false;
    const margin = grip && inside(grip, torso) ? Math.min(TUNING.matchLength * 1.1, width * .15) : width * .035;
    this.contact = torso.length === 4 && nearShirt(head, torso, margin, aspect);
    if (now < this.cooldown || width < .05) { this.reset(); return false; }
    // Track in shirt-relative coordinates: moving the body and held hand
    // together must not create friction. The rub axis can have ANY direction.
    const anchor = midpoint(torso[0], torso[1]);
    const p = { x: (head.x - anchor.x) * aspect, y: head.y - anchor.y };
    // Keep a nearly-complete rub alive across a couple of noisy edge samples,
    // but never count off-shirt movement toward ignition.
    if (!this.contact) {
      if (this.progress > 0 && now - this.lastContact <= TUNING.contactGrace) {
        this.contactLost = true;
        return false;
      }
      this.reset(); return false;
    }
    this.lastContact = now;
    if (this.needsRebase || this.contactLost) {
      this.previous = { p, time: now }; this.needsRebase = false; this.contactLost = false; return false;
    }
    if (!this.previous || now - this.previous.time > TUNING.poseGrace || now - this.start > TUNING.strokeWindow) {
      this.begin(p, now); return false;
    }
    const dx = p.x - this.previous.p.x, dy = p.y - this.previous.p.y;
    const dt = Math.max(1, now - this.previous.time);
    if (Math.hypot(dx, dy) > width * .6) { this.begin(p, now); return false; }
    this.friction = Math.hypot(dx, dy) > Math.max(.0015, width * .003) && Math.hypot(dx, dy) / dt > .000025;
    this.previous = { p, time: now };
    const outbound = Math.max(.01, Math.min(.034, width * TUNING.strokeTravel));
    const inbound = Math.max(.008, Math.min(.029, width * TUNING.strokeReturn));
    if (!this.axis) {
      const x = p.x - this.origin.x, y = p.y - this.origin.y, travel = Math.hypot(x, y);
      this.progress = Math.min(.5, travel / outbound * .5);
      if (travel >= outbound) { this.axis = { x: x / travel, y: y / travel }; this.extreme = travel; }
    } else {
      const along = (p.x - this.origin.x) * this.axis.x + (p.y - this.origin.y) * this.axis.y;
      const cross = Math.abs((p.x - this.origin.x) * this.axis.y - (p.y - this.origin.y) * this.axis.x);
      if (cross > outbound * 1.5) { this.begin(p, now); return false; }
      this.extreme = Math.max(this.extreme, along);
      const back = this.extreme - along;
      this.progress = .5 + Math.max(0, Math.min(.5, back / inbound * .5));
      if (back >= inbound && this.friction && now - this.start >= TUNING.strokeMinTime) {
        this.reset(); this.cooldown = now + TUNING.strikeCooldown; return true;
      }
    }
    return false;
  }
  private begin(p: Point, now: number) { this.previous = { p, time: now }; this.start = now; this.origin = p; this.extreme = 0; this.axis = null; this.progress = 0; this.friction = false; this.lastContact = now; this.contactLost = false; }
  pause() { this.friction = false; this.contact = false; this.needsRebase = true; }
  reset() { this.previous = null; this.axis = null; this.progress = 0; this.friction = false; this.lastContact = -Infinity; this.contactLost = false; this.needsRebase = false; }
}
