import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraManager, cameraError } from '../camera/cameraManager';
afterEach(() => vi.unstubAllGlobals());
describe('camera lifecycle', () => {
  it('stops a late permission result without replacing a newer camera', async () => {
    const video = { muted: false, playsInline: false, srcObject: null, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn() };
    vi.stubGlobal('document', { createElement: () => video });
    const staleStop = vi.fn(), currentStop = vi.fn();
    const stale = { getTracks: () => [{ stop: staleStop }] }, current = { getTracks: () => [{ stop: currentStop }] };
    let release: (s: unknown) => void = () => {};
    const pending = new Promise(resolve => { release = resolve; });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockReturnValueOnce(pending).mockResolvedValueOnce(current) } });
    const c = new CameraManager(), old = c.start();
    const rejection = expect(old).rejects.toThrow('canceled');
    await c.start(); release(stale); await rejection;
    expect(c.stream).toBe(current); expect(staleStop).toHaveBeenCalledOnce(); expect(currentStop).not.toHaveBeenCalled();
    c.stop(); expect(currentStop).toHaveBeenCalledOnce(); expect(video.srcObject).toBeNull();
  });
  it('explains denied, absent and busy cameras', () => {
    expect(cameraError(new DOMException('', 'NotAllowedError'))).toContain('site settings');
    expect(cameraError(new DOMException('', 'NotFoundError'))).toContain('No camera');
    expect(cameraError(new DOMException('', 'NotReadableError'))).toContain('another app');
  });
});
