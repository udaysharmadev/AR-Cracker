export const MIME_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'];
export function chooseMime(supports: (mime: string) => boolean) { return MIME_TYPES.find(supports) ?? null; }
export function recordingFilename(mime: string, date = new Date()) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `fireplay-${stamp}.${mime.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
}
export type Clip = { blob: Blob; filename: string; url: string; audio: boolean };
export class Recorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private result: Promise<Clip> | null = null;
  onerror: (error: Error) => void = () => {};
  recording = false;
  started = 0;
  start(canvas: HTMLCanvasElement, audio?: MediaStream) {
    if (this.recording) return;
    if (this.recorder) throw new Error('Finishing the previous clip. Please try again in a moment.');
    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) throw new Error('Recording is unavailable in this browser. Use native screen recording; AR still works.');
    const mimeType = chooseMime(m => MediaRecorder.isTypeSupported(m));
    if (!mimeType) throw new Error('No supported video encoder found. Use native screen recording or current Chrome/Edge.');
    this.stream = canvas.captureStream(30);
    // Clone audio: stopping a clip must not stop the shared app audio destination.
    try {
      audio?.getAudioTracks().forEach(track => this.stream?.addTrack(track.clone()));
      const recorder = this.recorder = new MediaRecorder(this.stream, { mimeType, videoBitsPerSecond: canvas.height > 1000 ? 5500000 : 3500000, audioBitsPerSecond: 128000 });
      this.chunks = [];
      this.result = new Promise<Clip>((resolve, reject) => {
        recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
        recorder.onerror = () => { const error = new Error('Recording failed. Try lower quality or native screen recording.'); this.cleanup(); this.onerror(error); reject(error); };
        recorder.onstop = () => {
          const mime = recorder.mimeType || mimeType;
          const blob = new Blob(this.chunks, { type: mime });
          const withAudio = !!this.stream?.getAudioTracks().length;
          this.cleanup();
          if (!blob.size) { reject(new Error('The recording was empty. Record for a few seconds and retry.')); return; }
          resolve({ blob, filename: recordingFilename(mime), url: URL.createObjectURL(blob), audio: withAudio });
        };
      });
      // An encoder error may occur before the user clicks Stop.
      void this.result.catch(() => {});
      recorder.start(250); this.recording = true; this.started = performance.now();
    } catch (error) { this.cleanup(); throw error; }
  }
  async stop() {
    const result = this.result;
    this.result = null;
    this.recording = false;
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    return result ? await result : null;
  }
  private cleanup() {
    this.recording = false;
    if (this.recorder) { this.recorder.ondataavailable = null; this.recorder.onstop = null; this.recorder.onerror = null; }
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null; this.recorder = null; this.chunks = [];
  }
}
