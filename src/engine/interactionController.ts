import type { EffectEvent, Firework, Hand, MatchPose, Point, Scene, VisionFrame } from '../types';
import { distance, midpoint } from '../camera/coordinateTransform';
import { TUNING } from '../config/tuning';
import { fuseTip, propBottom } from '../config/fireworks';
import { PinchDetector } from '../gestures/pinchDetector';
import { ShirtStrikeDetector } from '../gestures/shirtStrikeDetector';
import { FuseCollision } from '../gestures/fuseCollision';
import { torsoFromPose } from '../vision/poseTracker';
import { StateMachine } from './stateMachine';

export class InteractionController {
  machine = new StateMachine();
  aspect = 720 / 1280;
  events: EffectEvent[] = [];
  scene: Scene = { phase: 'CAMERA_OFF', interruption: null, match: null, object: { x: .5, y: .75 - propBottom('Laxmi') }, support: { x: .5, y: .75 }, fuse: fuseTip('Laxmi', { x: .5, y: .75 - propBottom('Laxmi') }, this.aspect),
    kind: 'Laxmi', queued: 'Laxmi', ground: 'searching', torso: [], hands: [], fallback: true, fuseProgress: 0, proximity: 0, effectAge: 0, strike: 0, contact: false };
  manual = false;
  guided = false;
  private pinches = new Map<number, PinchDetector>();
  private strike = new ShirtStrikeDetector();
  private collision = new FuseCollision();
  private handId: number | null = null;
  private lastSeen = -Infinity;
  private litUntil = 0;
  private phaseStart = 0;
  private lastTorso = -Infinity;
  private lastStep = 0;
  private movingObject = false;

