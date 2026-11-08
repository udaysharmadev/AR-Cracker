import { describe, expect, it } from 'vitest';
import { captureCrop, coverTransform } from '../camera/coordinateTransform';
import { PinchDetector } from '../gestures/pinchDetector';
import { ShirtStrikeDetector } from '../gestures/shirtStrikeDetector';
import { FuseCollision } from '../gestures/fuseCollision';
import { HandTracker } from '../vision/handTracker';
import { torsoFromPose } from '../vision/poseTracker';
import { StateMachine } from '../engine/stateMachine';
import { InteractionController } from '../engine/interactionController';
import type { Point } from '../types';
import { FIREWORKS, fuseTip, fusePoint, propBottom, BLAST_PRESETS } from '../config/fireworks';
import { TUNING } from '../config/tuning';

function points(x = .4, scale = 1, gap = .02): Point[] {
  const p = Array.from({ length: 21 }, () => ({ x, y: .5 }));
  p[0] = { x, y: .7 }; p[9] = { x, y: .5 }; p[5] = { x: x - .06, y: .55 }; p[17] = { x: x + .06, y: .55 };
  p[4] = { x: x - gap / 2, y: .4 }; p[8] = { x: x + gap / 2, y: .4 };
  return p.map(v => ({ x: x + (v.x - x) * scale, y: .5 + (v.y - .5) * scale }));
}
describe('one authoritative camera transform', () => {
  it.each([[1440, 1000], [393, 852], [319, 504], [1920, 1080]])('center-crops a fullscreen %sx%s scene into a real 9:16 export', (w, h) => {
    const crop = captureCrop(w, h, 720, 1280);
    expect(crop.w / crop.h).toBeCloseTo(9 / 16);
    expect(crop.x + crop.w / 2).toBeCloseTo(w / 2);
    expect(crop.y + crop.h / 2).toBeCloseTo(h / 2);
    expect(crop.x).toBeGreaterThanOrEqual(0); expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.w).toBeLessThanOrEqual(w); expect(crop.h).toBeLessThanOrEqual(h);
  });
  for (const [sw, sh] of [[640, 480], [1280, 720]]) {
    for (const [w, h] of [[720, 1280], [1280, 720]]) {
      it(`${sw}x${sh} into ${w}x${h}, mirrored and raw`, () => {
        const mirror = coverTransform(sw, sh, w, h), raw = coverTransform(sw, sh, w, h, false);
        expect(mirror.map({ x: .5, y: .5 })).toEqual({ x: .5, y: .5 });
        expect(mirror.map({ x: .2, y: .3 }).x + raw.map({ x: .2, y: .3 }).x).toBeCloseTo(1);
        expect(mirror.drawnW).toBeGreaterThanOrEqual(w); expect(mirror.drawnH).toBeGreaterThanOrEqual(h);
        expect(raw.map({ x: 0, y: 0 }).x).toBeCloseTo(raw.x / w);
      });
    }
  }
});
describe('pinch', () => {
  it('normalizes by hand size, holds for 120ms and applies release hysteresis', () => {
    for (const scale of [.4, 1, 2]) {
      const d = new PinchDetector();
      expect(d.update(points(.4, scale), 0, 1)).toBe(false);
      expect(d.update(points(.4, scale), 119, 1)).toBe(false);
      expect(d.update(points(.4, scale), 120, 1)).toBe(true);
      expect(d.update(points(.4, scale, .085), 230, 1)).toBe(true);
      expect(d.update(points(.4, scale, .2), 250, 1)).toBe(true);
      expect(d.update(points(.4, scale, .2), 1001, 1)).toBe(false);
    }
  });
  it('pauses on one missing observation and expires a longer loss', () => {
    const d = new PinchDetector(); d.update(points(), 0, 1); d.update(points(), 200, 1);
    expect(d.update([], 220, 1)).toBe(false); expect(d.update(points(), 250, 1)).toBe(true);
    d.missing(600); expect(d.update(points(), 650, 1)).toBe(true);
    d.missing(1600); expect(d.update(points(), 1650, 1)).toBe(false);
  });
});
describe('identity and torso', () => {
  it('keeps IDs across reordered detections and temporary handedness flips', () => {
    const t = new HandTracker();
    const first = t.update([{ label: 'Left', points: points(.2) }, { label: 'Right', points: points(.8) }], 0);
    const second = t.update([{ label: 'Left', points: points(.79) }, { label: 'Right', points: points(.21) }], 50);
    expect(second.map(h => h.id)).toEqual([first[1].id, first[0].id]);
    t.update([], 100); expect(t.update([{ label: 'Left', points: points(.22) }], 400)[0].id).toBe(first[0].id);
    expect(t.update([{ label: 'Left', points: points(.9) }], 2000)[0].id).not.toBe(first[0].id);
  });
  it('smooths raw landmark jitter while predicting toward the display frame with a tight bound', () => {
    const smooth = new HandTracker(), predicted = new HandTracker();
    const start = points(.4);
    const initial = smooth.update([{ label: 'Left', points: start }], 0, 0)[0];
    predicted.update([{ label: 'Left', points: start }], 0, 0);
    const plain = smooth.update([{ label: 'Left', points: points(.42) }], 50, 50)[0];
    const ahead = predicted.update([{ label: 'Left', points: points(.42) }], 50, 90)[0];
    expect(plain.id).toBe(initial.id); expect(plain.points[0].x).toBeGreaterThan(initial.points[0].x);
    expect(plain.points[0].x).toBeLessThan(.42);
    expect(ahead.points[0].x).toBeGreaterThan(plain.points[0].x);
    expect(ahead.points[0].x).toBeLessThan(.44);
  });
  it('uses confident shoulders and estimates cropped hips', () => {
    const p = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 0 }));
    expect(torsoFromPose(p, 1)).toEqual([]);
    p[11] = { x: .2, y: .3, visibility: 1 }; p[12] = { x: .8, y: .3, visibility: 1 };
    expect(torsoFromPose(p, 1)).toHaveLength(4); expect(torsoFromPose(p, 1)[2].y).toBeGreaterThan(.7);
  });
});
describe('shirt friction', () => {
  const torso = [{ x: .1, y: .3 }, { x: .9, y: .3 }, { x: .9, y: .9 }, { x: .1, y: .9 }];
  it('requires sufficient outbound and reverse travel, time and torso contact', () => {
    const d = new ShirtStrikeDetector();
    const xs = [.3, .34, .4, .46, .43, .38, .32];
    const result = xs.map((x, i) => d.update({ x, y: .6 }, torso, .7, i * 100, 1));
    expect(result.slice(0, 4).some(Boolean)).toBe(false); expect(result.some(Boolean)).toBe(true);
    expect(d.update({ x: .3, y: .6 }, torso, .7, 650, 1)).toBe(false);
  });
  it('rejects a passive single pass, outside-shirt, expired window and frame jumps', () => {
    for (const ys of [.6, .1]) {
      const d = new ShirtStrikeDetector();
      expect([.2, .3, .4, .5, .6, .7].some((x, i) => d.update({ x, y: ys }, torso, .7, i * 100, 1))).toBe(false);
    }
    const d = new ShirtStrikeDetector();
    d.update({ x: .2, y: .6 }, torso, .7, 0, 1);
    expect(d.update({ x: .8, y: .6 }, torso, .7, 100, 1)).toBe(false);
    expect(d.update({ x: .2, y: .6 }, torso, .7, 2500, 1)).toBe(false);
  });
});
describe('fuse and explicit lifecycle', () => {
  it('requires lit, available, stable contact for the full dwell and resets on exit', () => {
    const f = new FuseCollision(), p = { x: .5, y: .6 };
    expect(f.update(p, p, 0, .5625, false)).toBe(false);
    expect(f.update(p, p, 100, .5625, true)).toBe(false);
    expect(f.update(p, p, 350, .5625, true)).toBe(false);
    expect(f.update(p, p, 360, .5625, true)).toBe(true);
    f.update({ x: .9, y: .9 }, p, 370, .5625, true);
    expect(f.update(p, p, 400, .5625, true)).toBe(false);
  });
  it('rejects illegal state transitions', () => {
    const m = new StateMachine(); m.send('CONTACT'); expect(m.phase).toBe('CAMERA_OFF');
    for (const e of ['START', 'LOADED', 'GRAB', 'RUB', 'LIGHT', 'CONTACT', 'FUSE_DONE', 'EFFECT_DONE', 'LIGHT'] as const) m.send(e);
    expect(m.phase).toBe('MATCH_LIT'); m.send('STOP'); expect(m.phase).toBe('CAMERA_OFF');
  });
  it.each(FIREWORKS)('%s triggers once, queues selection and resets', kind => {
    const c = new InteractionController(); c.start(); c.ready(); c.select(kind); c.manual = true; c.placeSurface({ x: .5, y: .72 });
    c.manualAt(c.scene.fuse, 0); c.manualIgnite(0); expect(c.machine.phase).toBe('MATCH_HELD');
    c.light(10); c.manualAt(c.scene.fuse, 100); c.manualAt(c.scene.fuse, 370);
    expect(c.machine.phase).toBe('FUSE_IGNITING'); c.select('Rocket'); expect(c.scene.kind).toBe(kind);
    c.tick(1300); expect(c.machine.phase).toBe('EFFECT_PLAYING');
    c.manualIgnite(1400); expect(c.events.filter(e => e.type === 'effect')).toHaveLength(1);
    const end = 1300 + TUNING.effectDuration[kind];
    c.tick(end); c.tick(end + 600); expect(c.machine.phase).toBe('MATCH_LIT'); expect(c.scene.kind).toBe('Rocket');
  });
  it('keeps a picked-up match on the same hand through open fingers and short dropouts', () => {
    const c = new InteractionController(); c.start(); c.ready();
    const frame = { hands: [{ id: 1, label: 'Left', points: points(), seen: 0 }], pose: [], timestamp: 0 };
    c.step(frame, 0); c.step(frame, 210); expect(c.scene.match).not.toBeNull();
    c.step({ ...frame, hands: [{ ...frame.hands[0], points: points(.4, 1, .2) }] }, 300);
    expect(c.scene.match).not.toBeNull(); expect(c.scene.match?.alpha).toBe(1);
    c.step({ ...frame, hands: [] }, 500); c.tick(900);
    expect(c.scene.match?.alpha).toBeGreaterThan(0); expect(c.scene.proximity).toBe(0);
    const reacquired = { ...frame, hands: [{ ...frame.hands[0], points: points(.6, 1, .2) }] };
    c.step(reacquired, 1000);
    expect(c.scene.match?.grip.x).toBeCloseTo(.6); expect(c.scene.match?.alpha).toBe(1);
    c.step({ ...frame, hands: [] }, 2301);
    expect(c.scene.match).toBeNull(); expect(c.scene.proximity).toBe(0);
    c.step(frame, 2400); expect(c.scene.match).toBeNull();
    c.step({ ...frame, timestamp: 2610 }, 2610); expect(c.scene.match).not.toBeNull();
  });
  it('allows deliberate manual cursor dwell without continuous pointer movement', () => {
    const c = new InteractionController(); c.start(); c.ready(); c.manual = true; c.placeSurface({ x: .5, y: .72 });
    c.manualAt(c.scene.fuse, 0); c.light(10); c.tick(100); c.tick(380);
    expect(c.machine.phase).toBe('FUSE_IGNITING');
  });
  it.each(FIREWORKS)('%s can be picked up, moved, and reseated on the same support', kind => {
    const c = new InteractionController(); c.start(); c.ready(); c.select(kind); c.placeSurface({ x: .5, y: .72 }, 'detected');
    const before = { object: { ...c.scene.object }, fuse: { ...c.scene.fuse } };
    expect(c.beginObjectMove()).toBe(true);
    c.moveObject({ x: .68, y: .64 });
    expect(c.scene.ground).toBe('detected'); expect(c.scene.support).toEqual({ x: .68, y: .64 });
    expect(c.scene.object.x - before.object.x).toBeCloseTo(.18);
    expect(c.scene.object.y - before.object.y).toBeCloseTo(-.08);
    expect(c.scene.object.y + propBottom(kind)).toBeCloseTo(c.scene.support.y);
    expect(c.scene.fuse.x).not.toBeCloseTo(before.fuse.x);
    c.endObjectMove(); c.moveObject({ x: .9, y: .5 });
    expect(c.scene.support).toEqual({ x: .68, y: .64 });
  });
});
describe('reference firework geometry', () => {
  it.each(FIREWORKS)('%s paints and collides with the same fuse tip in either framing', kind => {
    for (const aspect of [9 / 16, 16 / 9]) {
      const at = { x: .5, y: .6 }, tip = fuseTip(kind, at, aspect);
      expect(fusePoint(kind, at, tip, 0)).toEqual(tip);
      expect(fusePoint(kind, at, tip, 1).x).toBe(at.x);
      expect(tip.y).toBeLessThan(at.y); expect(tip.x).toBeGreaterThan(at.x);
      const c = new InteractionController(); c.aspect = aspect; c.select(kind);
      expect(c.scene.fuse).toEqual(fuseTip(kind, c.scene.object, aspect));
    }
  });
  it('gives Gola a substantially larger blast than Laxmi', () => {
    expect(BLAST_PRESETS.Gola.radius).toBeGreaterThan(BLAST_PRESETS.Laxmi.radius * 7);
    expect(BLAST_PRESETS.Gola.speed).toBeGreaterThan(BLAST_PRESETS.Laxmi.speed * 2);
    expect(BLAST_PRESETS.Gola.smoke).toBeGreaterThan(BLAST_PRESETS.Laxmi.smoke * 4);
  });
});
