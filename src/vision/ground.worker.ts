import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm';

// ADE20K ground classes. Furniture, people, walls and sky are never placement
// surfaces. This is semantic image estimation, not metric 3D plane recovery.
const ground = new Set([3, 6, 9, 11, 13, 29, 46, 52]);
let session: InferenceSession | null = null;
const size = 512, plane = size * size;
const canvas = new OffscreenCanvas(size, size);
const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
self.onmessage = async (event: MessageEvent<{ type: 'init'; base: string } | { type: 'frame'; bitmap: ImageBitmap; timestamp: number }>) => {
  const message = event.data;
  try {
    if (message.type === 'init') {
      env.wasm.numThreads = 1; env.wasm.proxy = false;
      env.wasm.wasmPaths = new URL('vision/ground-wasm/', message.base).href;
      session = await InferenceSession.create(new URL('models/ground/model_quantized.onnx', message.base).href, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      self.postMessage({ type: 'ready' }); return;
    }
    const { bitmap, timestamp } = message;
    try { ctx.drawImage(bitmap, 0, 0, size, size); } finally { bitmap.close(); }
    if (!session) throw new Error('Ground model is not ready');
    const pixels = ctx.getImageData(0, 0, size, size).data;
    const input = new Float32Array(plane * 3);
    const mean = [.485, .456, .406], std = [.229, .224, .225];
    for (let c = 0; c < 3; c++) for (let i = 0; i < plane; i++) input[c * plane + i] = (pixels[i * 4 + c] / 255 - mean[c]) / std[c];
    const tensor = new Tensor('float32', input, [1, 3, size, size]);
    let result: Record<string, Tensor>;
    try { result = await session.run({ pixel_values: tensor }); } finally { tensor.dispose(); }
    const logits = result.logits;
    const [, classes, height, width] = logits.dims, count = width * height;
    const data = logits.data as Float32Array;
    const mask = new Uint8Array(count), labels = new Uint8Array(count);
    for (let p = 0; p < count; p++) {
      let best = -Infinity, label = 0;
      for (let c = 0; c < classes; c++) if (data[c * count + p] > best) { best = data[c * count + p]; label = c; }
      if (!ground.has(label)) continue;
      let sum = 0;
      for (let c = 0; c < classes; c++) sum += Math.exp(data[c * count + p] - best);
      mask[p] = Math.round(255 / sum); labels[p] = label;
    }
    for (const value of Object.values(result)) value.dispose();
    self.postMessage({ type: 'mask', mask, labels, width, height, timestamp }, { transfer: [mask.buffer, labels.buffer] });
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
};
