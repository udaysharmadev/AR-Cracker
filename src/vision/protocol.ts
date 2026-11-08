import type { Point } from '../types';
export type VisionRequest = { type: 'init'; base: string } | { type: 'frame'; bitmap: ImageBitmap; timestamp: number; pose: boolean };
export type VisionResponse = { type: 'ready'; delegate: string } | { type: 'status'; message: string } | { type: 'error'; message: string } |
  { type: 'frame'; hands: { label: string; points: Point[] }[]; pose: Point[]; timestamp: number; elapsed: number };
