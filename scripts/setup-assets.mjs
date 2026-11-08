import { mkdir, cp, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const models = {
  'hand_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  'pose_landmarker_lite.task': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
};
await mkdir('public/models', { recursive: true });
await mkdir('public/licenses', { recursive: true });
await cp('node_modules/three/LICENSE', 'public/licenses/THREE.txt');
await cp('node_modules/react/LICENSE', 'public/licenses/React.txt');
const ortLicense = await fetch('https://raw.githubusercontent.com/microsoft/onnxruntime/v1.23.2/LICENSE');
if (!ortLicense.ok) throw new Error('ONNX Runtime license unavailable');
await writeFile('public/licenses/ONNX-Runtime-MIT.txt', await ortLicense.text());
const licensePath = 'public/licenses/MediaPipe-Apache-2.0.txt';
try { await stat(licensePath); } catch {
  const license = await fetch('https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE');
  if (!license.ok) throw new Error('Could not download the MediaPipe Apache-2.0 license.');
  await writeFile(licensePath, await license.text());
}
await cp('node_modules/@mediapipe/tasks-vision/wasm', 'public/vision/wasm', { recursive: true });
const manifest = {};
for (const [name, url] of Object.entries(models)) {
  const path = `public/models/${name}`;
  let exists = false;
  try { exists = (await stat(path)).size > 100000; } catch { /* first install */ }
  if (!exists) {
    console.log(`Downloading version 1 model: ${name}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await writeFile(path, bytes);
    manifest[name] = { url, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
}
if (Object.keys(manifest).length) await writeFile('public/models/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
const revision = 'd3e5499fa8701ff0453ca940a8dfeae39b2f1504';
const groundBase = `https://huggingface.co/Xenova/segformer-b0-finetuned-ade-512-512/resolve/${revision}/`;
await mkdir('public/models/ground', { recursive: true });
for (const name of ['onnx/model_quantized.onnx', 'config.json', 'preprocessor_config.json']) {
  const path = `public/models/ground/${name.split('/').at(-1)}`;
  try { await stat(path); continue; } catch { /* restore a missing model asset */ }
  const response = await fetch(groundBase + name);
  if (!response.ok) throw new Error(`Ground ${name}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (name.endsWith('.onnx') && createHash('sha256').update(bytes).digest('hex') !== '9a98d6daf3d926869ab8cc4c2ed7374a2bc23b889bb7ca3b0915d15e3c4756bb') throw new Error('Ground model checksum mismatch');
  await writeFile(path, bytes);
}
const groundLicense = await fetch('https://raw.githubusercontent.com/NVlabs/SegFormer/master/LICENSE');
if (!groundLicense.ok) throw new Error('Ground model license unavailable');
await writeFile('public/licenses/SegFormer-NVIDIA.txt', await groundLicense.text());
await writeFile('public/models/ground/source.json', JSON.stringify({ model: 'Xenova/segformer-b0-finetuned-ade-512-512', revision, url: groundBase + 'onnx/model_quantized.onnx', sha256: '9a98d6daf3d926869ab8cc4c2ed7374a2bc23b889bb7ca3b0915d15e3c4756bb', license: 'NVIDIA Source Code License — noncommercial research/evaluation', licenseUrl: 'https://github.com/NVlabs/SegFormer/blob/master/LICENSE' }, null, 2) + '\n');
console.log('Local model and WASM assets ready.');
