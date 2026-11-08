import { coverTransform, distance } from '../camera/coordinateTransform';
import type { Point } from '../types';
import { groundRegion, smoothAnchor, trackPatch, type GroundMask } from './groundRegion';

export type GroundStatus = 'searching' | 'detected' | 'lost' | 'unavailable';
type Frame = { gray: Uint8Array; timestamp: number };
export class GroundTracker {
  private worker: Worker | null = null;
  private ready = false;
  private busy = false;
  private sampleTime = -Infinity;
  private inferenceTime = -Infinity;
  private semanticTime = -Infinity;
  private trackedTime = -Infinity;
  private frames: Frame[] = [];
  private candidate: Point | null = null;
  private anchor: Point | null = null;
  private surface = document.createElement('canvas');
  private ctx = this.surface.getContext('2d', { willReadFrequently: true })!;
  private mirror = true;
  private aspect = 1;
  private interactionLocked = false;
  bottom = .82;
  status: GroundStatus = 'searching';
  confidence = 0;
  label = 0;
  onplace: (at: Point, confidence: number, label: number) => void = () => {};
  onstatus: (status: GroundStatus) => void = () => {};
  init() {
    this.close();
    const base = new URL(import.meta.env.BASE_URL, location.href).href;
    const worker = this.worker = new Worker(new URL('vision/ground-worker.js', base), { type: 'module' });
    const timeout = window.setTimeout(() => this.fail(), 60000);
    worker.onerror = () => { clearTimeout(timeout); this.fail(); };
    worker.onmessage = (e: MessageEvent<GroundMask & { type: string }>) => {
      if (this.worker !== worker) return;
      if (e.data.type === 'ready') { clearTimeout(timeout); this.ready = true; }
      if (e.data.type === 'error') { clearTimeout(timeout); this.fail(); }
      if (e.data.type === 'mask') { this.busy = false; this.accept(e.data); }
    };
    worker.postMessage({ type: 'init', base });
    // Terminating a worker also cancels initialization and outstanding inference.
    this.cancelTimer = () => clearTimeout(timeout);
  }
  private cancelTimer: (() => void) | null = null;
  private setStatus(status: GroundStatus) { if (status !== this.status) { this.status = status; this.onstatus(status); } }
  setInteractionLock(locked: boolean) { this.interactionLocked = locked; }
  reposition(at: Point) {
    if (!this.anchor) return;
    this.anchor = { ...at }; this.candidate = null;
    this.trackedTime = this.semanticTime = performance.now();
  }
  private fail() { this.worker?.terminate(); this.worker = null; this.ready = this.busy = false; this.anchor = null; this.setStatus('unavailable'); }
  private move(before: Uint8Array, after: Uint8Array, at: Point): Point | null {
    const w = this.surface.width, h = this.surface.height;
    const shifts: Point[] = [];
    for (const [dx, dy] of [[0, 0], [-.035 / this.aspect, 0], [.035 / this.aspect, 0], [0, -.025], [0, .025]]) {
      const p = { x: at.x + dx, y: at.y + dy }, next = trackPatch(before, after, w, h, p);
      if (next) shifts.push({ x: next.x - p.x, y: next.y - p.y });
    }
    if (shifts.length < 3) {
      // A textureless floor is allowed only while its actual video patch remains
      // unchanged. It cannot support tracking a moving camera.
      let difference = 0, count = 0;
      for (let y = -8; y <= 8; y++) for (let x = -12; x <= 12; x++) {
        const px = Math.round(at.x * w) + x, py = Math.round(at.y * h) + y;
        if (px >= 0 && px < w && py >= 0 && py < h) { const i = py * w + px; difference += Math.abs(before[i] - after[i]); count++; }
      }
      return count && difference / count < 2 ? at : null;
    }
    const dx = shifts.map(p => p.x).sort((a, b) => a - b)[Math.floor(shifts.length / 2)];
    const dy = shifts.map(p => p.y).sort((a, b) => a - b)[Math.floor(shifts.length / 2)];
    if (shifts.filter(p => Math.hypot((p.x - dx) * w, (p.y - dy) * h) < 2.5).length < 3) return null;
    return { x: at.x + dx, y: at.y + dy };
  }
  private accept(mask: GroundMask) {
    const region = groundRegion(mask, this.aspect, this.bottom, this.anchor ?? undefined);
    if (!region) { this.candidate = null; return; }
    const history = this.frames.filter(f => f.timestamp >= mask.timestamp);
    if (!history.length || history[0].timestamp - mask.timestamp > 150) return;
    let at: Point | null = region.at;
    for (let i = 1; i < history.length && at; i++) at = this.move(history[i - 1].gray, history[i].gray, at);
    if (!at || at.y > this.bottom || at.x < .04 || at.x > .96) return;
    const now = performance.now();
    if (this.anchor) {
      // Semantic revalidation does not drag a locked prop to the most convenient
      // pixel on each frame. Only camera texture motion changes the anchor.
      if (distance(at, this.anchor, this.aspect) < .12) this.semanticTime = now;
      return;
    }
    if (!this.candidate || distance(at, this.candidate, this.aspect) > .06) { this.candidate = at; return; }
    this.anchor = at; this.candidate = null; this.semanticTime = this.trackedTime = now;
    this.confidence = region.confidence; this.label = region.label;
    this.setStatus('detected'); this.onplace(at, region.confidence, region.label);
  }
  sample(video: HTMLVideoElement, now: number, aspect: number, mirror: boolean) {
    if (!this.worker || video.readyState < 2 || now - this.sampleTime < 110) return;
    if (Math.abs(this.aspect - aspect) > .005 || this.mirror !== mirror) { this.reset(); this.aspect = aspect; this.mirror = mirror; }
    this.sampleTime = now;
    const h = 144, w = Math.round(h * aspect);
    if (this.surface.width !== w || this.surface.height !== h) { this.surface.width = w; this.surface.height = h; }
    const t = coverTransform(video.videoWidth, video.videoHeight, w, h, mirror);
    this.ctx.save(); if (mirror) { this.ctx.translate(w, 0); this.ctx.scale(-1, 1); }
    this.ctx.drawImage(video, t.x, t.y, t.drawnW, t.drawnH); this.ctx.restore();
    const pixels = this.ctx.getImageData(0, 0, w, h).data, gray = new Uint8Array(w * h);
    for (let i = 0; i < gray.length; i++) gray[i] = (pixels[i * 4] * 77 + pixels[i * 4 + 1] * 150 + pixels[i * 4 + 2] * 29) >> 8;
    const previous = this.frames.at(-1);
    if (this.anchor && previous && !this.interactionLocked) {
      const next = this.move(previous.gray, gray, this.anchor);
      if (next && next.x > .04 && next.x < .96 && next.y > .15 && next.y < this.bottom) {
        this.anchor = smoothAnchor(this.anchor, next, this.aspect);
        this.trackedTime = now;
        this.onplace(this.anchor, this.confidence, this.label);
      }
      if (now - this.trackedTime > 700 || now - this.semanticTime > 6500) { this.anchor = this.candidate = null; this.setStatus('lost'); }
    }
    this.frames.push({ gray, timestamp: now });
    if (this.frames.length > 60) this.frames.shift();
    if (!this.ready || this.busy || now - this.inferenceTime < 1400) return;
    this.busy = true; this.inferenceTime = now;
    const worker = this.worker;
    createImageBitmap(this.surface).then(bitmap => {
      if (worker !== this.worker) { bitmap.close(); return; }
      worker.postMessage({ type: 'frame', bitmap, timestamp: now }, [bitmap]);
    }).catch(() => this.fail());
  }
  reset() { this.anchor = this.candidate = null; this.frames = []; this.confidence = 0; this.interactionLocked = false; this.setStatus('searching'); }
  close() { this.cancelTimer?.(); this.cancelTimer = null; this.worker?.terminate(); this.worker = null; this.ready = this.busy = false; this.reset(); this.sampleTime = this.inferenceTime = -Infinity; }
}
