export type Point = { x: number; y: number; z?: number; visibility?: number };
export type Hand = { id: number; label: string; points: Point[]; seen: number };
export type VisionFrame = { hands: Hand[]; pose: Point[]; timestamp: number };
export type Firework = 'Laxmi' | 'Rocket' | 'Anaar' | 'Gola';
export type MatchPose = { grip: Point; head: Point; angle: number; alpha: number; lit: boolean };
export type Phase = 'CAMERA_OFF' | 'LOADING' | 'READY' | 'MATCH_HELD' | 'STRIKING' | 'MATCH_LIT' | 'FUSE_IGNITING' | 'EFFECT_PLAYING' | 'RESETTING';
export type Interruption = 'CAMERA_DENIED' | 'NO_PERSON' | 'TRACKING_LOST' | 'RECORDER_ERROR' | null;
export type Scene = {
  phase: Phase; interruption: Interruption; match: MatchPose | null;
  object: Point; support: Point; fuse: Point; kind: Firework; queued: Firework;
  ground: 'searching' | 'detected' | 'manual' | 'lost' | 'unavailable';
  torso: Point[]; hands: Hand[]; fallback: boolean;
  fuseProgress: number; proximity: number; effectAge: number; strike: number; contact: boolean;
};
export type EffectEvent = { type: 'strike' | 'light' | 'fuse' | 'effect'; at: Point; kind: Firework };
