import type { VisionFrame } from '../types';
import { HandTracker } from './handTracker';
import type { VisionRequest, VisionResponse } from './protocol';
export class Vision {
  private worker: Worker | null = null;
  private tracker = new HandTracker();
  private busy = false;
  private last = -Infinity;
  private videoTime = -1;
  private frames = 0;
  private cancelInit: (() => void) | null = null;
  interval = 50;
  elapsed = 0;
  onframe: (frame: VisionFrame) => void = () => {};
  onerror: (message: string) => void = () => {};
  async init(status: (message: string) => void) {
    const base = new URL(import.meta.env.BASE_URL, location.href).href;
    const worker = new Worker(new URL('vision/worker.js', base));
    this.worker = worker;
    return new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => { finish(); reject(new Error('Tracking models timed out. Retry or use Manual mode.')); this.close(); }, 60000);
      const finish = () => { clearTimeout(timeout); this.cancelInit = null; };
      this.cancelInit = () => { finish(); reject(new DOMException('Tracking initialization canceled.', 'AbortError')); };
      worker.onerror = e => { finish(); reject(new Error(e.message || 'Vision worker failed')); this.busy = false; this.onerror('Vision worker stopped. Retry tracking or use Manual mode.'); };
      worker.onmessage = (e: MessageEvent<VisionResponse>) => {
        if (this.worker !== worker) return;
        const m = e.data;
        if (m.type === 'status') status(m.message);
        if (m.type === 'ready') { finish(); resolve(m.delegate); }
        if (m.type === 'error') { finish(); this.busy = false; reject(new Error(m.message)); this.onerror(m.message); }
        if (m.type === 'frame') {
          this.busy = false; this.elapsed = m.elapsed;
          this.interval = Math.max(45, Math.min(140, m.elapsed));
          const arrival = performance.now();
          this.onframe({ hands: this.tracker.update(m.hands, m.timestamp, arrival), pose: m.pose, timestamp: arrival });
        }
      };
      const request: VisionRequest = { type: 'init', base };
      worker.postMessage(request);
    });
  }
  sample(video: HTMLVideoElement, now: number) {
    if (!this.worker || this.busy || video.readyState < 2 || video.currentTime === this.videoTime || now - this.last < this.interval) return;
    this.busy = true; this.last = now; this.videoTime = video.currentTime;
    const worker = this.worker;
    // Keep input aspect unchanged: normalized model coordinates stay raw-video
    // coordinates regardless of output crop. One outstanding frame drops stale input.
    createImageBitmap(video, { resizeWidth: 640, resizeHeight: Math.round(640 * video.videoHeight / video.videoWidth) }).then(bitmap => {
      if (this.worker !== worker) { bitmap.close(); return; }
      const request: VisionRequest = { type: 'frame', bitmap, timestamp: now, pose: this.frames++ % 2 === 0 };
      worker.postMessage(request, [bitmap]);
    }).catch(error => { this.busy = false; this.onerror(String(error)); });
  }
  close() { this.cancelInit?.(); this.worker?.terminate(); this.worker = null; this.busy = false; this.tracker.reset(); }
}
