import type { MatchPose, Scene } from '../types';
import { coverTransform } from '../camera/coordinateTransform';
import { ParticleEngine } from './particleEngine';
import { BLAST_PRESETS, fusePoint, ROCKET_FLIGHT } from '../config/fireworks';

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, opacity: number) {
  const fill = ctx.createRadialGradient(x, y, 0, x, y, radius); fill.addColorStop(0, `rgba(255,173,69,${opacity})`); fill.addColorStop(.3, `rgba(255,118,35,${opacity * .3})`); fill.addColorStop(1, 'rgba(255,100,20,0)');
  ctx.fillStyle = fill; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
function drawExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, age: number, power: number, reduced: boolean) {
  const t = age / 1000, fireLife = power > 200 ? .62 : power > 100 ? .4 : .22;
  ctx.save();
  if (t < fireLife) {
    const fade = 1 - t / fireLife, radius = power * (.22 + Math.sqrt(t / fireLife) * .9) * scale;
    ctx.globalCompositeOperation = 'screen';
    glow(ctx, x, y, radius * 2.1, fade * (reduced ? .2 : .4));
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.39996, spread = radius * (.2 + .2 * Math.sin(i * 3));
      const px = x + Math.cos(angle) * spread, py = y + Math.sin(angle) * spread;
      const r = radius * (.52 + .12 * Math.cos(i * 4));
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, r);
      gradient.addColorStop(0, `rgba(255,248,198,${fade * .75})`);
      gradient.addColorStop(.3, `rgba(255,191,58,${fade * .65})`);
      gradient.addColorStop(.62, `rgba(255,90,15,${fade * .4})`);
      gradient.addColorStop(1, 'rgba(178,40,8,0)');
      ctx.fillStyle = gradient; ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  if (power > 100 && t > .16) {
    const alpha = Math.max(0, 1 - t / 1.9) * .12;
    for (let i = 0; i < 11; i++) {
      const angle = i * 2.39996, distance = power * (.15 + t * .35) * scale;
      const px = x + Math.cos(angle) * distance, py = y + Math.sin(angle) * distance * .65 - t * 24 * scale;
      const r = power * (.15 + t * .24) * scale;
      const smoke = ctx.createRadialGradient(px, py, 0, px, py, r);
      smoke.addColorStop(0, `rgba(58,48,40,${alpha})`); smoke.addColorStop(1, 'rgba(70,62,52,0)');
      ctx.fillStyle = smoke; ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
  }
  if (t < .85) {
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 1; i++) {
      const radius = power * (.2 + t * (2.7 - i * .4)) * scale;
      ctx.strokeStyle = `rgba(255,210,128,${Math.max(0, 1 - t / .85) * (reduced ? .08 : .18)})`;
      ctx.lineWidth = Math.max(1, 3 * scale * (1 - t)); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}
function flame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number) {
  const flicker = .9 + Math.sin(time * .018) * .09 + Math.sin(time * .043) * .05;
  const h = size * flicker, sway = Math.sin(time * .011) * h * .12;
  glow(ctx, x, y - h * .3, h * 2.8, .17);
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createLinearGradient(0, -h, 0, 3); g.addColorStop(0, '#ffb84400'); g.addColorStop(.16, '#ffc34d'); g.addColorStop(.55, '#ff8d2d'); g.addColorStop(1, '#ff4b1b');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 3); ctx.bezierCurveTo(-h * .43, 1, -h * .25, -h * .55, sway, -h); ctx.bezierCurveTo(h * .1 + sway, -h * .5, h * .48, -h * .12, 0, 3); ctx.fill();
  ctx.fillStyle = '#fff1b5'; ctx.beginPath(); ctx.moveTo(0, 1); ctx.bezierCurveTo(-h * .15, -h * .1, -h * .12, -h * .38, sway * .3, -h * .57); ctx.bezierCurveTo(h * .19, -h * .23, h * .18, -h * .03, 0, 1); ctx.fill();
  ctx.fillStyle = '#bddfff'; ctx.beginPath(); ctx.ellipse(0, 0, h * .085, h * .08, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

export class Compositor {
  readonly ctx: CanvasRenderingContext2D;
  readonly fx: ParticleEngine;
  debug = false;
  mirror = true;
  guided = false;
  manual = false;
  reduced = false;
  private smooth: MatchPose | null = null;
  constructor(readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('This browser cannot create a canvas. Try a current Chrome, Edge or Safari.');
    this.ctx = context; this.fx = new ParticleEngine();
    this.resize(720, 1280);
  }
  resize(width: number, height: number) { this.canvas.width = width; this.canvas.height = height; this.fx.resize(width, height); this.smooth = null; }
  draw(video: HTMLVideoElement, scene: Scene, now: number, dt: number) {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, s = h / 1280;
    ctx.fillStyle = '#191b17'; ctx.fillRect(0, 0, w, h);
    ctx.save();
    if (scene.phase === 'EFFECT_PLAYING' && scene.kind === 'Gola' && scene.effectAge < 260 && !this.reduced) {
      const strength = (1 - scene.effectAge / 260) * 5 * s;
      ctx.translate(Math.sin(scene.effectAge * .13) * strength, Math.cos(scene.effectAge * .17) * strength);
    }
    const transform = coverTransform(video.videoWidth || 1280, video.videoHeight || 720, w, h, this.mirror);
    const drawVideo = () => {
      if (video.readyState < 2) return;
      ctx.save();
      if (this.mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, transform.x, transform.y, transform.drawnW, transform.drawnH); ctx.restore();
    };
    drawVideo();
    if (scene.phase === 'EFFECT_PLAYING' && scene.kind !== 'Anaar') {
      const age = scene.effectAge - (scene.kind === 'Rocket' ? ROCKET_FLIGHT : 0);
      const at = scene.kind === 'Rocket' ? this.fx.rocketBloom(scene.object) : scene.object;
      if (age >= 0 && age < 1900) drawExplosion(ctx, at.x * w, at.y * h, s, age, BLAST_PRESETS[scene.kind].radius, this.reduced);
    }
    this.fx.renderWorld(scene, now);
    ctx.drawImage(this.fx.renderer.domElement, 0, 0, w, h);
    if ((scene.ground === 'detected' || scene.ground === 'manual') && !['EFFECT_PLAYING', 'RESETTING'].includes(scene.phase)) this.drawFuse(scene, now);
    if (scene.phase === 'EFFECT_PLAYING' && scene.kind === 'Rocket' && scene.effectAge < ROCKET_FLIGHT) {
      const p = this.fx.rocketPosition(scene.effectAge / 1000, scene.object), base = fusePoint('Rocket', p, p, 1);
      ctx.save(); ctx.translate(base.x * w, base.y * h); ctx.scale(1, -1); flame(ctx, 0, 0, 33 * s, now); ctx.restore();
    }
    const match = scene.match;
    if (match) {
      if (!this.smooth || dt > .15) this.smooth = structuredClone(match);
      // ~25ms smoothing at 60Hz: render independently of 15–24Hz vision updates.
      const a = 1 - Math.exp(-dt * 38);
      for (const key of ['grip', 'head'] as const) { this.smooth[key].x += (match[key].x - this.smooth[key].x) * a; this.smooth[key].y += (match[key].y - this.smooth[key].y) * a; }
      this.drawMatch({ ...match, grip: this.smooth.grip, head: this.smooth.head }, now);
      // Reproject the tiny fingertip patches over the match's grip. This provides
      // local finger occlusion without a costly full-person segmentation pass.
      if (!this.manual) {
        const fingers = scene.hands.flatMap(hand => [hand.points[4], hand.points[8]]).filter(p => Math.hypot((p.x - match.grip.x) * w, (p.y - match.grip.y) * h) < 30 * s);
        for (const p of fingers) { ctx.save(); ctx.globalAlpha = match.alpha; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 6 * s, 0, Math.PI * 2); ctx.clip(); drawVideo(); ctx.restore(); }
      }
    } else this.smooth = null;
    this.fx.reduced = this.reduced; this.fx.update(now, dt, scene);
    this.fx.renderSmoke(); ctx.drawImage(this.fx.renderer.domElement, 0, 0, w, h);
    this.fx.renderSparks(); ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(this.fx.renderer.domElement, 0, 0, w, h); ctx.restore();
    ctx.restore();
    if (scene.match && !scene.match.lit && !this.manual) this.drawStrikeFeedback(scene);
    if (this.guided && scene.fallback) this.drawGuided();
    if (this.debug) this.drawDebug(scene);
  }
  private drawStrikeFeedback(scene: Scene) {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, s = h / 1280;
    const match = scene.match!;
    ctx.save(); ctx.globalAlpha = match.alpha;
    if (scene.torso.length && !scene.contact) {
      ctx.strokeStyle = '#fff2d72a'; ctx.lineWidth = s; ctx.setLineDash([5 * s, 10 * s]); ctx.beginPath();
      scene.torso.forEach(p => ctx.lineTo(p.x * w, p.y * h)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.strokeStyle = scene.contact ? '#f2c787aa' : '#ffffff30'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.arc(match.head.x * w, match.head.y * h, 12 * s, 0, Math.PI * 2); ctx.stroke();
    if (scene.strike > 0) { ctx.strokeStyle = '#ffdb91'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc(match.head.x * w, match.head.y * h, 15 * s, -Math.PI / 2, -Math.PI / 2 + scene.strike * Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  private drawMatch(match: MatchPose, now: number) {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, s = h / 1280;
    const x = match.head.x * w, y = match.head.y * h;
    ctx.save(); ctx.globalAlpha = match.alpha;
    const g = ctx.createLinearGradient(match.grip.x * w, match.grip.y * h, x, y); g.addColorStop(0, '#b9884f'); g.addColorStop(.55, '#e9c98c'); g.addColorStop(1, match.lit ? '#33231d' : '#d2a96a');
    ctx.strokeStyle = '#39291f80'; ctx.lineWidth = 7 * s; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(match.grip.x * w - (x - match.grip.x * w) * .3, match.grip.y * h - (y - match.grip.y * h) * .3); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = g; ctx.lineWidth = 4.5 * s; ctx.stroke();
    ctx.fillStyle = match.lit ? '#231b19' : '#9d3b35'; ctx.beginPath(); ctx.ellipse(x, y, 5 * s, 6.5 * s, match.angle + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    if (match.lit) flame(ctx, x, y, 27 * s, now);
    ctx.restore();
  }
  private drawFuse(scene: Scene, now: number) {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, s = h / 1280;
    const tip = scene.fuse, t0 = scene.phase === 'FUSE_IGNITING' ? scene.fuseProgress : 0;
    const curve = (t: number) => fusePoint(scene.kind, scene.object, tip, t);
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#382032'; ctx.lineWidth = (scene.kind === 'Gola' ? 8 : 6) * s; ctx.beginPath();
    for (let t = t0; t <= 1.01; t += .025) { const p = curve(Math.min(t, 1)); ctx.lineTo(p.x * w, p.y * h); } ctx.stroke();
    ctx.strokeStyle = scene.kind === 'Gola' ? '#d35989' : '#d3b48b'; ctx.lineWidth = 3 * s; ctx.setLineDash([2 * s, 4 * s]); ctx.stroke(); ctx.setLineDash([]);
    const p = curve(t0), lit = scene.phase === 'FUSE_IGNITING';
    if (lit || scene.proximity > 0) glow(ctx, p.x * w, p.y * h, 27 * s, .4);
    ctx.fillStyle = lit ? '#fff0ae' : '#f7d296'; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, (lit ? 4 : 3) * s, 0, Math.PI * 2); ctx.fill();
    if (!lit) {
      ctx.strokeStyle = `rgba(255,222,160,${.3 + .15 * Math.sin(now / 350)})`; ctx.lineWidth = s;
      ctx.beginPath(); ctx.arc(p.x * w, p.y * h, (12 + scene.proximity * 9) * s, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
      if (scene.proximity) { ctx.strokeStyle = '#ffce82'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 17 * s, -Math.PI / 2, -Math.PI / 2 + scene.proximity * Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore();
  }
  private drawGuided() {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.save(); ctx.strokeStyle = '#f5ca7f90'; ctx.setLineDash([5, 8]); ctx.lineWidth = 1; ctx.strokeRect(w * .15, h * .58, w * .7, h * .15);
    ctx.setLineDash([]); ctx.fillStyle = '#f8dfad'; ctx.font = `${h / 80}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('GUIDED STRIKE · RUB LEFT ↔ RIGHT', w * .5, h * .565); ctx.restore();
  }
  private drawDebug(scene: Scene) {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.save(); ctx.strokeStyle = '#62e9bf'; ctx.fillStyle = '#62e9bf18'; ctx.lineWidth = 2;
    ctx.beginPath(); scene.torso.forEach(p => ctx.lineTo(p.x * w, p.y * h)); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const hand of scene.hands) { for (const p of hand.points) { ctx.fillStyle = '#8cffda'; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2); ctx.fill(); } ctx.font = '18px monospace'; ctx.fillText(`hand ${hand.id}`, hand.points[0].x * w, hand.points[0].y * h); }
    if (scene.match) { ctx.strokeStyle = '#ff5e6b'; ctx.beginPath(); ctx.arc(scene.match.head.x * w, scene.match.head.y * h, 6, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = '#ffa760'; ctx.beginPath(); ctx.arc(scene.fuse.x * w, scene.fuse.y * h, .035 * h, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  dispose() { this.fx.dispose(); }
}
