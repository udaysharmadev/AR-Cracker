import type { Phase, Interruption } from '../types';
export type Event = 'START' | 'LOADED' | 'GRAB' | 'RUB' | 'LIGHT' | 'CONTACT' | 'FUSE_DONE' | 'EFFECT_DONE' | 'RESET' | 'RELEASE' | 'EXPIRE' | 'STOP';
const transitions: Partial<Record<Phase, Partial<Record<Event, Phase>>>> = {
  CAMERA_OFF: { START: 'LOADING' }, LOADING: { LOADED: 'READY' },
  READY: { GRAB: 'MATCH_HELD' }, MATCH_HELD: { RUB: 'STRIKING', LIGHT: 'MATCH_LIT', RELEASE: 'READY' },
  STRIKING: { LIGHT: 'MATCH_LIT', RELEASE: 'READY', GRAB: 'MATCH_HELD' },
  MATCH_LIT: { CONTACT: 'FUSE_IGNITING', EXPIRE: 'MATCH_HELD' },
  FUSE_IGNITING: { FUSE_DONE: 'EFFECT_PLAYING' }, EFFECT_PLAYING: { EFFECT_DONE: 'RESETTING' },
  RESETTING: { LIGHT: 'MATCH_LIT', RESET: 'READY' },
};
export class StateMachine {
  phase: Phase = 'CAMERA_OFF';
  interruption: Interruption = null;
  send(event: Event) {
    if (event === 'STOP') { this.phase = 'CAMERA_OFF'; this.interruption = null; return; }
    this.phase = transitions[this.phase]?.[event] ?? this.phase;
  }
}
