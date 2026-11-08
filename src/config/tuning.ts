// Starting values, intentionally grouped for real-camera calibration. Units are
// seconds, milliseconds or fractions of output height / observed shoulder width.
export const TUNING = {
  pinchOn: 0.4, pinchOff: 0.72, pinchHold: 120, releaseGrace: 750,
  pinchTrackingGrace: 900, handLoss: 1300, identityRetention: 1800, identityRadius: 0.32,
  handFilterCutoff: 2.8, handFilterBeta: 0.2, handPredictionMs: 32, handPredictionLimit: 0.018,
  observationGrace: 500, poseGrace: 500,
  strokeTravel: 0.022, strokeReturn: 0.015, strokeMinTime: 80, contactGrace: 140,
  strokeWindow: 2400, strikeCooldown: 1000,
  matchLength: 0.052, matchLife: 16000,
  fuseRadius: 0.035, fuseDwell: 260, fuseAnchorTolerance: 0.012, fuseDuration: 850,
  effectDuration: { Laxmi: 4300, Rocket: 7100, Anaar: 5800, Gola: 4200 },
};
