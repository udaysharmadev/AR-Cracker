import * as THREE from 'three';
import type { Firework, Point, Scene } from '../types';
import { FIREWORKS, PROP_SCALE, ROCKET_FLIGHT } from '../config/fireworks';

function texture(kind: 'paper' | 'rope' | 'foil', label?: Firework) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = kind === 'rope' ? '#a2a69a' : '#b62120'; ctx.fillRect(0, 0, 512, 512);
  const pixels = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const x = i / 4 % 512, y = Math.floor(i / 4 / 512);
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const grain = (n - Math.floor(n) - .5) * (kind === 'rope' ? 50 : 28);
    const fiber = kind === 'rope' ? Math.sin(y * 1.7 + Math.sin(x * .04) * 3) * 16 : 0;
    for (let c = 0; c < 3; c++) pixels.data[i + c] += grain + fiber;
  }
  ctx.putImageData(pixels, 0, 0);
  if (label) {
    ctx.fillStyle = '#ddbd66';
    for (const y of [22, 72, 390, 456]) ctx.fillRect(0, y, 512, 7);
    if (label === 'Anaar') {
      for (const y of [100, 350]) {
        ctx.beginPath(); ctx.moveTo(0, y);
        for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + (x % 64 ? 48 : 0));
        for (let x = 512; x >= 0; x -= 32) ctx.lineTo(x, y + 12 + (x % 64 ? 48 : 0));
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#125039'; ctx.beginPath(); ctx.ellipse(256, 265, 96, 120, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#efd17a'; ctx.lineWidth = 7; ctx.stroke();
      ctx.fillStyle = '#ffe8a1'; ctx.font = 'bold 96px Georgia'; ctx.textAlign = 'center'; ctx.fillText('27', 256, 294);
    } else {
      ctx.fillStyle = label === 'Rocket' ? '#14592b' : '#18523b'; ctx.fillRect(128, 110, 256, 250);
      ctx.strokeStyle = '#e5c568'; ctx.lineWidth = 5; ctx.strokeRect(128, 110, 256, 250);
      ctx.fillStyle = '#ffeac2'; ctx.textAlign = 'center'; ctx.font = `bold ${label === 'Rocket' ? 38 : 40}px Georgia`; ctx.fillText(label === 'Rocket' ? 'ROCKET' : 'LAXMI', 256, 248);
    }
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#ead18a'; ctx.textAlign = 'center'; ctx.fillText('VIRTUAL • FIREPLAY', 256, 422);
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
  return map;
}
function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); return m;
}
function ropeCurve(points: THREE.Vector3[], radius: number, material: THREE.Material) {
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 96, radius, 5, true), material);
}

