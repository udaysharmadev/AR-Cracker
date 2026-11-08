import * as THREE from 'three';
import type { EffectEvent, Firework, Point, Scene } from '../types';
import { BLAST_PRESETS, fusePoint, ROCKET_FLIGHT } from '../config/fireworks';
import { WorldProps } from './worldProps';

const CAPACITY = 10000;
const GOLD = [1, .55, .13] as const;
type RGB = readonly [number, number, number];
const COLORS: RGB[] = [[1, .3, .2], [.2, .65, 1], [.55, .35, 1], [1, .7, .25], [.25, 1, .65]];
const vertex = `attribute float size; attribute float alpha; attribute float seed; varying float vSeed; varying vec3 vColor; varying float vAlpha;
  void main(){vColor=color;vAlpha=alpha;vSeed=seed;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size;}`;
const fragment = `varying vec3 vColor; varying float vAlpha;
  void main(){float r=length(gl_PointCoord-.5)*2.; if(r>1.)discard;
  float core=exp(-r*r*32.);float glow=exp(-r*r*5.)*.3;
  gl_FragColor=vec4(mix(vColor,vec3(1.),core*.8),(core+glow)*vAlpha);}`;
const smokeFragment = `varying vec3 vColor; varying float vAlpha; varying float vSeed; uniform float time;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
  void main(){if(vAlpha<.001)discard;vec2 p=(gl_PointCoord-.5)*2.;float r=length(p);if(r>1.)discard;
  float n=noise(p*3.+vSeed+vec2(0.,time*.12))*.65+noise(p*7.+vSeed)*.35;
  gl_FragColor=vec4(vColor*(.65+n*.5),smoothstep(1.,.15,r)*(.3+n*.7)*vAlpha*.21);}`;

