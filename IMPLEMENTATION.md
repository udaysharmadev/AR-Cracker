# FIREPLAY implementation contract

Scope: implement the supplied PRD in this empty workspace, using a local-first Vite / React / strict TypeScript app. Camera frames never leave the browser. No deployment is requested.

## Plan

| Phase | Files | Change | Risk / recovery |
|---|---|---|---|
| 0 | package/config, camera/, vision/, app/ | Camera lifecycle, crop transform, local MediaPipe assets, worker inference and loading/errors | GPU initialization can fail; retry CPU. Camera denial must leave Retry available. |
| 1 | gestures/, engine/, fx/, tests/ | Stable hand IDs, normalized pinch, torso stroke reversal, attached match, guarded fuse, Pop | Synthetic tests cannot certify a physical gesture. Expose debug and tuning; list real-device checks. |
| 2 | fx/, audio/ | Pooled GPU sparks, Rocket ascent/bloom, Anaar fountain, synthesized audio | Cap particle buffers; freeze an ignited object's anchor; queue selections. |
| 3 | app/, styles, fx/ | Camera-first UI, smoothing, adaptive quality, manual accessibility | Keep tracking and rendering outside React. Optional segmentation is performance-dependent. |
| 4 | recording/, tests/, README | Composite portrait capture, supported MIME, audio mix, browser tests and build | Preserve actual MIME and clean every stream; surface failures. |

Acceptance: actual webcam MediaPipe input; testable pinch/strike/collision/state logic; three distinct complete effects; composite 720×1280 recording; no dead controls; typecheck/lint/unit/browser/build checks. Real webcam accuracy and mobile performance remain unverified until observed on hardware.

Decision: use one worker for local Hand/Pose Landmarker inference, one authoritative 2D output canvas containing the mirrored video plus Three.js GPU effects and authored props, native Web Audio synthesis and MediaRecorder. This keeps coordinates and export identical without introducing a backend or media dependencies.

Verification evidence and outstanding checks are recorded in README after implementation.

