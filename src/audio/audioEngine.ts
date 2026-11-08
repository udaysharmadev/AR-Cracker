import type { Firework } from '../types';
import { REFERENCE_AUDIO, ROCKET_AUDIO_OFFSET, type SampleKind } from '../config/fireworks';
export class AudioEngine {
  context: AudioContext | null = null;
  destination: MediaStreamAudioDestinationNode | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private sources = new Set<AudioScheduledSourceNode>();
  private samples = new Map<SampleKind, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private rocketSamplePlaying = false;
  warning: string | null = null;
  get sampleCount() { return this.samples.size; }
  onwarning: (message: string) => void = () => {};
  muted = false;
  async unlock() {
    if (!this.context) {
      const c = this.context = new AudioContext();
      this.destination = c.createMediaStreamDestination();
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : .32;
      const compressor = c.createDynamicsCompressor();
      compressor.threshold.value = -15; compressor.ratio.value = 5;
      this.master.connect(compressor); compressor.connect(c.destination); compressor.connect(this.destination);
      this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    await this.context.resume();
    if (!this.loading) {
      const c = this.context;
      this.loading = Promise.allSettled((Object.keys(REFERENCE_AUDIO) as SampleKind[]).map(async kind => {
        if (this.samples.has(kind)) return;
        const url = new URL(`${import.meta.env.BASE_URL}${REFERENCE_AUDIO[kind].url}`, location.href);
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`${kind}: HTTP ${response.status}`);
        const buffer = await c.decodeAudioData(await response.arrayBuffer());
        this.samples.set(kind, buffer);
      })).then(results => {
        this.warning = results.some(r => r.status === 'rejected') ? 'A reference sound could not load. Procedural sound is being used; retry camera to try again.' : null;
        if (this.warning) { this.loading = null; this.onwarning(this.warning); }
      });
    }
    await this.loading;
  }
  private playReference(kind: SampleKind, offset = 0) {
    const c = this.context, buffer = this.samples.get(kind);
    if (!c || !buffer || !this.master) return false;
    const source = c.createBufferSource(), gain = c.createGain();
    source.buffer = buffer; gain.gain.value = REFERENCE_AUDIO[kind].gain;
    source.connect(gain); gain.connect(this.master); this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); gain.disconnect(); };
    source.start(c.currentTime, offset);
    return true;
  }
  setMute(muted: boolean) { this.muted = muted; if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : .32, this.context.currentTime, .03); }
  private hiss(duration: number, volume: number, frequency: number, delay = 0) {
    const c = this.context; if (!c || !this.master || !this.noise) return;
    const start = c.currentTime + delay;
    const source = c.createBufferSource(); source.buffer = this.noise; source.loop = true;
    const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = .6;
    const gain = c.createGain(); gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .008); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(start); source.stop(start + duration); this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  private tone(from: number, to: number, duration: number, volume: number, type: OscillatorType = 'sine', delay = 0) {
    const c = this.context; if (!c || !this.master) return;
    const start = c.currentTime + delay, osc = c.createOscillator(), gain = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(from, start); osc.frequency.exponentialRampToValueAtTime(to, start + duration);
    gain.gain.setValueAtTime(.0001, start); gain.gain.linearRampToValueAtTime(volume, start + .012); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(start); osc.stop(start + duration); this.sources.add(osc);
    osc.onended = () => { this.sources.delete(osc); osc.disconnect(); gain.disconnect(); };
  }
  strike() { this.hiss(.18, .33, 2300); this.hiss(.32, .16, 4800, .08); }
  fuse() { this.hiss(.85, .18, 5200); }
  pop() { this.hiss(.65, .8, 260); this.hiss(.2, .45, 2400); this.tone(120, 38, .35, .55); this.hiss(1.3, .14, 6800, .15); }
  launch() { this.rocketSamplePlaying = this.playReference('Rocket', ROCKET_AUDIO_OFFSET); if (!this.rocketSamplePlaying) { this.hiss(1.8, .23, 1500); this.tone(420, 2100, 1.8, .15, 'sine'); } }
  bloom() { if (this.rocketSamplePlaying) return; this.hiss(1.25, .9, 180); this.tone(85, 30, .8, .4); this.hiss(2, .25, 7000, .2); for (let i = 0; i < 7; i++) this.hiss(.08, .08, 3800, .5 + i * .15); }
  fountain() { this.hiss(4.3, .6, 4300); for (let i = 0; i < 20; i++) this.hiss(.06, .11, 1800 + Math.random() * 3000, i * .2); }
  effect(kind: Firework) {
    if (kind === 'Rocket') this.launch();
    else if (kind === 'Anaar') this.fountain();
    else if (!this.playReference(kind)) { this.pop(); if (kind === 'Gola') { this.tone(65, 24, 1.7, .6); this.hiss(2.6, .65, 180); } }
  }
  stop() { for (const source of this.sources) { try { source.stop(); } catch { /* already stopped */ } } this.sources.clear(); this.rocketSamplePlaying = false; }
  async dispose() { this.stop(); await this.context?.close(); this.context = null; this.master = null; this.destination = null; this.samples.clear(); this.loading = null; }
}
