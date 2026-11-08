export class CameraManager {
  video = document.createElement('video');
  stream: MediaStream | null = null;
  private generation = 0;
  facing: 'user' | 'environment' = 'user';
  constructor() { this.video.muted = true; this.video.playsInline = true; }
  async start() {
    this.stop();
    const generation = this.generation;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires HTTPS or localhost and a browser with camera support.');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
    if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); throw new DOMException('Camera request canceled.', 'AbortError'); }
    this.stream = stream;
    this.video.srcObject = this.stream;
    await this.video.play();
    return this.video;
  }
  stop() {
    this.generation++;
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
    this.video.pause(); this.video.srcObject = null;
  }
}
export function cameraError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Camera access was denied. Allow Camera in your browser’s site settings, then retry.';
    if (error.name === 'NotFoundError') return 'No camera found. Connect a webcam, then retry.';
    if (error.name === 'NotReadableError') return 'Camera is unavailable or in use by another app. Close that app, then retry.';
  }
  return error instanceof Error ? error.message : 'Unable to start camera. Please retry.';
}