export class WorldProps {
  scene = new THREE.Scene();
  private objects = new Map<Firework, THREE.Group>();
  private contactShadow: THREE.Mesh;
  private flameLight = new THREE.PointLight(0xffad55, 0, 380, 2);
  private flashLight = new THREE.PointLight(0xffab55, 0, 750, 2);
  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xe9edf3, 0x333224, 1.35));
    const key = new THREE.DirectionalLight(0xffe8cc, 3.4); key.position.set(-300, 600, 800);
    const rim = new THREE.DirectionalLight(0xc4d9f2, .9); rim.position.set(400, 150, -200);
    this.scene.add(key, rim, this.flameLight, this.flashLight);
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
    const c = shadowCanvas.getContext('2d')!, gradient = c.createRadialGradient(64, 64, 2, 64, 64, 64);
    gradient.addColorStop(0, '#000b'); gradient.addColorStop(.4, '#0007'); gradient.addColorStop(1, '#0000'); c.fillStyle = gradient; c.fillRect(0, 0, 128, 128);
    this.contactShadow = mesh(new THREE.PlaneGeometry(180, 60), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
    this.scene.add(this.contactShadow);
    for (const kind of FIREWORKS) { const group = this.build(kind); group.scale.setScalar(PROP_SCALE[kind]); group.visible = false; this.objects.set(kind, group); this.scene.add(group); }
  }
  private build(kind: Firework) {
    const group = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8ae49, metalness: .7, roughness: .36 });
    if (kind === 'Gola') {
      const fiber = texture('rope');
      const cloth = new THREE.MeshStandardMaterial({ color: 0x315c45, map: fiber, bumpMap: fiber, bumpScale: 2.4, roughness: .98 });
      const rope = new THREE.MeshStandardMaterial({ color: 0x426e4d, map: fiber, bumpMap: fiber, bumpScale: 1.4, roughness: .95 });
      const ball = new THREE.Group(); ball.position.y = -5;
      ball.add(mesh(new THREE.SphereGeometry(64, 48, 32), cloth));
      for (let i = 0; i < 16; i++) {
        const points: THREE.Vector3[] = [];
        for (let j = 0; j < 80; j++) {
          const t = j / 80 * Math.PI * 2, phi = i / 16 * Math.PI + Math.sin(t * 3 + i) * .12, r = 65 + Math.sin(t * 7 + i) * .8;
          points.push(new THREE.Vector3(Math.sin(t) * Math.cos(phi) * r, Math.cos(t) * r, Math.sin(t) * Math.sin(phi) * r));
        }
        ball.add(ropeCurve(points, 4, rope));
      }
      for (let i = -4; i <= 4; i++) {
        const y = i * 12, r = Math.sqrt(65 ** 2 - y ** 2), points: THREE.Vector3[] = [];
        for (let j = 0; j < 80; j++) { const a = j / 80 * Math.PI * 2; points.push(new THREE.Vector3(Math.cos(a) * r, y + Math.sin(a * 3 + i) * 4, Math.sin(a) * r)); }
        ball.add(ropeCurve(points, 4, rope));
      }
      const band = new THREE.MeshStandardMaterial({ color: 0xba2424, metalness: .32, roughness: .42 });
      ball.add(mesh(new THREE.SphereGeometry(69, 64, 12, 0, Math.PI * 2, 1.27, .54), band));
      for (const angle of [1.27, 1.81]) { const ring = mesh(new THREE.TorusGeometry(Math.sin(angle) * 69, 1.8, 8, 96), gold, 0, Math.cos(angle) * 69); ring.rotation.x = Math.PI / 2; ball.add(ring); }
      group.add(ball);
    } else if (kind === 'Rocket') {
      const wood = new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: .9 });
      group.add(mesh(new THREE.CylinderGeometry(2, 2, 130, 10), wood, 0, -43));
      const map = texture('foil', 'Rocket');
      const wrap = new THREE.MeshStandardMaterial({ map, metalness: .3, roughness: .43, bumpMap: map, bumpScale: .25 });
      const tube = mesh(new THREE.CylinderGeometry(14, 14, 68, 48), wrap, 0, 54); tube.rotation.y = Math.PI; group.add(tube);
      group.add(mesh(new THREE.ConeGeometry(18, 40, 48), new THREE.MeshStandardMaterial({ color: 0x11291c, roughness: .58, metalness: .15 }), 0, 106));
      for (const y of [22, 87]) { const ring = mesh(new THREE.TorusGeometry(14, 1.4, 8, 48), gold, 0, y); ring.rotation.x = Math.PI / 2; group.add(ring); }
    } else {
      const map = texture(kind === 'Anaar' ? 'foil' : 'paper', kind);
      const wrap = new THREE.MeshStandardMaterial({ map, metalness: kind === 'Anaar' ? .4 : .05, roughness: kind === 'Anaar' ? .42 : .87, bumpMap: map, bumpScale: kind === 'Anaar' ? .3 : .65 });
      const body = kind === 'Anaar' ? mesh(new THREE.CylinderGeometry(7, 54, 146, 64), wrap, 0, 12) : mesh(new THREE.CylinderGeometry(27, 27, 88, 48), wrap, 0, -1);
      body.rotation.y = Math.PI; group.add(body);
      const radius = kind === 'Anaar' ? 54 : 27, base = kind === 'Anaar' ? -61 : -45;
      for (const y of [base + 3, kind === 'Anaar' ? 80 : 43]) { const ring = mesh(new THREE.TorusGeometry(y > 0 && kind === 'Anaar' ? 8 : radius, 1.6, 8, 64), gold, 0, y); ring.rotation.x = Math.PI / 2; group.add(ring); }
    }
    return group;
  }
  update(state: Scene, width: number, now: number, rocketPosition: (age: number, at: Point) => Point) {
    const ground = (1 - state.support.y) * 1280;
    const placed = state.ground === 'detected' || state.ground === 'manual';
    this.contactShadow.position.set(state.support.x * width + 9, ground - 3, -15);
    this.contactShadow.scale.x = state.kind === 'Gola' ? 1.2 : state.kind === 'Anaar' ? .9 : .5;
    this.contactShadow.visible = placed && state.phase !== 'RESETTING' && (state.phase !== 'EFFECT_PLAYING' || state.kind === 'Anaar');
    for (const [kind, object] of this.objects) {
      object.visible = placed && kind === state.kind && state.phase !== 'RESETTING' && (state.phase !== 'EFFECT_PLAYING' || kind === 'Anaar' || kind === 'Rocket' && state.effectAge < ROCKET_FLIGHT);
      if (!object.visible) continue;
      const p = kind === 'Rocket' && state.phase === 'EFFECT_PLAYING' ? rocketPosition(state.effectAge / 1000, state.object) : state.object;
      object.position.set(p.x * width, (1 - p.y) * 1280, 0);
    }
    const match = state.match;
    this.flameLight.intensity = match?.lit && match.alpha > .5 ? 3800 * (.92 + Math.sin(now * .015) * .08) : 0;
    if (match) this.flameLight.position.set(match.head.x * width, (1 - match.head.y) * 1280, 45);
    const age = state.effectAge - (state.kind === 'Rocket' ? ROCKET_FLIGHT : 0);
    this.flashLight.intensity = state.phase === 'EFFECT_PLAYING' && state.kind !== 'Anaar' && age >= 0 && age < 350 ? 28000 * (1 - age / 350) : 0;
    this.flashLight.position.set(state.object.x * width, (1 - state.object.y) * 1280, 90);
  }
  dispose() {
    const textures = new Set<THREE.Texture>(), materials = new Set<THREE.Material>();
    this.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        if (material instanceof THREE.MeshStandardMaterial) { if (material.map) textures.add(material.map); if (material.bumpMap) textures.add(material.bumpMap); }
        if (material instanceof THREE.MeshBasicMaterial && material.map) textures.add(material.map);
      }
    });
    textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose());
  }
}
