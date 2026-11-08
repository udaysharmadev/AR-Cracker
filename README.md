# FIREPLAY

Virtual fireworks. Real gestures. A local-first browser camera experience built with React, strict TypeScript, MediaPipe Tasks Vision, Three.js, Web Audio and MediaRecorder.

## Run

Requires Node **22.12+** (tested on Node 24.11) and a modern browser with WebGL2.

```sh
npm ci
npm run assets
npm run dev
```

Open **http://localhost:5173**. Grant camera access. The model and WASM files are already included under `public/`; `assets` restores them if needed and includes their licenses. All runtime assets are served locally. `predev` and `prebuild` bundle the compatible classic vision worker automatically.

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run preview
```

The browser suite uses installed **Google Chrome** (`channel: 'chrome'`), a fake video device, actual MediaPipe initialization, real local SegFormer inference over a road photo and a plain-sky negative image, and an explicitly labeled development-only landmark replay. Change Playwright's channel to a locally installed Chromium if necessary. Playwright itself is pinned in the lockfile.

Production: serve `dist/` on **HTTPS**. Camera permission works on localhost without HTTPS. No backend, API keys, database or authentication are required. `npm run preview` serves the compiled build on port 4173 for local verification.

## Use it

1. Press the central Play button. The camera/game fills the entire display; keep your shoulders and match hand visible. Hold a thumb/index pinch briefly to pick up a virtual match.
2. While pinching, rub the **match head** back and forth across your shirt—horizontal, vertical or diagonal strokes work. Short outbound travel plus a reversal inside the pose-derived torso lights the match. The faint shirt outline and small match-tip ring show contact/progress; sparks occur only during current motion. A single pass, stationary contact and body motion alone do not ignite.
3. Keep some **real ground visible in the video**. A local semantic model looks for floor, road, earth, grass, sidewalk or sand and places the prop inside a confident connected region. There is no artificial platform. Small camera movements are tracked and smoothed from the video's texture; moving your hands does not position the bomb. If ground cannot be found, tap the visible floor to place explicitly. Once placed, drag the prop itself with mouse or touch to pick it up and set it somewhere else; the fuse follows, and its contact timer resets. Bring the **lit head** to the glowing fuse and hold briefly. Unplaced props and unlit matches cannot ignite.
4. Choose **Laxmi Bomb, Rocket, Anaar or Gola Bomb**. Selection during an active effect is queued. Each new firework still requires fuse contact. The match burns for 16 seconds and can be relit.
5. Press the red Record circle (or **R**), align within the subtle recording frame, perform your gestures, then Stop. Preview and download the actual encoded file. The fullscreen scene is center-cropped to the selected 9:16 or 16:9 video format. Recording stops at two minutes or when you stop the camera / hide the tab.

Settings include 9:16 or 16:9 framing, 720p or lighter 540p capture, sound, mirror, gentler motion, debug landmarks and a deliberately labeled guided strike fallback. Recalibrating clears the held match and starts fresh pinch recognition. Manual controls use cursor/touch, **Space** to light the match and **Enter** to ignite the fuse; these controls are explicitly labeled and never represented as hand tracking. A no-camera manual studio is available, and you can open a local video as its background.

The normal view is a fullscreen game surface with icon-only firework inventory and controls. Website headlines, sidebars, footer, marketing copy and in-scene branding have been removed. A fullscreen icon can additionally request the browser's fullscreen mode where supported. Short gesture cues fade out; settings, errors and manual-mode disclosure remain available.

## What is implemented

| Area | Implementation |
|---|---|
| Camera | Real `getUserMedia`, mirrored cover crop, front/rear switch, permission/error/revocation handling, track shutdown, hidden-tab shutdown |
| Vision | Local Hand Landmarker (two hands) and Pose Landmarker in VIDEO mode, low-resolution worker input, GPU initialization with CPU fallback, one outstanding frame, adaptive inference cadence |
| Gestures | Hand identity retention, normalized pinch with hysteresis, bounded 250 ms hand/350 ms pose grace, shoulder/hip torso with cropped-hip estimate; shirt-relative principal-axis rubbing in any direction, short normalized travel/reversal, body-motion/jump rejection and match-length contact tolerance |
| Match / fuse | Finger-oriented wooden match, quick smoothing, fingertip occlusion patches, flickering flame, smoke, friction sparks, match lifetime, stale-hand fade, one coordinate system and guarded 260 ms fuse dwell |
| Laxmi Bomb | Small red/gold wrapped prop, short compact spark blast and the user-selected CSGO AWP snap/reverb |
| Rocket | Thin green/yellow foil body, pointed dark cap and striped stick; 1.8 s ascent and exhaust, fiery aerial bloom, secondary glitter; original-pitch whistle and explosion from the selected reference |
| Anaar | Material-lit red/gold/green cone with an ornate 27 badge; stays at the ground anchor before and after ignition; 4.3 s fountain, gravity/drag/turbulence, locally ground-colliding embers, smoke, hiss and crackle |
| Gola Bomb | Larger green rope-wrapped ball with red/gold band and pink fuse; 7.4× the Laxmi fireball radius, wider/faster sparks, expanding shock rings, heavy smoke and the selected Super Explosion sound; subtle shake disabled in gentler mode |
| Ground | Local quantized SegFormer B0 ADE20K worker, confidence and connected-region/footprint checks, two-observation acquisition, bounded patch-correlation video tracking, stale/lost-anchor hiding and explicit tap fallback; never a guessed lower-third labeled as ground |
| Rendering | Three.js shaded 3D props directly on the video ground with a soft contact shadow; geometric rope windings, authored paper/foil/fiber bump textures, warm key/rim/flame/flash lighting; pooled 10,000-slot GPU sparks, separate noise-shaped smoke and velocity tails; one WebGL renderer, adaptive particles/resolution and reduced motion |
| Export | Fullscreen authoritative composite includes real video, match, props and particles; the selected center crop is copied into a fixed 720×1280 or 1280×720 capture canvas. 30 FPS requested, app-audio mix, supported MIME detection, actual WebM/MP4 extension, preview and download. No brand watermark; manual recordings retain a small disclosure |
| Accessibility | Labeled controls, keyboard/manual alternatives, reduced motion, modal focus containment, guided torso fallback, no mic permission |

The full real interaction is the default. There are no fake landmarks, canned firework videos or timed auto-ignitions in the production path. The development replay is excluded from the production bundle.

## Verification and limits

Observed in this workspace:

- TypeScript strict typecheck and ESLint passed.
- Vitest: **61 tests passed**, covering match smoothing/prediction, easier but guarded shirt rubbing, firework repositioning, fuse/state/recording behavior, ground selection/tracking and no ignition before placement.
- Actual local SegFormer inference ran in Chrome: the official street fixture produced **43.38% confident road pixels**; a plain blue sky image produced **0% confident ground pixels**. The integrated video path acquired ground and displayed the prop directly on road pixels. This is a regression fixture, not a physical camera accuracy benchmark.
- Playwright: **12 tests passed** across development and production, including dragging all four placed fireworks, match recovery after a short tracking gap, the ground acquisition/video-stop flow, shirt rubbing, all four effects, playable **720×1280 WebM** with app audio, compact layout, real Hand/Pose initialization, production model loading and camera-track cleanup.
- Production build passed. Pinned installation audit reported **0 vulnerabilities**.

**Real webcam gestures have not been physically verified.** Synthetic tests validate algorithms and browser plumbing; they do not establish lighting tolerance, garment contact accuracy, user ergonomics or end-to-end tracking latency on a real person. `src/config/tuning.ts` groups the initial thresholds for that calibration. Shirt contact is inferred from 2D pose geometry and motion, not physical contact or clothing classification.

Ground placement is **2D semantic estimation plus conservative video translation tracking**, not calibrated depth, metric sizing, SLAM or a WebXR world anchor. There is no fabricated platform. Props are hidden until ground is acquired or explicitly placed. Large camera movement, camera roll/zoom, featureless floors, occlusion and out-of-frame ground can lose the anchor; expose the floor again to reacquire. Automatic placement requires two consistent semantic observations and may take several seconds. A tap fallback is explicitly manual placement, not a successful floor detection. A no-camera manual studio retains a manual scene position. Rocket movement starts only after its fuse burns; Anaar stays at the tracked ground anchor.

Chrome desktop is the verified automated target. Edge uses the same APIs but was not separately run. Safari/iOS and Android performance, front/rear switching on physical phones, audio playback quality and real-device recording need manual verification. Browser encoders and frame rate vary. Unsupported recording displays native-screen-recording guidance; audio initialization failure permits video-only recording. WebM can be used in an editor; direct Instagram import is device-dependent. MP4 is selected only when the browser genuinely reports support.

Full person segmentation is optional in the PRD and is not enabled: this version uses local fingertip patches for occlusion and leaves the effects in the foreground. Full-body occlusion, clothing classification, automatic showcase sequencing and microphone capture are not included. There is no bundled third-party actor/demo clip; the explicit manual studio accepts a local video. No personal media is bundled or uploaded.

## Real-device acceptance checklist

These remain **unchecked**, not claimed as passes:

- [ ] Fresh Chrome/Edge camera permission, mirrored crop and debug fingertips line up in portrait and landscape.
- [ ] Pinch with either hand; move quickly, cross hands, occlude and leave frame; match stays attached or fades and re-grabs without jumping.
- [ ] Rub at least twice on several shirts in bright/dim light; tune thresholds; passive chest passes and off-shirt movements never ignite.
- [ ] Show indoor tile, wood, concrete and outdoor ground in different light: prop rests on the visible ground, never a person/wall. Move hands: placement stays independent. Pan gently: texture follows; cover/remove floor or rotate/zoom quickly: stale placement is hidden and reacquired. Switch props: every base meets the same ground anchor.
- [ ] Unlit contact does nothing; lit dwell burns exactly one fuse. Laxmi, Rocket, Anaar and Gola each complete and reset.
- [ ] Compare export to preview: selfie, fingertips, flame, full effects, sound synchronization and portrait crop. Listen with device speakers/headphones; verify mute.
- [ ] Test phone portrait controls/safe areas, front/rear camera, 540p fallback, sustained FPS/temperature and 2-minute export.
- [ ] Deny/revoke/unplug camera; hide tab; stop during loading and while recording; no active camera indicator or leaked tracks remain.
- [ ] Safari/iOS: verify worker/GPU or CPU fallback and genuine recording MIME; use manual/native capture fallback if unavailable.

## Architecture

- `camera/coordinateTransform.ts`: the single raw-video → mirrored output mapping, including cover crop.
- `vision/`: local model worker, frame backpressure, identity assignment and pose geometry. The pinned SDK needs a classic worker because its WASM loader uses `importScripts`; `scripts/build-vision.mjs` builds it as an IIFE for development and production.
- `gestures/` and `engine/interactionController.ts`: deterministic recognition, explicit state machine, deadlines, interruption guards and effect events.
- `vision/ground.worker.ts`, `groundRegion.ts`, `groundTracker.ts`: local semantic logits, confident connected ground selection and video-only texture tracking. A separate module worker runs ONNX single-thread WASM at a throttled cadence, without blocking hand/pose inference or rendering. It uses the same cover crop/mirror as the video. No camera frames are uploaded.
- `fx/worldProps.ts`: real material-lit Three.js mesh props and ground contact shadow; original procedural texture/bump maps and rope geometry. The existing GPU renderer is reused for normal prop, normal smoke and additive spark passes; no extra WebGL context is created. Inventory thumbnails remain lightweight canvas artwork. `fx/compositor.ts` combines those passes with the camera, attached match, fuse and small contact feedback. The recording canvas copies the same completed composite.
- `audio/`: local decoded reference samples plus procedural match/fuse/fountain sounds, mixed to speakers and the recording destination. Only app audio is captured; no system sound or microphone. The Rocket MP3's original boom is at approximately 4.94 s; playback begins at 3.14 s to retain 1.8 s of original-pitch whistle before the visual blast. The entire explosion tail continues.
- `recording/`: format negotiation, isolated stream/audio clones, encoder errors and one-time stop/finalization.
- `src/dev/harness.ts`, `src/tests/`, `tests/`: deterministic landmark/video replay and automated validation. `?replay=1` works only under Vite development and displays a synthetic-replay label. Production ignores that query.

## Privacy and assets

Frames, landmarks and recordings stay in your browser. There are no analytics, remote inference calls, camera uploads or remote runtime assets. Start Camera is explicit. Stop Camera and tab hiding stop all webcam tracks and inference; clip URLs are revoked when dismissed. Camera switching also stops the old stream. The setup command downloads only public models/licenses.

All props, icons, particle presets, shader effects and match art are procedurally authored. The supplied photographs informed shape, color and material; their pixels, stock watermarks and commercial brand graphics are not shipped. No runtime hotlinks or remote font requests are used.

The three user-selected third-party sound recordings are optional local files under `public/audio/` and decoded through Web Audio when present. They are git-ignored because the source pages supply no open redistribution license. Keep them in a local checkout only if you have the rights to use them; provenance is in `public/audio/sources.json`, and the provided fetch script restores the exact URLs. Without these files, FIREPLAY uses its original procedural sound fallback. Match, fuse, fountain and compatibility fallback sounds remain original procedural synthesis.

- Rocket: [Bomb Explosion With Whistle](https://www.myinstants.com/en/instant/bomb-explosion-with-whistle-20035/), uploaded by GarlicBreadBen.
- Laxmi: [CSGO AWP](https://www.myinstants.com/en/instant/csgo-awp-14800/), uploaded by katerpillar.
- Gola: [Super Explosion](https://www.myinstants.com/en/instant/super-explosion-80886/), uploaded by BestNoob.

Third-party notices are included in `public/licenses/` and copied into production:

- **MediaPipe Tasks Vision 0.10.32, WASM and Google hand/pose models**: Apache-2.0. Official version-1 float16 model URLs and SHA-256 hashes are recorded in `public/models/manifest.json`. [MediaPipe license](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE), [hand model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20%28Lite_Full%29%20with%20Fairness%20Oct%202021.pdf).
- **Three.js 0.181.1**: MIT, Copyright Three.js authors.
- **React / React DOM 19.2.0**: MIT, Copyright Meta Platforms, Inc. and affiliates.
- **ONNX Runtime Web 1.23.2**: MIT; locally hosted matching WASM/glue. [Runtime license](https://github.com/microsoft/onnxruntime/blob/v1.23.2/LICENSE).
- **SegFormer B0 ADE20K quantized model**: pinned Xenova revision, checksum and provenance in `public/models/ground/source.json`. Upstream [NVIDIA license](https://github.com/NVlabs/SegFormer/blob/master/LICENSE) restricts use to noncommercial research/evaluation; this model is **not** MIT/Apache or cleared for a commercial launch. The license is bundled under `public/licenses/SegFormer-NVIDIA.txt`.
- Development dependencies retain their respective licenses in `node_modules`; pinned versions are in `package-lock.json`.

Official implementation references consulted: [Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js), [Three.js renderer](https://threejs.org/docs/pages/WebGLRenderer.html), [camera](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [canvas capture](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream), [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder).
