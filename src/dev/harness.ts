// Explicit development-only replay. This module is unreachable in production.
// Tests inject scene-normalized observations into the SAME gesture controller;
// normal camera mode always uses the actual MediaPipe worker.
import type { Runtime } from '../engine/runtime';
import type { VisionFrame } from '../types';
export type Harness = {
  takeControl: () => void;
  feed: (frame: VisionFrame) => void;
  snapshot: () => { phase: string; ground: string; kind: string; queued: string; support: { x: number; y: number }; object: { x: number; y: number }; head: { x: number; y: number } | null; matchAlpha: number; fuse: { x: number; y: number }; lit: boolean; audioTracks: number; sampleCount: number; cameraTracks: string[]; particles: number };
};
declare global { interface Window { __fireplay?: Harness } }
export function attachHarness(engine: Runtime) {
  if (!import.meta.env.DEV) return;
  window.__fireplay = {
    takeControl: () => { engine.vision?.close(); engine.vision = null; engine.ground.close(); engine.controller.placeSurface({ x: .5, y: .72 }); engine.view.modelReady = true; engine.view.delegate = 'SYNTHETIC REPLAY'; engine.controller.ready(); engine.view.message = 'Development replay · synthetic landmarks, explicit test placement.'; },
    feed: frame => engine.controller.step({ ...frame, timestamp: performance.now() }, performance.now()),
    snapshot: () => ({ phase: engine.controller.machine.phase, ground: engine.controller.scene.ground, kind: engine.controller.scene.kind, queued: engine.controller.scene.queued,
      support: engine.controller.scene.support, object: engine.controller.scene.object, head: engine.controller.scene.match?.head ?? null, matchAlpha: engine.controller.scene.match?.alpha ?? 0, fuse: engine.controller.scene.fuse, lit: engine.controller.scene.match?.lit ?? false,
      audioTracks: engine.audio.destination?.stream.getAudioTracks().length ?? 0,
      sampleCount: engine.audio.sampleCount,
      cameraTracks: engine.camera.stream?.getTracks().map(t => t.readyState) ?? [], particles: engine.compositor.fx.renderer.info.render.points }),
  };
}