  start() { this.machine.send('START'); }
  ready() { this.machine.send('LOADED'); }
  select(kind: Firework) { this.scene.queued = kind; if (!this.busy) { this.scene.kind = kind; this.seatObject(); } }
  placeSurface(support: Point, source: 'manual' | 'detected' = 'manual') {
    if (this.busy && source !== 'detected') return;
    const moved = distance(support, this.scene.support, this.aspect);
    this.scene.ground = source;
    this.scene.support = { ...support };
    this.scene.object = { x: support.x, y: support.y - propBottom(this.scene.kind) };
    this.scene.fuse = fuseTip(this.scene.kind, this.scene.object, this.aspect);
    if (moved > .025) { this.collision.reset(); this.scene.proximity = 0; }
  }
  beginObjectMove() {
    if (!this.placed || this.busy || this.movingObject) return false;
    this.movingObject = true; this.collision.reset(); this.scene.proximity = 0; this.scene.contact = false;
    return true;
  }
  moveObject(support: Point) {
    if (!this.movingObject || this.busy) return;
    this.placeSurface(support, this.scene.ground === 'detected' ? 'detected' : 'manual');
    this.scene.contact = false;
  }
  endObjectMove() {
    if (!this.movingObject) return;
    this.movingObject = false; this.collision.reset(); this.scene.proximity = 0; this.scene.contact = false;
  }
  get placed() { return this.scene.ground === 'detected' || this.scene.ground === 'manual'; }
  private seatObject() { this.scene.object = { x: this.scene.support.x, y: this.scene.support.y - propBottom(this.scene.kind) }; this.refreshFuse(); }
  refreshFuse() { this.scene.fuse = fuseTip(this.scene.kind, this.scene.object, this.aspect); this.collision.reset(); this.scene.proximity = 0; }
  get busy() { return ['FUSE_IGNITING', 'EFFECT_PLAYING', 'RESETTING'].includes(this.machine.phase); }
  get lit() { return this.litUntil > this.lastStep; }
  reset() {
    const kind = this.scene.queued;
    this.machine = new StateMachine(); this.start(); this.ready(); this.handId = null;
    this.movingObject = false;
    this.scene.match = null; this.scene.kind = kind; this.litUntil = 0; this.lastSeen = -Infinity;
    this.scene.effectAge = 0;
    this.pinches.clear(); this.strike.reset(); this.collision.reset(); this.scene.fuseProgress = 0;
    this.scene.proximity = 0; this.scene.strike = 0; this.events = []; this.scene.contact = false; this.lastTorso = -Infinity;
    this.seatObject();
  }
  private emit(type: EffectEvent['type'], at: Point) { this.events.push({ type, at: { ...at }, kind: this.scene.kind }); }
  light(now: number) {
    if (!this.scene.match || this.busy) return;
    if (this.machine.phase === 'READY') this.machine.send('GRAB');
    this.machine.send('LIGHT'); this.litUntil = now + TUNING.matchLife;
    this.scene.match.lit = true; this.emit('light', this.scene.match.head); this.strike.reset();
  }
  manualAt(p: Point, now: number) {
    if (!this.manual) return;
    this.lastStep = now; this.lastSeen = now;
    if (this.machine.phase === 'READY') this.machine.send('GRAB');
    this.scene.match = { grip: { x: p.x, y: p.y + TUNING.matchLength }, head: p, angle: -Math.PI / 2, alpha: 1, lit: this.litUntil > now };
    this.updateContact(now, true);
  }
  manualIgnite(now: number) { if (this.manual && this.placed && this.litUntil > now && !this.busy) this.ignite(now); }
  private ignite(now: number) {
    if (this.machine.phase !== 'MATCH_LIT') return;
    this.machine.send('CONTACT'); this.phaseStart = now; this.scene.proximity = 0;
    this.emit('fuse', this.scene.fuse); this.collision.reset();
  }
  private updateContact(now: number, stable: boolean) {
    const match = this.scene.match;
    if (match && this.collision.update(match.head, this.scene.fuse, now, this.aspect,
      this.placed && match.lit && this.litUntil > now && !this.busy && !this.movingObject && stable && (this.manual || now - this.lastSeen < 180))) this.ignite(now);
    this.scene.proximity = this.collision.progress;
  }
  private matchFromHand(hand: Hand): MatchPose {
    const grip = midpoint(hand.points[4], hand.points[8]);
    const base = hand.points[5];
    const dx = (grip.x - base.x) * this.aspect, dy = grip.y - base.y;
    const len = Math.hypot(dx, dy) || 1;
    return { grip, head: { x: grip.x + dx / len * TUNING.matchLength / this.aspect, y: grip.y + dy / len * TUNING.matchLength }, angle: Math.atan2(dy, dx), alpha: 1, lit: this.litUntil > this.lastStep };
  }
  step(frame: VisionFrame, now: number) {
    if (this.manual || this.machine.phase === 'CAMERA_OFF' || this.machine.phase === 'LOADING') return;
    this.lastStep = now;
    this.scene.hands = frame.hands;
    const torso = torsoFromPose(frame.pose, this.aspect);
    if (torso.length) { this.scene.torso = torso; this.lastTorso = now; }
    else if (now - this.lastTorso > TUNING.poseGrace) this.scene.torso = [];
    this.scene.fallback = !this.scene.torso.length;
    this.machine.interruption = frame.hands.length ? null : (frame.pose.length ? 'TRACKING_LOST' : 'NO_PERSON');
    const active = frame.hands.filter(hand => {
      let detector = this.pinches.get(hand.id);
      if (!detector) { detector = new PinchDetector(); this.pinches.set(hand.id, detector); }
      return detector.update(hand.points, now, this.aspect);
    });
    // Preserve an already-grabbed match through a brief shirt occlusion, but
    // never advance rubbing or fuse dwell from an absent hand observation.
    for (const [id, detector] of this.pinches) if (!frame.hands.some(h => h.id === id)) { detector.missing(now); if (this.pinches.size > 8 && !detector.active) this.pinches.delete(id); }
    // Pinch is the pickup gesture. Once picked up, keep the match attached to
    // that same tracked hand even if the fingers open during a shirt rub. A
    // brief landmark dropout also keeps the existing match visible until the
    // hand is reacquired or the hand-loss timeout expires.
    let held = active.find(h => h.id === this.handId);
    if (this.handId !== null && this.scene.match) {
      held = frame.hands.find(h => h.id === this.handId);
    }
    if (this.handId === null || now - this.lastSeen > TUNING.identityRetention) {
      held = active[0]; if (held) this.handId = held.id;
    }
    if (held) {
      this.lastSeen = now;
      this.scene.match = this.matchFromHand(held);
      if (this.machine.phase === 'READY') this.machine.send('GRAB');
    } else {
      if (now - this.lastSeen <= TUNING.observationGrace) this.strike.pause(); else this.strike.reset();
      this.scene.contact = false; this.collision.reset(); this.scene.proximity = 0;
      if (this.scene.match) this.scene.match.alpha = Math.max(0, 1 - (now - this.lastSeen) / TUNING.handLoss);
      if (now - this.lastSeen > TUNING.handLoss) {
        this.scene.match = null; this.handId = null; this.machine.send('RELEASE');
      }
    }
    if (this.movingObject) this.strike.pause();
    else if (held && this.scene.match && !this.scene.match.lit && !this.busy) {
      const guidedZone = [{ x: .15, y: .58 }, { x: .85, y: .58 }, { x: .85, y: .73 }, { x: .15, y: .73 }];
      const torso = this.scene.fallback && this.guided ? guidedZone : this.scene.torso;
      const width = torso.length ? distance(torso[0], torso[1], this.aspect) / .74 : 0;
      if (this.strike.update(this.scene.match.head, torso, width, now, this.aspect, this.scene.match.grip)) this.light(now);
      this.scene.strike = this.strike.progress; this.scene.contact = this.strike.contact;
      if (this.scene.strike > 0) this.machine.send('RUB');
      if (this.strike.friction) this.emit('strike', this.scene.match.head);
      if (!this.scene.strike && this.machine.phase === 'STRIKING') this.machine.send('GRAB');
    }
    this.updateContact(now, !!held);
    this.tick(now);
  }
  tick(now: number) {
    this.lastStep = now;
    if (this.manual) this.updateContact(now, true);
    if (this.scene.match) {
      this.scene.match.lit = this.litUntil > now;
      if (!this.manual && now - this.lastSeen > 180) {
        this.scene.match.alpha = Math.max(0, 1 - (now - this.lastSeen) / TUNING.handLoss);
        this.collision.reset(); this.scene.proximity = 0;
        if (now - this.lastSeen > TUNING.handLoss) {
          this.scene.match = null; this.handId = null; this.strike.reset(); this.machine.send('RELEASE');
        }
      }
    }
    if (this.machine.phase === 'MATCH_LIT' && this.litUntil <= now) { this.machine.send('EXPIRE'); this.strike.reset(); }
    if (this.machine.phase === 'FUSE_IGNITING') {
      this.scene.fuseProgress = Math.min(1, (now - this.phaseStart) / TUNING.fuseDuration);
      if (this.scene.fuseProgress >= 1) {
        this.machine.send('FUSE_DONE'); this.phaseStart = now;
        this.scene.effectAge = 0;
        this.emit('effect', this.scene.object);
      }
    } else if (this.machine.phase === 'EFFECT_PLAYING') {
      this.scene.effectAge = now - this.phaseStart;
      if (this.scene.effectAge >= TUNING.effectDuration[this.scene.kind]) { this.machine.send('EFFECT_DONE'); this.phaseStart = now; }
    } else if (this.machine.phase === 'RESETTING' && now - this.phaseStart > 500) {
      this.scene.kind = this.scene.queued; this.scene.fuseProgress = 0; this.scene.effectAge = 0;
      this.seatObject();
      this.machine.send(this.litUntil > now ? 'LIGHT' : 'RESET');
    }
    this.scene.phase = this.machine.phase; this.scene.interruption = this.machine.interruption;
  }
}