export class ParticleEngine {
  renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private positions = new Float32Array(CAPACITY * 3);
  private colors = new Float32Array(CAPACITY * 3);
  private baseColors = new Float32Array(CAPACITY * 3);
  private sizes = new Float32Array(CAPACITY);
  private seeds = new Float32Array(CAPACITY);
  private velocity = new Float32Array(CAPACITY * 3);
  private life = new Float32Array(CAPACITY);
  private age = new Float32Array(CAPACITY);
  private baseSize = new Float32Array(CAPACITY);
  private smoke = new Uint8Array(CAPACITY);
  private sparkPositions = new Float32Array(CAPACITY * 3);
  private smokePositions = new Float32Array(CAPACITY * 3);
  private sparkAlpha = new Float32Array(CAPACITY);
  private smokeAlpha = new Float32Array(CAPACITY);
  private linePositions = new Float32Array(CAPACITY * 6);
  private lineColors = new Float32Array(CAPACITY * 6);
  private geometry: THREE.BufferGeometry;
  private smokeGeometry: THREE.BufferGeometry;
  private lineGeometry: THREE.BufferGeometry;
  private materials: THREE.Material[];
  private world = new WorldProps();
  private cloud: THREE.Points;
  private points: THREE.Points;
  private tails: THREE.LineSegments;
  private smokeMaterial: THREE.ShaderMaterial;
  private cursor = 0;
  private width = 720;
  private height = 1280;
  private clock = 0;
  private effect: { kind: Firework; at: Point; start: number; burst: boolean; glitter: boolean } | null = null;
  private emitterRemainder = 0;
  private flameRemainder = 0;
  quality = 1;
  reduced = false;
  frameLeft = 0;
  frameRight = 1;
  onBloom: () => void = () => {};

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setClearColor(0, 0); this.renderer.setPixelRatio(1);
    this.geometry = this.makeGeometry(this.sparkPositions, this.sparkAlpha);
    this.smokeGeometry = this.makeGeometry(this.smokePositions, this.smokeAlpha);
    const spark = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    const smoke = this.smokeMaterial = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: smokeFragment, uniforms: { time: { value: 0 } }, vertexColors: true, transparent: true, depthWrite: false, depthTest: false });
    const cloud = this.cloud = new THREE.Points(this.smokeGeometry, smoke); cloud.frustumCulled = false; cloud.renderOrder = 0;
    const points = this.points = new THREE.Points(this.geometry, spark); points.frustumCulled = false; points.renderOrder = 2;
    this.lineGeometry = new THREE.BufferGeometry();
    this.lineGeometry.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.lineGeometry.setAttribute('color', new THREE.BufferAttribute(this.lineColors, 3).setUsage(THREE.DynamicDrawUsage));
    const line = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .65, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
    const tails = this.tails = new THREE.LineSegments(this.lineGeometry, line); tails.frustumCulled = false; tails.renderOrder = 1;
    this.scene.add(cloud, tails, points); this.materials = [spark, smoke, line]; this.resize(720, 1280);
  }
  private makeGeometry(position: Float32Array, alpha: Float32Array) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('seed', new THREE.BufferAttribute(this.seeds, 1).setUsage(THREE.DynamicDrawUsage));
    return g;
  }
  resize(width: number, height: number) {
    // Simulation units stay 1280 high. Output quality can change independently.
    this.width = width / height * 1280; this.height = 1280;
    this.camera.left = 0; this.camera.right = this.width; this.camera.top = this.height; this.camera.bottom = 0; this.camera.near = -1000; this.camera.far = 1000; this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
  private spawn(p: Point, vx: number, vy: number, life: number, size: number, color: RGB, smoke = false) {
    const i = this.cursor++ % CAPACITY, n = i * 3;
    this.positions[n] = p.x * this.width; this.positions[n + 1] = (1 - p.y) * this.height; this.positions[n + 2] = (Math.random() - .5) * 90;
    this.velocity[n] = vx; this.velocity[n + 1] = vy; this.velocity[n + 2] = Math.random() * 6;
    this.life[i] = life; this.age[i] = 0; this.baseSize[i] = size; this.smoke[i] = +smoke;
    this.seeds[i] = Math.random() * 100;
    this.colors[n] = this.baseColors[n] = color[0]; this.colors[n + 1] = this.baseColors[n + 1] = color[1]; this.colors[n + 2] = this.baseColors[n + 2] = color[2];
  }
  burst(at: Point, kind: Exclude<Firework, 'Anaar'>) {
    const preset = BLAST_PRESETS[kind], rocket = kind === 'Rocket';
    const count = Math.round(preset.count * this.quality * (this.reduced ? .55 : 1));
    const selected = COLORS[Math.floor(Math.random() * COLORS.length)];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, z = Math.random() * 2 - 1;
      const radial = Math.sqrt(1 - z * z), speed = preset.speed * (.35 + Math.random() * .65);
      this.spawn(at, Math.cos(a) * radial * speed, Math.sin(a) * radial * speed,
        preset.life + Math.random() * preset.tail, 6 + Math.random() * (kind === 'Gola' ? 16 : 9), i % 5 ? (rocket ? selected : GOLD) : COLORS[i % COLORS.length]);
    }
    for (let i = 0; i < preset.smoke * this.quality; i++) this.spawn(at, (Math.random() - .5) * (kind === 'Gola' ? 180 : 85), Math.random() * 90, 2 + Math.random() * 1.8, 45 + Math.random() * (kind === 'Gola' ? 115 : 50), [.34, .32, .29], true);
  }
  handle(event: EffectEvent, now: number) {
    if (event.type === 'effect') {
      this.effect = { kind: event.kind, at: event.at, start: now, burst: false, glitter: false };
      if (event.kind === 'Laxmi' || event.kind === 'Gola') this.burst(event.at, event.kind);
    } else if (event.type === 'light' || event.type === 'strike') {
      for (let i = 0; i < (event.type === 'light' ? 45 : 4); i++) this.spawn(event.at, (Math.random() - .5) * 140, 10 + Math.random() * 160, .15 + Math.random() * .4, 4 + Math.random() * 5, GOLD);
    }
  }
  rocketPosition(age: number, at: Point): Point {
    const t = Math.min(1, age / (ROCKET_FLIGHT / 1000));
    // Drift toward an upper corner, keeping the central face area clearer.
    const destination = this.frameLeft + (this.frameRight - this.frameLeft) * (at.x >= .5 ? .76 : .24);
    return { x: at.x + (destination - at.x) * t * t, y: at.y - (at.y - .26) * (t * t * .65 + t * .35) };
  }
  rocketBloom(at: Point): Point { const p = this.rocketPosition(ROCKET_FLIGHT / 1000, at); return { x: p.x, y: p.y - .045 }; }
  update(now: number, delta: number, scene: Scene) {
    const dt = Math.min(.05, delta); this.clock += dt;
    const density = this.quality * (this.reduced ? .5 : 1);
    const effect = this.effect;
    if (effect) {
      effect.at = scene.object;
      const age = (now - effect.start) / 1000;
      if (effect.kind === 'Rocket') {
        if (age < ROCKET_FLIGHT / 1000) {
          const p = this.rocketPosition(age, effect.at);
          const at = fusePoint('Rocket', p, p, 1);
          this.emitterRemainder += dt * 520 * density;
          while (this.emitterRemainder >= 1) { this.emitterRemainder--; this.spawn(at, (Math.random() - .5) * 65, -80 - Math.random() * 180, .35 + Math.random() * .5, 6 + Math.random() * 9, GOLD); }
          if (Math.random() < .6) this.spawn(at, (Math.random() - .5) * 30, -30, 1.3, 35, [.34, .32, .3], true);
        } else if (!effect.burst) { effect.burst = true; this.burst(this.rocketBloom(effect.at), 'Rocket'); this.onBloom(); }
        if (age > ROCKET_FLIGHT / 1000 + .7 && !effect.glitter) { effect.glitter = true;
          const at = this.rocketBloom(effect.at);
          for (let j = 0; j < 7; j++) this.burstSmall({ x: at.x + (Math.random() - .5) * .7 * (this.frameRight - this.frameLeft), y: at.y + (Math.random() - .5) * .22 });
        }
      } else if (effect.kind === 'Anaar' && age < 4.3) {
        const envelope = Math.min(1, age * 4) * Math.min(1, (4.3 - age) * 2);
        this.emitterRemainder += dt * 850 * density * envelope;
        const at = fusePoint('Anaar', effect.at, effect.at, 1);
        while (this.emitterRemainder >= 1) {
          this.emitterRemainder--;
          const a = (Math.random() - .5) * 1.1, speed = (350 + Math.random() * 520) * (this.reduced ? .8 : 1);
          this.spawn(at, Math.sin(a) * speed * .7, Math.cos(a) * speed, 1.1 + Math.random() * 1.2, 4 + Math.random() * 8, Math.random() > .15 ? GOLD : [1, .85, .5]);
        }
        if (Math.random() < dt * 18) this.spawn(at, (Math.random() - .5) * 45, 50 + Math.random() * 40, 2.7, 45 + Math.random() * 30, [.3, .28, .24], true);
      }
      if (age > 8) this.effect = null;
    }
    const m = scene.match;
    if (m?.lit && m.alpha > .5) {
      this.flameRemainder += dt * 30 * this.quality;
      while (this.flameRemainder >= 1) {
        this.flameRemainder--; this.spawn({ x: m.head.x, y: m.head.y - .015 }, (Math.random() - .5) * 18, 26 + Math.random() * 18, .7 + Math.random() * .6, 13 + Math.random() * 14, [.37, .35, .32], true);
      }
    }
    if (scene.phase === 'FUSE_IGNITING') {
      const t = scene.fuseProgress;
      const at = fusePoint(scene.kind, scene.object, scene.fuse, t);
      for (let i = 0; i < 3 * this.quality; i++) this.spawn(at, (Math.random() - .5) * 100, 20 + Math.random() * 100, .12 + Math.random() * .35, 5 + Math.random() * 6, GOLD);
    }
    const outputScale = this.renderer.domElement.height / 1280;
    for (let i = 0; i < CAPACITY; i++) {
      const n = i * 3, l = i * 6;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this.sparkAlpha[i] = this.smokeAlpha[i] = 0; this.lineColors.fill(0, l, l + 6); continue; }
      const smoke = this.smoke[i] === 1, age = this.age[i] / this.life[i];
      const drag = Math.exp(-(smoke ? .6 : .65) * dt);
      this.velocity[n] *= drag;
      this.velocity[n + 1] = this.velocity[n + 1] * drag - (smoke ? -8 : 210) * dt;
      this.positions[n] += (this.velocity[n] + Math.sin(this.clock * 3 + i) * (smoke ? 8 : 5)) * dt;
      this.positions[n + 1] += this.velocity[n + 1] * dt;
      // Local contact with the video ground near the anchored prop.
      const floor = (1 - scene.support.y) * 1280;
      const overGround = (scene.ground === 'detected' || scene.ground === 'manual') && Math.abs(this.positions[n] - scene.support.x * this.width) < 165;
      if (!smoke && overGround && this.positions[n + 1] < floor && this.positions[n + 1] > floor - 30 && this.velocity[n + 1] < 0) { this.positions[n + 1] = floor; this.velocity[n + 1] *= -.25; this.velocity[n] *= .7; }
      const fade = Math.pow(1 - age, smoke ? .8 : 1.2);
      // Hot gold cools through orange to red as each ember loses energy.
      this.colors[n] = this.baseColors[n];
      this.colors[n + 1] = this.baseColors[n + 1] * (smoke ? 1 : 1 - age * .65);
      this.colors[n + 2] = this.baseColors[n + 2] * (smoke ? 1 : 1 - age * .92);
      this.sizes[i] = this.baseSize[i] * (smoke ? 1 + age * 2.5 : .6 + .4 * fade) * outputScale;
      const destination = smoke ? this.smokePositions : this.sparkPositions;
      destination[n] = this.positions[n]; destination[n + 1] = this.positions[n + 1]; destination[n + 2] = this.positions[n + 2];
      this.sparkAlpha[i] = smoke ? 0 : fade * (.75 + .25 * Math.sin(i * 14 + this.clock * 32)); this.smokeAlpha[i] = smoke ? fade : 0;
      this.linePositions[l] = this.positions[n]; this.linePositions[l + 1] = this.positions[n + 1]; this.linePositions[l + 2] = this.positions[n + 2];
      this.linePositions[l + 3] = this.positions[n] - this.velocity[n] * .043; this.linePositions[l + 4] = this.positions[n + 1] - this.velocity[n + 1] * .043; this.linePositions[l + 5] = this.positions[n + 2];
      for (let j = 0; j < 3; j++) { this.lineColors[l + j] = smoke ? 0 : this.colors[n + j] * fade * .55; this.lineColors[l + 3 + j] = 0; }
    }
    for (const g of [this.geometry, this.smokeGeometry, this.lineGeometry]) for (const a of Object.values(g.attributes)) a.needsUpdate = true;
    this.smokeMaterial.uniforms.time.value = this.clock;
  }
  renderWorld(state: Scene, now: number) { this.world.update(state, this.width, now, (age, at) => this.rocketPosition(age, at)); this.renderer.render(this.world.scene, this.camera); }
  renderSmoke() { this.cloud.visible = true; this.points.visible = this.tails.visible = false; this.renderer.render(this.scene, this.camera); }
  renderSparks() { this.cloud.visible = false; this.points.visible = this.tails.visible = true; this.renderer.render(this.scene, this.camera); }
  private burstSmall(at: Point) {
    for (let i = 0; i < 40 * this.quality; i++) { const a = Math.random() * Math.PI * 2; this.spawn(at, Math.cos(a) * 75, Math.sin(a) * 75, .7 + Math.random() * 1.2, 5, [1, .82, .42]); }
  }
  clear() { this.life.fill(0); this.effect = null; this.emitterRemainder = 0; }
  dispose() { this.world.dispose(); this.geometry.dispose(); this.smokeGeometry.dispose(); this.lineGeometry.dispose(); this.materials.forEach(m => m.dispose()); this.renderer.dispose(); this.renderer.forceContextLoss(); }
}
