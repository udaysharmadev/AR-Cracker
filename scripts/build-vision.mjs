import { build } from 'esbuild';
import { mkdir, cp } from 'node:fs/promises';
// Tasks Vision 0.10.32 internally uses importScripts for its WASM loader. A
// classic bundled worker is required in BOTH Vite dev and production builds.
await build({ entryPoints: ['src/vision/vision.worker.ts'], outfile: 'public/vision/worker.js', bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true });
await build({ entryPoints: ['src/vision/ground.worker.ts'], outfile: 'public/vision/ground-worker.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true });
await mkdir('public/vision/ground-wasm', { recursive: true });
for (const name of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) await cp(`node_modules/onnxruntime-web/dist/${name}`, `public/vision/ground-wasm/${name}`);
