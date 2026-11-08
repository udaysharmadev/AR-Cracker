import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseMime, Recorder, recordingFilename } from '../recording/recorder';
afterEach(() => vi.unstubAllGlobals());
describe('honest recording formats', () => {
  it('chooses only a supported encoder, preferring WebM and allowing genuine MP4', () => {
    expect(chooseMime(m => m === 'video/webm')).toBe('video/webm');
    expect(chooseMime(m => m === 'video/mp4')).toBe('video/mp4');
    expect(chooseMime(() => false)).toBeNull();
  });
  it('names files by the actual container', () => {
    const d = new Date(2026, 10, 8, 14, 5, 9);
    expect(recordingFilename('video/webm;codecs=vp9', d)).toBe('fireplay-20261108-140509.webm');
    expect(recordingFilename('video/mp4', d)).toBe('fireplay-20261108-140509.mp4');
  });
  it('reports unsupported recording before capturing tracks', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const canvas = { captureStream: vi.fn() };
    expect(() => new Recorder().start(canvas as unknown as HTMLCanvasElement)).toThrow('Recording is unavailable');
    expect(canvas.captureStream).not.toHaveBeenCalled();
  });
  it('cleans captured tracks if encoder construction fails', () => {
    const stop = vi.fn();
    const canvas = { captureStream: () => ({ getTracks: () => [{ stop }], addTrack: vi.fn() }) };
    class BrokenRecorder { static isTypeSupported() { return true; } constructor() { throw new Error('encoder unavailable'); } }
    vi.stubGlobal('MediaRecorder', BrokenRecorder);
    expect(() => new Recorder().start(canvas as unknown as HTMLCanvasElement)).toThrow('encoder unavailable'); expect(stop).toHaveBeenCalledOnce();
  });
  it('finishes once, prevents overlapping encoders and stops clones rather than shared audio', async () => {
    const videoStop = vi.fn(), cloneStop = vi.fn(), sharedStop = vi.fn();
    const tracks: { stop: () => void }[] = [{ stop: videoStop }];
    const stream = { getTracks: () => tracks, getAudioTracks: () => tracks.slice(1), addTrack: (t: { stop: () => void }) => tracks.push(t) };
    const canvas = { captureStream: () => stream };
    class FakeRecorder {
      static isTypeSupported() { return true; }
      state = 'inactive'; mimeType = 'video/webm';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null; onerror: (() => void) | null = null;
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(['a real chunk']) }); this.onstop?.(); }); }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const audio = { getAudioTracks: () => [{ stop: sharedStop, clone: () => ({ stop: cloneStop }) }] };
    const r = new Recorder(); r.start(canvas as unknown as HTMLCanvasElement, audio as unknown as MediaStream);
    const result = r.stop(); expect(r.recording).toBe(false);
    expect(() => r.start(canvas as unknown as HTMLCanvasElement)).toThrow('Finishing');
    expect(await r.stop()).toBeNull();
    const clip = await result; expect(clip?.blob.size).toBeGreaterThan(0); expect(clip?.audio).toBe(true);
    expect(videoStop).toHaveBeenCalledOnce(); expect(cloneStop).toHaveBeenCalledOnce(); expect(sharedStop).not.toHaveBeenCalled();
    if (clip) URL.revokeObjectURL(clip.url);
  });
});
