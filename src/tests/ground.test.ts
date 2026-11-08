import { describe, expect, it } from 'vitest';
import { groundRegion, smoothAnchor, trackPatch, type GroundMask } from '../vision/groundRegion';
import { InteractionController } from '../engine/interactionController';
import { propBottom } from '../config/fireworks';
import { FuseCollision } from '../gestures/fuseCollision';

function mask(): GroundMask { return { width: 64, height: 64, mask: new Uint8Array(4096), labels: new Uint8Array(4096), timestamp: 0 }; }
describe('ground placement evidence', () => {
  it('never invents floor from a lower-screen position, noise or low confidence', () => {
    const f = mask(); expect(groundRegion(f, 1)).toBeNull();
    f.mask.fill(100); expect(groundRegion(f, 1)).toBeNull();
    f.mask.fill(0); for (let i = 0; i < 100; i++) f.mask[i * 37] = 255;
    expect(groundRegion(f, 1)).toBeNull();
  });
  it('selects inside an actual connected off-center floor with contact clearance and HUD bounds', () => {
    const f = mask();
    for (let y = 30; y < 62; y++) for (let x = 4; x < 30; x++) { f.mask[y * 64 + x] = 230; f.labels[y * 64 + x] = 3; }
    const r = groundRegion(f, 1, .76)!;
    expect(r).not.toBeNull(); expect(r.at.x).toBeLessThan(.38); expect(r.at.y).toBeLessThan(.76);
    expect(r.at.y).toBeGreaterThan(.5); expect(r.label).toBe(3); expect(r.confidence).toBeGreaterThan(.85);
  });
  it('follows video texture translation, rejects occlusion and textureless tracking', () => {
    const w = 100, h = 100, before = new Uint8Array(w * h), after = new Uint8Array(w * h);
    let seed = 31;
    for (let i = 0; i < before.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; before[i] = seed >>> 24; }
    for (let y = 3; y < h; y++) for (let x = 0; x < w - 4; x++) after[y * w + x] = before[(y - 3) * w + x + 4];
    expect(trackPatch(before, after, w, h, { x: .5, y: .5 })).toEqual({ x: .46, y: .53 });
    expect(trackPatch(before, new Uint8Array(w * h), w, h, { x: .5, y: .5 })).toBeNull();
    expect(trackPatch(new Uint8Array(w * h), after, w, h, { x: .5, y: .5 })).toBeNull();
  });
  it('damps one-pixel ground jitter while smoothly following real image motion', () => {
    const anchor = { x: .5, y: .6 };
    expect(smoothAnchor(anchor, { x: .5, y: .601 }, .5625)).toEqual(anchor);
    expect(smoothAnchor(anchor, { x: .5, y: .62 }, .5625)).toEqual({ x: .5, y: .609 });
  });
  it('restarts fuse dwell when the moving ground anchor drifts during contact', () => {
    const collision = new FuseCollision(), head = { x: .5, y: .6 };
    expect(collision.update(head, head, 0, 1, true)).toBe(false);
    expect(collision.update(head, { x: .5, y: .606 }, 100, 1, true)).toBe(false);
    expect(collision.update(head, { x: .5, y: .615 }, 200, 1, true)).toBe(false);
    expect(collision.progress).toBe(0);
    expect(collision.update(head, { x: .5, y: .615 }, 400, 1, true)).toBe(false);
    expect(collision.update(head, { x: .5, y: .615 }, 461, 1, true)).toBe(true);
  });
  it('requires a placed prop for ignition; texture updates retain fuse dwell and move base/fuse together', () => {
    const c = new InteractionController(); c.start(); c.ready(); c.manual = true;
    c.manualAt(c.scene.fuse, 0); c.light(10); c.tick(100); c.tick(400); c.manualIgnite(401);
    expect(c.machine.phase).toBe('MATCH_LIT');
    c.placeSurface({ x: .4, y: .7 }, 'detected'); c.manualAt(c.scene.fuse, 500);
    c.placeSurface({ x: .402, y: .701 }, 'detected'); c.manualAt(c.scene.fuse, 780);
    expect(c.machine.phase).toBe('FUSE_IGNITING');
    expect(c.scene.object.y + propBottom(c.scene.kind)).toBeCloseTo(.701);
    c.scene.ground = 'lost'; c.reset(); c.manualAt(c.scene.fuse, 900); c.light(910); c.tick(1000); c.tick(1300);
    expect(c.machine.phase).toBe('MATCH_LIT');
  });
});
