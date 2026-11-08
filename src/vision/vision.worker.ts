import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Point } from '../types';
import type { VisionRequest, VisionResponse } from './protocol';
let hand: HandLandmarker | null = null;
let pose: PoseLandmarker | null = null;
let lastPose: Point[] = [];
function send(message: VisionResponse) { self.postMessage(message); }
async function initialize(base: string) {
  const files = await FilesetResolver.forVisionTasks(`${base}vision/wasm`);
  for (const delegate of ['GPU', 'CPU'] as const) {
    try {
      send({ type: 'status', message: `Loading hand tracking · ${delegate}` });
      hand = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${base}models/hand_landmarker.task`, delegate }, runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: .45, minHandPresenceConfidence: .45, minTrackingConfidence: .4,
      });
      send({ type: 'status', message: `Loading body tracking · ${delegate}` });
      pose = await PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${base}models/pose_landmarker_lite.task`, delegate }, runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: .5, minPosePresenceConfidence: .5, minTrackingConfidence: .5, outputSegmentationMasks: false,
      });
      send({ type: 'ready', delegate }); return;
    } catch (error) {
      hand?.close(); pose?.close(); hand = null; pose = null;
      if (delegate === 'CPU') throw error;
      send({ type: 'status', message: 'Trying CPU compatibility mode…' });
    }
  }
}
self.onmessage = async (event: MessageEvent<VisionRequest>) => {
  const message = event.data;
  try {
    if (message.type === 'init') await initialize(message.base);
    else {
      try {
        if (!hand || !pose) throw new Error('Vision models have not initialized.');
        const start = performance.now();
        const hands = hand.detectForVideo(message.bitmap, message.timestamp);
        if (message.pose) lastPose = pose.detectForVideo(message.bitmap, message.timestamp).landmarks[0] ?? [];
        send({ type: 'frame', hands: hands.landmarks.map((points, i) => ({ points, label: hands.handedness[i]?.[0]?.categoryName ?? 'Unknown' })),
          pose: lastPose, timestamp: message.timestamp, elapsed: performance.now() - start });
      } finally { message.bitmap.close(); }
    }
  } catch (error) { send({ type: 'error', message: error instanceof Error ? error.message : 'Vision initialization failed.' }); }
};
