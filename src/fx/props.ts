import type { Firework } from '../types';
import { PROP_SCALE } from '../config/fireworks';

// Original procedural artwork based on the user's silhouettes/material cues.
// Render once at 2x resolution; rope/foil detail is not repainted every frame.
const cache = new Map<Firework, HTMLCanvasElement>();
export function drawProp(ctx: CanvasRenderingContext2D, kind: Firework, x: number, y: number, scale: number) {
  scale *= PROP_SCALE[kind];
  let image = cache.get(kind);
  if (!image) {
    image = document.createElement('canvas'); image.width = 384; image.height = 512;
    const paint = image.getContext('2d')!;
    paint.scale(2, 2); paint.translate(96, 128);
    paint.shadowColor = '#0009'; paint.shadowBlur = 10; paint.shadowOffsetY = 6;
    if (kind === 'Gola') paintGola(paint);
    else if (kind === 'Laxmi') paintLaxmi(paint);
    else if (kind === 'Rocket') paintRocket(paint);
    else paintAnaar(paint);
    cache.set(kind, image);
  }
  ctx.drawImage(image, x - 96 * scale, y - 128 * scale, 192 * scale, 256 * scale);
}
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, radius = i % 2 ? r * .45 : r; ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius); }
  ctx.closePath(); ctx.fill();
}
function foil(ctx: CanvasRenderingContext2D, width: number, colors: string[]) {
  const gradient = ctx.createLinearGradient(-width, 0, width, 0);
  colors.forEach((color, i) => gradient.addColorStop(i / (colors.length - 1), color));
  return gradient;
}
function noShadow(ctx: CanvasRenderingContext2D) { ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
function paintGola(ctx: CanvasRenderingContext2D) {
  const body = ctx.createRadialGradient(-25, -37, 4, 12, 20, 91);
  body.addColorStop(0, '#426b50'); body.addColorStop(.5, '#1f4435'); body.addColorStop(1, '#0c1c16');
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 65, 66, -.08, 0, Math.PI * 2); ctx.fill(); noShadow(ctx);
  ctx.save(); ctx.clip(); ctx.lineCap = 'round';
  for (let i = 0; i < 19; i++) {
    const y = -70 + i * 8;
    ctx.beginPath(); ctx.moveTo(-78, y + 4); ctx.bezierCurveTo(-32, y - 9 + Math.sin(i * 7) * 6, 24, y + 14, 76, y - 3);
    ctx.strokeStyle = i % 3 ? '#18392b' : '#4a6549'; ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = '#66815a70'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = '#0a221e70'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
  }
  for (let i = 0; i < 13; i++) {
    ctx.beginPath(); ctx.ellipse((i - 6) * 5, 0, 14 + Math.abs(i - 6) * 1.6, 70, (i - 6) * .035, 0, Math.PI * 2);
    ctx.lineWidth = 6; ctx.strokeStyle = '#102d24a0'; ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#8ba16a65'; ctx.stroke();
  }
  ctx.fillStyle = foil(ctx, 68, ['#82601d', '#ffe998', '#c98b24', '#ffe7a2', '#805111']); ctx.fillRect(-70, -10, 140, 43);
  ctx.fillStyle = foil(ctx, 68, ['#7e181c', '#f44b33', '#ca2928', '#b31c20', '#531e1e']); ctx.fillRect(-70, -4, 140, 30);
  ctx.strokeStyle = '#ffefae8a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-67, -8); ctx.lineTo(67, -8); ctx.moveTo(-67, 31); ctx.lineTo(67, 31); ctx.stroke();
  const shade = ctx.createLinearGradient(-66, 0, 66, 30); shade.addColorStop(0, '#0003'); shade.addColorStop(.3, '#ffffff12'); shade.addColorStop(1, '#0006'); ctx.fillStyle = shade; ctx.fillRect(-70, -70, 140, 140);
  ctx.restore(); ctx.fillStyle = '#25221f'; ctx.beginPath(); ctx.ellipse(0, -61, 9, 5, -.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b34b73'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -63); ctx.lineTo(3, -71); ctx.stroke();
}
function paintLaxmi(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = foil(ctx, 29, ['#773c24', '#ffe084', '#c98f35', '#f6c763', '#68452b']);
  ctx.beginPath(); ctx.roundRect(-28, -44, 56, 84, 5); ctx.fill(); noShadow(ctx);
  ctx.fillStyle = foil(ctx, 28, ['#8d1521', '#e63735', '#cc232c', '#7c1b28']); ctx.fillRect(-26, -36, 52, 65);
  ctx.fillStyle = '#fbe5a3'; ctx.fillRect(-26, -33, 52, 2); ctx.fillRect(-26, 24, 52, 2);
  ctx.fillStyle = '#f5cf67'; ctx.beginPath(); ctx.ellipse(0, -8, 18, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#174e3b'; ctx.beginPath(); ctx.ellipse(0, -8, 15, 19, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe193'; star(ctx, 0, -10, 11);
  ctx.textAlign = 'center'; ctx.font = 'bold 7px Georgia'; ctx.fillStyle = '#fbe5a3'; ctx.fillText('LAXMI', 0, 18);
  ctx.fillStyle = '#d9ba76'; ctx.beginPath(); ctx.ellipse(0, -44, 27, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c3ae6b'; ctx.lineWidth = 3;
  for (let y = -22; y <= 33; y += 52) { ctx.beginPath(); ctx.moveTo(-28, y); ctx.lineTo(28, y + 6); ctx.stroke(); }
  ctx.fillStyle = '#25231b'; ctx.beginPath(); ctx.ellipse(0, -45, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
}
function paintRocket(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#d4b47e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, 105); ctx.stroke(); noShadow(ctx);
  ctx.save(); ctx.beginPath(); ctx.rect(-2, -25, 4, 132); ctx.clip(); ctx.strokeStyle = '#c72e38'; ctx.lineWidth = 3;
  for (let y = -25; y < 108; y += 10) { ctx.beginPath(); ctx.moveTo(-4, y); ctx.lineTo(4, y + 7); ctx.stroke(); } ctx.restore();
  ctx.fillStyle = foil(ctx, 15, ['#103c23', '#65a448', '#296f35', '#0d321e']); ctx.beginPath(); ctx.roundRect(-14, -88, 28, 68, 3); ctx.fill();
  ctx.fillStyle = foil(ctx, 17, ['#080f0c', '#29432c', '#111e14', '#020703']); ctx.beginPath(); ctx.moveTo(-18, -86); ctx.lineTo(0, -126); ctx.lineTo(18, -86); ctx.closePath(); ctx.fill();
  ctx.fillStyle = foil(ctx, 15, ['#c0932c', '#ffe57c', '#e4bb4f', '#98701c']); ctx.fillRect(-14, -51, 28, 27); ctx.fillRect(-14, -84, 28, 3);
  ctx.fillStyle = '#e9efd3'; ctx.textAlign = 'center'; ctx.font = 'italic bold 8px Georgia'; ctx.fillText('Rocket', 0, -67);
  ctx.fillStyle = '#263f1e'; ctx.font = 'bold 5px sans-serif'; ctx.fillText('FIREPLAY', 0, -39); ctx.font = '4px sans-serif'; ctx.fillText('VIRTUAL', 0, -32);
  ctx.strokeStyle = '#ffffdf70'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9, -80); ctx.lineTo(-9, -55); ctx.stroke();
}
function paintAnaar(ctx: CanvasRenderingContext2D) {
  ctx.beginPath(); ctx.moveTo(-7, -85); ctx.quadraticCurveTo(-20, -27, -54, 44); ctx.quadraticCurveTo(0, 65, 54, 44); ctx.quadraticCurveTo(21, -27, 7, -85); ctx.closePath();
  ctx.fillStyle = foil(ctx, 54, ['#651c24', '#ee4935', '#cb2625', '#f14b2e', '#721d25']); ctx.fill(); noShadow(ctx); ctx.save(); ctx.clip();
  ctx.fillStyle = '#eac65d';
  for (let y = -70; y < 50; y += 33) {
    ctx.beginPath(); ctx.moveTo(-65, y);
    for (let x = -65; x <= 65; x += 11) ctx.lineTo(x, y + (Math.round(x / 11) % 2 ? 15 : 0));
    for (let x = 65; x >= -65; x -= 11) ctx.lineTo(x, y + 7 + (Math.round(x / 11) % 2 ? 15 : 0)); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = foil(ctx, 54, ['#0b3028', '#126c48', '#19503a', '#052c24']); ctx.fillRect(-60, 30, 120, 21);
  ctx.strokeStyle = '#f4d16f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 34, 50, 7, 0, 0, Math.PI); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, 49, 57, 8, 0, 0, Math.PI); ctx.stroke();
  ctx.fillStyle = '#eecb66'; ctx.beginPath(); ctx.ellipse(0, -9, 33, 40, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#10513a'; ctx.beginPath(); ctx.ellipse(0, -9, 30, 37, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c49e4d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -9, 27, 34, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffe298'; ctx.font = 'bold 36px Georgia'; ctx.textAlign = 'center'; ctx.fillText('27', 0, 4); ctx.font = '5px sans-serif'; ctx.fillText('F I R E P L A Y', 0, 18);
  ctx.fillStyle = '#ffe99888'; ctx.fillRect(-28, -70, 2, 110); ctx.restore();
  ctx.fillStyle = '#d5b75e'; ctx.beginPath(); ctx.ellipse(0, -82, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#594171'; ctx.beginPath(); ctx.ellipse(0, -86, 6, 4, -.3, 0, Math.PI * 2); ctx.fill();
}
