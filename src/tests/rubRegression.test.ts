import { describe, expect, it } from 'vitest';
import { ShirtStrikeDetector } from '../gestures/shirtStrikeDetector';
import { InteractionController } from '../engine/interactionController';
import { FIREWORKS, propBottom } from '../config/fireworks';
import type { Point, VisionFrame } from '../types';

const shirt = [{ x: .15, y: .3 }, { x: .85, y: .3 }, { x: .85, y: .9 }, { x: .15, y: .9 }];
const pose: Point[] = Array.from({ length: 33 }, (_, i) => ({ x: i === 11 || i === 23 ? .15 : i === 12 || i === 24 ? .85 : .5, y: i === 11 || i === 12 ? .26 : .9, visibility: 1 }));
function atHead(y: number, x = .4): Point[] {
  const p = Array.from({ length: 21 }, () => ({ x, y: .7 }));
  p[0] = { x, y: .85 }; p[9] = { x, y: .7 }; p[5] = { x, y: .74 }; p[17] = { x: x + .08, y: .74 };
  p[4] = { x: x - .004, y: y + .052 }; p[8] = { x: x + .004, y: y + .052 };
  return p;
}
function frame(y: number, time: number, hands = true, body = true): VisionFrame {
  return { hands: hands ? [{ id: 1, label: 'Left', points: atHead(y), seen: time }] : [], pose: body ? pose : [], timestamp: time };
}
describe('real rubbing failure regressions', () => {
  it.each(['horizontal', 'vertical', 'diagonal'] as const)('accepts short %s back-and-forth rubbing', axis => {
    const d = new ShirtStrikeDetector();
    const travel = [0, .025, .05, .075, .05, .025, 0];
    const results = travel.map((v, i) => d.update({ x: .4 + (axis !== 'vertical' ? v : 0), y: .55 + (axis !== 'horizontal' ? v : 0) }, shirt, .7, i * 80, 1));
    expect(results.some(Boolean)).toBe(true); expect(results.slice(0, 4).some(Boolean)).toBe(false);
  });
  it('lights from a compact shirt rub instead of needing a long stroke', () => {
    const d = new ShirtStrikeDetector();
    const compact = [0, .01, .021, .016, .007];
    expect(compact.some((v, i) => d.update({ x: .4 + v, y: .55 }, shirt, .7, i * 60, 1))).toBe(true);
  });
  it('keeps rub progress over a brief shirt-edge miss without counting missing motion', () => {
    const d = new ShirtStrikeDetector();
    d.update({ x: .4, y: .55 }, shirt, .7, 0, 1, { x: .4, y: .6 });
    d.update({ x: .43, y: .55 }, shirt, .7, 80, 1, { x: .43, y: .6 });
    const progress = d.progress;
    expect(d.update({ x: .45, y: .15 }, shirt, .7, 120, 1, { x: .45, y: .6 })).toBe(false);
    expect(d.progress).toBe(progress);
    expect(d.update({ x: .44, y: .55 }, shirt, .7, 160, 1, { x: .44, y: .6 })).toBe(false);
    expect(d.progress).toBe(progress);
    expect(d.update({ x: .4, y: .55 }, shirt, .7, 240, 1, { x: .4, y: .6 })).toBe(true);
  });
  it('rejects jitter, stationary contact and one-way passes', () => {
    for (const trajectory of [[0, .001, -.001, .002, -.002, .001, 0], [0, 0, 0, 0, 0, 0, 0], [0, .02, .04, .06, .08, .1, .12]]) {
      const d = new ShirtStrikeDetector(); expect(trajectory.some((v, i) => d.update({ x: .4, y: .55 + v }, shirt, .7, i * 100, 1))).toBe(false);
    }
  });
  it('does not emit friction from stored progress when the hand stops', () => {
    const d = new ShirtStrikeDetector(); d.update({ x: .4, y: .55 }, shirt, .7, 0, 1);
    d.update({ x: .4, y: .61 }, shirt, .7, 120, 1); expect(d.friction).toBe(true);
    d.update({ x: .4, y: .61 }, shirt, .7, 200, 1); expect(d.progress).toBeGreaterThan(0); expect(d.friction).toBe(false);
  });
  it('compensates for the hand and torso moving together', () => {
    const d = new ShirtStrikeDetector();
    expect([0, .03, .06, .09, .06, .03, 0].some((x, i) => d.update({ x: .4 + x, y: .55 }, shirt.map(p => ({ x: p.x + x, y: p.y })), .7, i * 100, 1))).toBe(false);
  });
  it('accepts a head just beyond the shirt edge only through a held-match contact margin', () => {
    const d = new ShirtStrikeDetector();
    expect([0, .025, .05, .075, .05, .025, 0].some((v, i) => d.update({ x: .4 + v, y: .275 }, shirt, .7, i * 80, 1, { x: .4 + v, y: .327 }))).toBe(true);
    const outside = new ShirtStrikeDetector(); expect([0, .03, .06, .09, .06, .03, 0].some((v, i) => outside.update({ x: .4 + v, y: .1 }, shirt, .7, i * 80, 1))).toBe(false);
  });
  it('continues a vertical rub across one lost hand/pose sample, without advancing on that sample', () => {
    const c = new InteractionController(); c.aspect = 1; c.start(); c.ready();
    for (const t of [0, 100, 210]) c.step(frame(.55, t), t);
    c.step(frame(.58, 290), 290); c.step(frame(.61, 370), 370);
    const progress = c.scene.strike;
    c.step(frame(.61, 470, false, false), 470); expect(c.scene.match?.lit).toBe(false); expect(c.scene.proximity).toBe(0);
    expect(c.scene.strike).toBe(progress);
    c.step(frame(.64, 530, true, false), 530); c.step(frame(.61, 610), 610); c.step(frame(.57, 690), 690);
    expect(c.scene.match?.lit).toBe(true); expect(c.events.filter(e => e.type === 'light')).toHaveLength(1);
  });
  it('expires stale torso/hand observations rather than lighting from cached movement', () => {
    const c = new InteractionController(); c.aspect = 1; c.start(); c.ready();
    for (const t of [0, 100, 210]) c.step(frame(.55, t), t);
    c.step(frame(.61, 300), 300); c.step(frame(.61, 800, false, false), 800);
    c.step(frame(.55, 900, true, false), 900);
    expect(c.scene.torso).toEqual([]); expect(c.scene.match).not.toBeNull();
    expect(c.events.some(e => e.type === 'light')).toBe(false);
    c.step(frame(.55, 2201, false, false), 2201);
    expect(c.scene.match).toBeNull(); expect(c.events.some(e => e.type === 'light')).toBe(false);
  });
});
describe('placed ground anchor', () => {
  it.each(FIREWORKS)('%s stays seated while either hand and the body move', kind => {
    const c = new InteractionController(); c.start(); c.ready(); c.placeSurface({ x: .5, y: .73 }); c.select(kind);
    const object = { ...c.scene.object }, fuse = { ...c.scene.fuse };
    for (let i = 0; i < 12; i++) {
      const observation = frame(.55, i * 100);
      observation.hands.push({ id: 2, label: 'Right', points: atHead(.3 + i * .02, .2 + i * .04), seen: i * 100 });
      c.step(observation, i * 100);
      expect(c.scene.object).toEqual(object); expect(c.scene.fuse).toEqual(fuse);
      expect(c.scene.object.y + propBottom(kind)).toBeCloseTo(c.scene.support.y);
    }
  });
  it('keeps Anaar on the same support through fuse ignition and firing', () => {
    const c = new InteractionController(); c.start(); c.ready(); c.select('Anaar'); c.manual = true; c.placeSurface({ x: .5, y: .72 });
    const at = { ...c.scene.object }, support = { ...c.scene.support };
    c.manualAt(c.scene.fuse, 0); c.light(10); c.manualAt(c.scene.fuse, 100); c.tick(370);
    c.placeSurface({ x: .8, y: .5 }); expect(c.scene.support).toEqual(support);
    c.tick(1300); expect(c.scene.phase).toBe('EFFECT_PLAYING'); expect(c.scene.object).toEqual(at); expect(c.scene.support).toEqual(support);
  });
});
