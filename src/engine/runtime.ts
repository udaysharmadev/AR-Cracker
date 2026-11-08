import { CameraManager, cameraError } from '../camera/cameraManager';
import { captureCrop, coverTransform } from '../camera/coordinateTransform';
import { Vision } from '../vision/modelLoader';
import { GroundTracker } from '../vision/groundTracker';
import { InteractionController } from './interactionController';
import { Compositor } from '../fx/compositor';
import { AudioEngine } from '../audio/audioEngine';
import { Recorder, type Clip } from '../recording/recorder';
import type { Firework, Phase, Point, VisionFrame } from '../types';

export type View = { camera: 'off' | 'loading' | 'live' | 'error'; message: string; phase: Phase; ground: string; torsoReady: boolean; recording: boolean; seconds: number; manual: boolean; fps: number; delegate: string; selected: Firework; queued: Firework; modelReady: boolean; resolution: string };
export const initialView: View = { camera: 'off', message: '', phase: 'CAMERA_OFF', ground: 'searching', torsoReady: false, recording: false, seconds: 0, manual: false, fps: 0, delegate: '', selected: 'Laxmi', queued: 'Laxmi', modelReady: false, resolution: '720 × 1280' };

export class Runtime {
  camera = new CameraManager();
  vision: Vision | null = null;
  ground = new GroundTracker();
  controller = new InteractionController();
  compositor: Compositor;
  audio = new AudioEngine();
  recorder = new Recorder();
  private capture = document.createElement('canvas');
  private captureContext: CanvasRenderingContext2D;
  private observer: ResizeObserver;
  view = { ...initialView };
  onview: (view: View) => void = () => {};
  onclip: (clip: Clip) => void = () => {};
  private active = false;
  private frameId = 0;
  private lastFrame = 0;
  private lastNotify = 0;
  private lastLayout = 0;
  private fpsStart = 0;
  private frameCount = 0;
  private slowCount = 0;
  private generation = 0;
  private videoURL: string | null = null;
  private portrait = true;
  private quality = 720;
  private disposed = false;
  private draggingObject = false;
  private dragOffset: Point = { x: 0, y: 0 };
  private onHidden = () => { if (document.hidden && this.active) { void this.stop(); this.view.message = 'Camera paused while this tab was hidden. Start again to resume.'; this.notify(); } };
  constructor(readonly canvas: HTMLCanvasElement) {
    this.compositor = new Compositor(canvas);
    const context = this.capture.getContext('2d', { alpha: false });
    if (!context) throw new Error('Video capture canvas is unavailable.');
    this.captureContext = context;
    this.capture.width = 720; this.capture.height = 1280;
    this.observer = new ResizeObserver(() => this.syncPreviewSize());
    this.observer.observe(canvas);
    this.syncPreviewSize();
    this.compositor.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.compositor.fx.onBloom = () => this.audio.bloom();
    this.ground.onplace = at => this.controller.placeSurface(at, 'detected');
    this.ground.onstatus = status => { this.controller.scene.ground = status; };
    this.audio.onwarning = message => { this.view.message = message; this.notify(); };
    this.recorder.onerror = error => { this.controller.machine.interruption = 'RECORDER_ERROR'; this.view.message = error.message; this.notify(); };
    this.compositor.fx.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    document.addEventListener('visibilitychange', this.onHidden);
  }
  private onContextLost = (e: Event) => { e.preventDefault(); if (!this.disposed) { void this.stop(); this.view.camera = 'error'; this.view.message = 'Graphics context was lost. Reload this page to restore the camera effects.'; this.notify(); } };
  private notify() { this.onview({ ...this.view }); }
  async start() {
    await this.stop(); const generation = ++this.generation;
    this.view.camera = 'loading'; this.view.message = 'Waiting for camera permission…'; this.notify();
    try {
      await this.audio.unlock().catch(() => { this.view.message = 'Sound unavailable; camera can continue.'; });
      if (generation !== this.generation || this.disposed) return;
      const video = await this.camera.start();
      if (generation !== this.generation || this.disposed) return;
      this.camera.stream?.getVideoTracks().forEach(t => t.addEventListener('ended', () => { if (this.active && !this.videoURL) { void this.stop(); this.view.camera = 'error'; this.view.message = 'Camera disconnected or permission was revoked. Reconnect and retry.'; this.notify(); } }));
      this.controller.reset(); this.controller.machine.send('STOP'); this.controller.start();
      this.ground.init();
      this.active = true; this.view.camera = 'live'; this.view.modelReady = false;
      this.view.message = 'Loading local vision models…'; this.beginRender(); this.notify();
      const vision = this.vision = new Vision();
      vision.onframe = raw => {
        if (vision !== this.vision || !this.active || document.hidden) return;
        this.acceptFrame(raw, video.videoWidth, video.videoHeight);
      };
      vision.onerror = message => { if (vision === this.vision) { vision.close(); this.vision = null; this.view.message = `Tracking unavailable: ${message} Use Manual mode or retry camera.`; this.view.modelReady = false; this.notify(); } };
      try {
        const delegate = await vision.init(message => { if (generation === this.generation) { this.view.message = message; this.notify(); } });
        if (generation !== this.generation) { vision.close(); return; }
        this.view.delegate = delegate; this.view.modelReady = true; this.view.message = this.audio.warning ?? ''; this.controller.ready(); this.notify();
      } catch (error) {
        if (generation !== this.generation) return;
        vision.close(); this.vision = null; this.controller.ready(); this.view.message = `Could not load tracking. ${cameraError(error)} Retry camera or use Manual mode.`; this.notify();
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.camera.stop(); this.view.camera = 'error'; this.controller.machine.interruption = 'CAMERA_DENIED'; this.view.message = cameraError(error); this.notify();
    }
  }
  acceptFrame(raw: VisionFrame, width: number, height: number) {
    const transform = coverTransform(width, height, this.canvas.width, this.canvas.height, this.compositor.mirror);
    this.controller.step({ ...raw, hands: raw.hands.map(h => ({ ...h, points: h.points.map(transform.map) })), pose: raw.pose.map(transform.map) }, raw.timestamp);
  }
  private beginRender() { cancelAnimationFrame(this.frameId); this.lastFrame = 0; this.fpsStart = performance.now(); this.frameCount = 0; this.frameId = requestAnimationFrame(this.render); }
  private render = (now: number) => {
    if (!this.active || this.disposed) return;
    const dt = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60; this.lastFrame = now;
    if (now - this.lastLayout > 250) this.updateLayout(now);
    if (this.view.modelReady && !this.controller.manual) this.vision?.sample(this.camera.video, now);
    this.ground.sample(this.camera.video, now, this.controller.aspect, this.compositor.mirror);
    this.controller.tick(now);
    for (const event of this.controller.events.splice(0)) {
      this.compositor.fx.handle(event, now);
      if (event.type === 'light') this.audio.strike();
      if (event.type === 'fuse') this.audio.fuse();
      if (event.type === 'effect') this.audio.effect(event.kind);
    }
    this.compositor.draw(this.camera.video, this.controller.scene, now, dt);
    if (this.recorder.recording) this.composeCapture();
    this.frameCount++;
    if (now - this.fpsStart > 1500) {
      this.view.fps = Math.round(this.frameCount * 1000 / (now - this.fpsStart)); this.fpsStart = now; this.frameCount = 0;
      this.slowCount = this.view.fps < 26 ? this.slowCount + 1 : 0;
      if (this.slowCount >= 2) this.compositor.fx.quality = .5;
      if (this.slowCount >= 4 && this.view.fps < 20 && !this.recorder.recording && this.quality === 720) this.resize(this.portrait, 540);
    }
    if (now - this.lastNotify > 180) { this.updateView(now); this.lastNotify = now; }
    if (this.recorder.recording && now - this.recorder.started > 120000) void this.stopRecording();
    this.frameId = requestAnimationFrame(this.render);
  };
  private updateView(now: number) {
    const s = this.controller.scene;
    this.view.phase = s.phase; this.view.recording = this.recorder.recording;
    this.view.ground = s.ground;
    this.view.torsoReady = !!s.torso.length || this.controller.guided;
    this.view.seconds = this.recorder.recording ? Math.floor((now - this.recorder.started) / 1000) : 0;
    this.view.manual = this.controller.manual; this.view.selected = s.kind; this.view.queued = s.queued;
    this.notify();
  }
  private updateLayout(now: number) {
    const controls = this.canvas.parentElement?.querySelector('.stage-controls');
    if (!controls) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.height) return;
    const manualControls = this.canvas.parentElement?.querySelector('.manual-actions');
    const boundary = Math.min(controls.getBoundingClientRect().top, manualControls?.getBoundingClientRect().top ?? Infinity);
    this.ground.bottom = Math.min(.82, (boundary - rect.top) / rect.height - .045);
    const crop = captureCrop(this.canvas.width, this.canvas.height, this.capture.width, this.capture.height);
    this.compositor.fx.frameLeft = crop.x / this.canvas.width;
    this.compositor.fx.frameRight = (crop.x + crop.w) / this.canvas.width;
    // Layout only bounds visibility. It supplies no evidence of real ground.
    this.lastLayout = now;
  }
  select(kind: Firework) { this.controller.select(kind); this.updateLayout(performance.now()); this.updateView(performance.now()); }
  reset() {
    const pointer = this.controller.scene.match?.head ?? { x: .34, y: .48 };
    this.controller.reset(); this.compositor.fx.clear(); this.audio.stop();
    if (this.controller.manual) this.controller.manualAt(pointer, performance.now());
    this.updateLayout(performance.now());
    this.updateView(performance.now());
  }
  setManual(value: boolean) {
    this.controller.manual = value; this.compositor.manual = value; this.reset();
    if (value) this.controller.manualAt({ x: .34, y: .48 }, performance.now());
    this.updateView(performance.now());
  }
  async studio(file?: File) {
    await this.stop(); this.videoURL = file ? URL.createObjectURL(file) : null;
    if (this.videoURL) { this.camera.video.src = this.videoURL; this.camera.video.loop = true; await this.camera.video.play(); }
    this.active = true; this.view.camera = 'live'; this.view.message = file ? 'Local video · Manual mode. No live hand tracking.' : 'Manual studio · No live camera. Move your cursor or touch the stage.';
    this.controller.reset(); this.setManual(true); await this.audio.unlock().catch(() => {}); this.beginRender(); this.notify();
    if (file) this.ground.init();
    else this.controller.placeSurface({ x: .5, y: Math.min(.72, this.ground.bottom - .03) });
  }
  pointer(p: Point) { if (this.active && !this.draggingObject) this.controller.manualAt(p, performance.now()); }
  private hitObject(p: Point) {
    const { object, support, kind } = this.controller.scene;
    const halfWidth = { Laxmi: .052, Rocket: .052, Anaar: .072, Gola: .095 }[kind];
    const top = { Laxmi: .075, Rocket: .14, Anaar: .105, Gola: .105 }[kind];
    return Math.abs((p.x - object.x) * this.controller.aspect) <= halfWidth &&
      p.y >= object.y - top && p.y <= support.y + .025;
  }
  pointerDown(p: Point) {
    if (!this.active) return false;
    if (this.controller.placed) {
      if (this.controller.busy || !this.hitObject(p) || !this.controller.beginObjectMove()) { this.pointer(p); return false; }
    } else {
      this.place(p);
      if (!this.controller.beginObjectMove()) { this.pointer(p); return false; }
    }
    this.draggingObject = true;
    this.dragOffset = { x: this.controller.scene.support.x - p.x, y: this.controller.scene.support.y - p.y };
    this.ground.setInteractionLock(true);
    this.canvas.style.cursor = 'grabbing';
    return true;
  }
  pointerMove(p: Point) {
    if (this.draggingObject) {
      const halfWidth = { Laxmi: .052, Rocket: .052, Anaar: .072, Gola: .095 }[this.controller.scene.kind];
      const edge = halfWidth / this.controller.aspect + .01;
      this.controller.moveObject({
        x: Math.max(edge, Math.min(1 - edge, p.x + this.dragOffset.x)),
        y: Math.max(.2, Math.min(this.ground.bottom, p.y + this.dragOffset.y)),
      });
      return;
    }
    this.pointer(p);
    this.canvas.style.cursor = this.controller.placed && !this.controller.busy && this.hitObject(p) ? 'grab' : '';
  }
  pointerUp() {
    if (!this.draggingObject) return;
    this.draggingObject = false;
    if (this.controller.scene.ground === 'detected') this.ground.reposition(this.controller.scene.support);
    this.ground.setInteractionLock(false);
    this.controller.endObjectMove();
    this.canvas.style.cursor = this.controller.placed ? 'grab' : '';
  }
  place(p: Point) {
    if (!this.active || this.controller.placed || this.controller.busy || p.y < .2 || p.y > this.ground.bottom) return;
    this.ground.close(); this.controller.placeSurface(p); this.updateView(performance.now());
  }
  light() { this.controller.light(performance.now()); }
  ignite() { this.controller.manualIgnite(performance.now()); }
  setGuided(value: boolean) { this.controller.guided = value; this.compositor.guided = value; }
  setMirror(value: boolean) { if (this.recorder.recording) return; this.compositor.mirror = value; if (this.camera.video.readyState >= 2) this.ground.reset(); this.reset(); }
  resize(portrait: boolean, quality: number) {
    if (this.recorder.recording) return;
    this.portrait = portrait; this.quality = quality;
    const width = portrait ? quality : Math.round(quality * 16 / 9), height = portrait ? Math.round(quality * 16 / 9) : quality;
    this.capture.width = width; this.capture.height = height;
    this.syncPreviewSize();
    this.view.resolution = `${width} × ${height}`; this.reset();
  }
  private syncPreviewSize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const aspect = rect.width / rect.height;
    // Keep the same pixel budget as 720×1280 while matching the ENTIRE display.
    // No CSS cover crop or portrait pillarboxing is applied to this scene.
    const height = Math.max(2, Math.round(Math.sqrt(this.quality ** 2 * 16 / 9 / aspect) / 2) * 2);
    const width = Math.max(2, Math.round(height * aspect / 2) * 2);
    if (this.canvas.width !== width || this.canvas.height !== height) this.compositor.resize(width, height);
    this.controller.aspect = width / height;
    this.updateLayout(performance.now());
  }
  private composeCapture() {
    const crop = captureCrop(this.canvas.width, this.canvas.height, this.capture.width, this.capture.height);
    this.captureContext.drawImage(this.canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, this.capture.width, this.capture.height);
    if (this.controller.manual) {
      const s = this.capture.height / 1280;
      this.captureContext.font = `${12 * s}px system-ui`; this.captureContext.fillStyle = '#ffffff80';
      this.captureContext.fillText('MANUAL', 18 * s, this.capture.height - 18 * s);
    }
  }
  async record() {
    if (this.recorder.recording) { await this.stopRecording(); return; }
    if (!this.active) return;
    try {
      let audioAvailable = true;
      try { await this.audio.unlock(); } catch { audioAvailable = false; }
      this.composeCapture();
      this.recorder.start(this.capture, audioAvailable ? this.audio.destination?.stream : undefined);
      this.view.message = audioAvailable ? this.audio.warning ?? '' : 'Recording video only. App audio is unavailable in this browser.';
    }
    catch (error) { this.view.message = cameraError(error); this.controller.machine.interruption = 'RECORDER_ERROR'; }
    this.updateView(performance.now());
  }
  async stopRecording() {
    try { const clip = await this.recorder.stop(); if (clip) { if (this.disposed) URL.revokeObjectURL(clip.url); else this.onclip(clip); } }
    catch (error) { this.view.message = cameraError(error); this.controller.machine.interruption = 'RECORDER_ERROR'; }
    this.updateView(performance.now());
  }
  async stop() {
    this.pointerUp();
    this.generation++; this.active = false; cancelAnimationFrame(this.frameId);
    this.view.message = '';
    this.vision?.close(); this.vision = null; this.camera.stop();
    this.ground.close(); this.controller.scene.ground = 'searching';
    if (this.videoURL) { this.camera.video.removeAttribute('src'); this.camera.video.load(); URL.revokeObjectURL(this.videoURL); this.videoURL = null; }
    if (this.recorder.recording) await this.stopRecording();
    this.audio.stop(); this.compositor.fx.clear(); this.controller.machine.send('STOP'); this.controller.manual = false; this.compositor.manual = false;
    this.compositor.ctx.fillStyle = '#161914'; this.compositor.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.view.camera = 'off'; this.view.ground = 'searching'; this.view.modelReady = false; this.view.recording = false; this.view.manual = false; this.notify();
  }
  async dispose() { this.disposed = true; this.observer.disconnect(); await this.stop(); document.removeEventListener('visibilitychange', this.onHidden); this.compositor.fx.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost); this.compositor.dispose(); await this.audio.dispose(); }
}