## Observed delivery evidence — 2026-11-08

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm test`: `Test Files 3 passed (3)`, `Tests 24 passed (24)`.
- `npm run test:e2e`: `4 passed (47.3s)`, including actual models in the compiled production build and playable portrait export with decoded non-silent audio.
- `npm run build`: `✓ built in 638ms`; production contains local versioned assets and no development replay API.
- Pinned dependency installation: `found 0 vulnerabilities`.
- Screenshots inspected for the welcome, live framing, rocket, fountain and mobile/manual layouts; corrected additive-light compositing and control overlap from observed screenshots.

Conditional delegation: gravitas verifier, because camera/gesture/export criteria are interdependent. A read-only independent review found worker-format, cancellation, stream-finalization, manual-dwell and layout issues; each was corrected and the affected checks rerun.

Phases 0–4 are implemented and automated checks pass. Live-person hardware acceptance remains pending; no physical gesture or phone performance pass is claimed. See README for the unchecked manual tests and optional omissions.

VERDICT: PASS (automated implementation checks; physical webcam acceptance pending)

## Reference firework revision

Request: use the supplied visual and sound references; a thin stick Rocket with a launch/boom sequence, a small sharp Laxmi Bomb, a much larger heavy Gola Bomb, and a red/gold/green Anaar.

| Files | Change | Risk / check |
|---|---|---|
| types, tuning, firework geometry, controller/runtime | Four selectable effects, consistent larger prop/fuse geometry and shared rocket timing | Unit-test collision and queue/reset for all four. Preserve real camera gestures. |
| audio engine, public/audio | Local copies of user-selected sounds, decoded Web Audio playback through existing export mix | Inspect audio durations/transients; align rocket bloom to explosion; retain synthesized fallback on decode failure and record provenance. |
| props, compositor, particle engine, UI | Original reference-inspired props; small Laxmi snap versus much wider Gola fireball, rings, embers/smoke | Screenshot each prop and effect, retain reduced motion and clear bottom controls. |
| tests, README | Four-effect export and audio checks, updated sources and device limitations | Run typecheck, lint, unit/browser tests and rebuild the production preview. |

Decision: retain the existing tracking/gesture/recording architecture; make the requested changes in the prop, effect and audio layers. The reference photographs are design references, not shipped image textures; no watermarked stock pixels are used.

### Revision verification

- Typecheck and lint: exit 0.
- Unit suite: `Tests 30 passed (30)`.
- Browser suite: `7 passed (45.7s)`; all four gesture-driven effects exported with decoded app audio, local sample/rocket-transient alignment, compact layout regression and production inference/cleanup passed.
- Production: `✓ built in 705ms`.
- Inspected reference-inspired Gola, Rocket and Anaar props and Gola blast screenshots. The actual in-app preview exposed bottom-control overlap at a short viewport; the final scene computes its available lower boundary from the rendered controls and retains an unobstructed fuse. The compact browser regression passed and the refreshed in-app view was visually checked.
- Preview remains on http://127.0.0.1:4173/ ready for Start Camera. Original-pitch selected audio is local and included through the existing recording mix. Provenance and third-party rights are recorded in README and public/audio/sources.json.
- Real-person gesture accuracy and device audio/performance testing remain unverified, as before.

VERDICT: PASS

## Lower-latency match and easier ignition

Latest feedback: the match visibly jitters/lags behind the hand, and shirt rubbing is hard to register.

| Area | Change | Verification |
|---|---|---|
| Landmark tracking | Adaptive One Euro smoothing per landmark plus at most 32 ms of bounded translation prediction; schedule the next worker frame as soon as inference permits | Noisy landmark damping, stable ID, and bounded prediction unit trace |
| Match pickup | Accept a natural pinch after 120 ms with a slightly wider normalized threshold | Pinch timing/scale tests and browser grab regression |
| Shirt rubbing | Reduce outbound/return travel and minimum time; preserve progress across one brief shirt-edge miss and rebase after tracking gaps so absent movement is never counted | Compact stroke, stationary/jitter/pass-through rejection, brief edge-loss trace |

Verification: **57 unit tests passed**, strict typecheck and lint passed, production build passed, and the full Chrome suite passed **11/11**. Added tests cover jitter damping, bounded motion prediction, brief shirt-edge misses, a smaller faster rub, and rejection of stationary/jitter/pass-through motion. Existing short vertical-rub, pickup continuity, effects, recording, local model and ground regressions still pass. Physical webcam timing/gesture calibration remains unverified; the real MediaPipe worker was initialized with a fake camera in browser tests. Vite retains its existing 511.28 kB Three.js chunk-size advisory.

VERDICT: PASS (automated checks; physical camera check pending)

## Reposition placed fireworks

Latest request: after the floor prop appears, let the player pick it up and set it at a different visible spot.

| Area | Change | Verification |
|---|---|---|
| Pointer/touch input | Hit-test the visible firework, capture the pointer, and drag while preserving the grab offset; a first tap can still place an unplaced prop | Browser pointer-drag trace for all four props |
| Ground and fuse state | Freeze ground patch-following while the player moves the prop, then re-anchor texture tracking at release; keep prop bottom seated and reset fuse dwell | Verify object/fuse follow support, detected/manual status persists, and no fuse collision advances while dragging |

Verification: **61 unit tests passed**, strict typecheck and lint passed, production build passed, and the full Chrome suite passed **12/12**. The browser test dragged Laxmi, Rocket, Anaar and Gola and verified that each firework, support and fuse moved together while staying seated. Real-device touch-camera testing remains unverified; pointer capture uses the same Pointer Events path for mouse and touch.

## Larger Gola blast

Increased only Gola's visual blast radius from 260 to 480, particle count from 1,950 to 2,500, velocity from 680 to 900, and smoke from 110 to 170. Laxmi, Rocket and Anaar presets are unchanged.

Verification: typecheck/lint passed, **55 unit tests passed**, production build passed, and the Chrome Gola reference-effect screenshot test passed. Inspect `test-results/reference-gola-fireball.png` for the larger fireball and shock ring. Vite still reports the existing 511 kB Three.js chunk advisory.

VERDICT: PASS

## Keep match attached during rubbing

Latest feedback: match disappears midway through a shirt rub and hand recognition drops.

| Area | Change | Verification |
|---|---|---|
| Pickup/latch | Pinch picks up the match; once held, it follows that same visible hand even if thumb and index separate while rubbing | Open-finger hand landmark trace and moving match-position assertion |
| Tracking recovery | Keep the match visible through short landmark gaps, pause friction/fuse dwell while absent, and reacquire the same hand ID | Brief dropout/fade/reacquisition trace; long-loss cleanup and fresh-pinch assertion |
| Hand model | Lower MediaPipe presence/detection thresholds modestly for partial shirt occlusion | Worker initialization and browser interaction regression; physical camera still needs verification |

Verification: **55 unit tests passed**, strict lint passed, the production build passed, and the complete Chrome suite passed **11/11**. The new browser regression loosens the pinch while the same hand moves, simulates a 400 ms landmark dropout, and confirms match recovery/opacity; the short vertical rub and missing-frame ignition regression also passed. The camera/MediaPipe worker initialized in browser testing with a fake webcam, but a physical hand/camera run is still required to calibrate real lighting, occlusion and tracking behavior. Vite retains its existing 511.28 kB Three.js chunk-size advisory.

VERDICT: PASS

## Actual-video ground placement revision

Latest user clarification supersedes the interrupted striker/record-removal request: T-shirt ignition works; preserve match logic, recording and existing controls. Only remove the artificial podium and place the prop on ground visible in the playing video.

| Area | Change | Verification |
|---|---|---|
| Ground vision | Locally hosted semantic floor/road/earth segmentation in a separate throttled worker; confidence/connected-region checks; no default detected plane | Actual-model positive/negative image inference plus mask selection tests. |
| Ground tracking | Place inside a real detected floor region; follow visible texture using bounded feature matching; hide on loss; explicit tap-to-place fallback | Translation/scale/loss traces; do not confuse manual placement with detected ground. |
| Controller/rendering | Remove podium mesh and fixed layout anchor; retain a soft contact shadow on the video surface and preserve existing prop graphics | Screenshots, stable contact and no object before placement; all existing shirt/fuse guards remain. |
| Tests/docs | Preserve shirt and export regressions; document monocular surface-estimation limits | Typecheck/lint/unit/browser/production checks. |

Decision: use actual semantic model output and video texture for 2D ground estimation; no hard-coded lower-third rectangle is described as detected ground. Webcam video alone does not provide calibrated metric 3D planes; uncertain/no-floor footage stays unplaced and can be explicitly placed by the user.

Scope refinement: preserve prop sizes/upright orientation as requested by the final user clarification. Texture tracking supports small translations; camera roll/zoom and large perspective changes require reacquisition, rather than claiming full 3D reconstruction. NVIDIA model license is noncommercial research/evaluation, documented and bundled separately from the MIT runtime.

Verification: **52 unit tests passed**, strict typecheck and lint passed, and the complete Chrome suite passed **10/10 (56.8s)**. The new actual-model regression ran pinned local SegFormer inference: ADE20K road label occupied 43.38% of the official street fixture at confidence ≥0.55, while a uniform sky-negative image produced 0%. The video integration test auto-detected ground, displayed Gola directly over road imagery with no podium, retained its anchor while idle, and cleared detection on stop. Existing shirt rub/fuse behavior, four effects, recording and actual production Hand/Pose path all passed in the same browser suite. `npm run build` passed; Vite retains its existing 511.28 kB Three.js chunk advisory. Screenshot `test-results/actual-ground.png`. A physical webcam and other actual floor materials remain device checks. SegFormer’s upstream license limits commercial use to noncommercial research/evaluation.

VERDICT: PASS

## Easier match ignition and steadier ground lock

Latest user feedback: shirt rubbing still takes too much effort and video-placed props need fewer visible tracking glitches.

| Area | Change | Verification |
|---|---|---|
| Shirt friction | Reduce minimum back-and-forth travel and dwell while preserving actual torso contact, motion, reversal and cooldown | Shorter-stroke acceptance plus jitter, stationary and one-way rejection regressions |
| Ground lock | Smooth subpixel frame motion, allow brief tracking gaps, and restart fuse contact dwell when the anchor materially shifts | Texture jitter/pan/loss traces and fuse-target stability tests |
| Delivery | Keep visual props, shirt pose input and 9:16 recording | Full unit, browser and production-build checks |

Decision: ease the gesture while retaining a real directional reversal and freshness/contact checks. Smooth only the visual anchor; a meaningful target shift still resets fuse dwell.

Verification: **55 unit tests passed**, including a compact 0.035 outbound / 0.028 return shirt trace, jitter and one-way rejection, one-pixel anchor damping and cumulative fuse-anchor drift rejection. Strict typecheck and lint passed. Full Chrome suite passed **10/10 (52.5s)**, covering the shirt rub flow, actual local ground segmentation, placed-road screenshot, four effect recording, and production build/model checks. Physical camera calibration is still unverified. The camera/model system cannot promise perfect tracking under every light, surface, occlusion or camera movement; uncertain anchors are hidden for reacquisition.

VERDICT: PASS

## Reliable rubbing and stationary 3D platform revision

User reports physical rubbing does not ignite, wants the bomb to stay on one surface, and asks for realistic graphics/logic.

| Area | Change | Evidence/check |
|---|---|---|
| Shirt/pinch/pose | Principal-axis (including vertical) back-and-forth rubbing, shorter normalized strokes, bounded hand/pose dropout grace, match-length contact margin and current-motion sparks | Regression traces for vertical/diagonal rubs, jitter/pass-through rejection, brief versus stale tracking loss and body-motion compensation. |
| Controller/layout | One fixed support point; every prop's bottom rests on it; remove palm-following and Anaar relocation | Move both hands/body repeatedly; support/object/fuse must remain unchanged; lit contact still required. |
| Rendering | Real Three.js material-lit meshes, rope geometry, foil/paper bump maps and a shaded podium, using the existing WebGL renderer for normal props and additive particles | Inspect screenshots, surface contact and recorded composite; retain fullscreen/minimal HUD. |
| Tests/docs | Update gesture/platform regressions, browser export and remaining real-device limits | Typecheck, lint, unit/browser tests and production build. |

Decision: the geometric contact detector remains honest 2D CV inference, with visible feedback and bounded missing-frame tolerance; no automatic/manual ignition is hidden inside the real camera path. Platform placement is screen-space virtual staging, not a claim of reconstructed real-world furniture. Conditional read-only investigator confirmed horizontal-only detection, excessive stroke lengths, immediate loss resets and historical-progress sparks as concrete failure paths.

Verification: strict typecheck and lint passed; `Tests 48 passed (48)`; browser suite `8 passed (45.9s)`; production `✓ built in 697ms`. The new browser regression accepts a short vertical rub through a missing observation, then confirms stationary support/object/fuse positions while the second hand moves and verifies real lit fuse dwell. All four 3D effects record with decoded app audio. Shader/production camera checks passed. The actual in-app preview was refreshed and the shaded rope object/platform contact visually inspected; screenshot fireplay-3d-platform.png. Physical camera gesture calibration remains pending. The Three.js chunk is 511.28 kB / 131.14 kB gzip and emits Vite's size advisory; build succeeds.

VERDICT: PASS

## Fullscreen game revision

Request: make the experience fill the entire display and remove essentially all website copy.

| Files | Change | Verification |
|---|---|---|
| App/styles | Delete landing-page chrome, side copy, headline, footer and verbose hints; full-viewport play surface, icon inventory/record controls and optional settings | Check desktop, portrait and compact viewports; accessible labels remain. |
| Runtime/compositor/camera transform | Render the actual viewport aspect with a single mapping; center-crop the same composite into a separate fixed 9:16/16:9 recording canvas | Preserve gesture/fuse mapping and 720×1280 export; no CSS second crop. |
| Tests/README | Update UI assertions and fullscreen/export checks | Typecheck, lint, unit/browser suite and production build. |

Decision: fullscreen is the game surface, while recording format remains an export setting. Remove website framing in the DOM instead of merely hiding a landing page with CSS. Preserve only essential permission/loading/error feedback and explicit manual-mode disclosure.

Verification: typecheck/lint passed; `Tests 34 passed (34)`; browser suite `7 passed (46.4s)`; production `✓ built in 633ms`. Desktop 1440×1000 and compact 319×504 surfaces occupy the complete viewport, with no website headers/footers/sidebars/headline. The four-effect portrait export remains playable at 720×1280 with decoded app audio. The actual in-app preview was refreshed and the minimal fullscreen controls/scene were visually checked. Screenshot: fireplay-fullscreen.png.

VERDICT: PASS
