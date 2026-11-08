import { test, expect, type Page } from '@playwright/test';
import type { Point } from '../src/types';
import { FIREWORKS, FIREWORK_LABELS, propBottom, ROCKET_AUDIO_OFFSET, ROCKET_FLIGHT } from '../src/config/fireworks';
async function snapshot(page: Page) { return page.evaluate(() => window.__fireplay!.snapshot()); }
function pinchedHead(x: number, y: number): Point[] {
  const gripY = y + .052;
  const p = Array.from({ length: 21 }, () => ({ x, y: gripY + .06 }));
  p[0] = { x, y: gripY + .19 }; p[9] = { x, y: gripY + .09 };
  p[5] = { x, y: gripY + .1 }; p[17] = { x: x + .07, y: gripY + .1 };
  p[4] = { x: x - .004, y: gripY }; p[8] = { x: x + .004, y: gripY };
  return p;
}
function loosePinchHead(x: number, y: number): Point[] {
  const p = pinchedHead(x, y);
  p[4] = { ...p[4], x: x - .04 }; p[8] = { ...p[8], x: x + .04 };
  return p;
}
const pose: Point[] = Array.from({ length: 33 }, (_, i) => ({
  x: i === 11 || i === 23 ? .12 : i === 12 || i === 24 ? .88 : .5,
  y: i === 11 || i === 12 ? .28 : .86, visibility: 1,
}));
async function feed(page: Page, x: number, y: number, wait = 100) {
  await page.evaluate(({ points, pose }) => window.__fireplay!.feed({ hands: [{ id: 1, label: 'Left', points, seen: performance.now() }], pose, timestamp: performance.now() }), { points: pinchedHead(x, y), pose });
  if (wait) await page.waitForTimeout(wait);
}
async function hold(page: Page, x: number, y: number, duration: number) {
  for (let elapsed = 0; elapsed < duration; elapsed += 80) await feed(page, x, y, 80);
}
test('short vertical shirt rub survives a missing frame and placed ground ignores hand motion', async ({ page }) => {
  await page.goto('/?replay=1'); await page.getByRole('button', { name: 'Start Camera', exact: true }).click();
  await expect(page.getByTestId('vision-ready')).toBeVisible({ timeout: 55000 });
  await page.evaluate(() => window.__fireplay!.takeControl());
  await page.getByRole('button', { name: 'Gola Bomb', exact: true }).click();
  await hold(page, .4, .52, 330);
  const initial = await snapshot(page);
  await feed(page, .4, .545, 85); await feed(page, .4, .57, 85);
  await page.evaluate(() => window.__fireplay!.feed({ hands: [], pose: [], timestamp: performance.now() }));
  await page.waitForTimeout(80); expect((await snapshot(page)).lit).toBe(false);
  for (const y of [.595, .57, .535]) await feed(page, .4, y, 85);
  expect((await snapshot(page)).lit).toBe(true);
  for (const x of [.2, .6, .8, .3]) {
    await page.evaluate(({ first, second, pose }) => window.__fireplay!.feed({ hands: [
      { id: 1, label: 'Left', points: first, seen: performance.now() },
      { id: 2, label: 'Right', points: second, seen: performance.now() },
    ], pose, timestamp: performance.now() }), { first: pinchedHead(.4, .535), second: pinchedHead(x, .4), pose });
    await page.waitForTimeout(60);
    const current = await snapshot(page); expect(current.support).toEqual(initial.support); expect(current.object).toEqual(initial.object); expect(current.fuse).toEqual(initial.fuse);
  }
  await page.screenshot({ path: 'test-results/vertical-rub-lit.png' });
  await hold(page, initial.fuse.x, initial.fuse.y, 430); expect((await snapshot(page)).phase).toBe('FUSE_IGNITING');
});
test('picked match stays on the same hand when pinch loosens and during a short occlusion', async ({ page }) => {
  await page.goto('/?replay=1'); await page.getByRole('button', { name: 'Start Camera', exact: true }).click();
  await expect(page.getByTestId('vision-ready')).toBeVisible({ timeout: 55000 });
  await page.evaluate(() => window.__fireplay!.takeControl());
  await hold(page, .3, .15, 330);
  expect((await snapshot(page)).head).not.toBeNull();

  for (const x of [.32, .35, .38, .41, .44, .47, .5, .53, .56]) {
    await page.evaluate(({ points, pose }) => window.__fireplay!.feed({ hands: [{ id: 1, label: 'Left', points, seen: performance.now() }], pose, timestamp: performance.now() }), { points: loosePinchHead(x, .15), pose });
    await page.waitForTimeout(80);
  }
  const loosened = await snapshot(page);
  expect(loosened.phase).toBe('MATCH_HELD'); expect(loosened.head).not.toBeNull();
  expect(loosened.head!.x).toBeGreaterThan(.5);

  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.__fireplay!.feed({ hands: [], pose: [], timestamp: performance.now() }));
    await page.waitForTimeout(80);
  }
  const occluded = await snapshot(page);
  expect(occluded.head).not.toBeNull(); expect(occluded.matchAlpha).toBeGreaterThan(0);

  await page.evaluate(({ points, pose }) => window.__fireplay!.feed({ hands: [{ id: 1, label: 'Left', points, seen: performance.now() }], pose, timestamp: performance.now() }), { points: loosePinchHead(.64, .15), pose });
  const recovered = await snapshot(page);
  expect(recovered.head).not.toBeNull(); expect(recovered.matchAlpha).toBe(1);
  expect(recovered.head!.x).toBeGreaterThan(.6);
});
test('placed fireworks can be picked up and moved with pointer drag', async ({ page }) => {
  await page.goto('/?replay=1'); await page.getByRole('button', { name: 'Start Camera', exact: true }).click();
  await expect(page.getByTestId('vision-ready')).toBeVisible({ timeout: 55000 });
  await page.evaluate(() => window.__fireplay!.takeControl());
  const stage = await page.locator('.scene-canvas').boundingBox(); expect(stage).not.toBeNull();
  for (const kind of FIREWORKS) {
    await page.getByRole('button', { name: FIREWORK_LABELS[kind], exact: true }).click();
    const before = await snapshot(page);
    const start = { x: stage!.x + before.object.x * stage!.width, y: stage!.y + before.object.y * stage!.height };
    const target = { x: start.x + stage!.width * .05, y: start.y - stage!.height * .02 };
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 6 }); await page.mouse.up();
    const after = await snapshot(page);
    expect(after.ground).toBe('manual');
    expect(after.support.x - before.support.x).toBeCloseTo(.05, 2);
    expect(after.support.y - before.support.y).toBeCloseTo(-.02, 2);
    expect(after.object.y + propBottom(kind)).toBeCloseTo(after.support.y, 4);
    expect(after.fuse.x).not.toBeCloseTo(before.fuse.x);
  }
});
test('real MediaPipe worker initializes against fake webcam; camera shuts down', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?replay=1');
  await expect(page.getByRole('button', { name: 'Start Camera', exact: true })).toBeVisible();
  const surface = await page.locator('.camera-stage').boundingBox();
  expect(surface).toEqual({ x: 0, y: 0, width: 1440, height: 1000 });
  await expect(page.locator('.page-header, .page-footer, .margin-note, h1')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/welcome.png' });
  await page.getByRole('button', { name: 'Start Camera', exact: true }).click();
  await expect(page.getByTestId('vision-ready')).toBeVisible({ timeout: 55000 });
  expect((await snapshot(page)).cameraTracks).toEqual(['live']);
  await page.screenshot({ path: 'test-results/live-camera.png' });
  await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Camera', exact: true })).toBeVisible();
  expect((await snapshot(page)).cameraTracks).toEqual([]); expect(errors).toEqual([]);
});
test('synthetic observations drive pinch → shirt reversal → fuse → all four effects and portrait export', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?replay=1');
  await page.getByRole('button', { name: 'Start Camera', exact: true }).click();
  await expect(page.getByTestId('vision-ready')).toBeVisible({ timeout: 55000 });
  await page.evaluate(() => window.__fireplay!.takeControl());
  expect((await snapshot(page)).sampleCount).toBe(3);
  await hold(page, .3, .5, 330);
  expect((await snapshot(page)).phase).toBe('MATCH_HELD');
  // An unlit match held at the fuse must never launch the effect.
  let fuse = (await snapshot(page)).fuse;
  await hold(page, fuse.x, fuse.y, 450);
  expect((await snapshot(page)).lit).toBe(false);
  expect(['MATCH_HELD', 'STRIKING']).toContain((await snapshot(page)).phase);
  // Fresh entry, then a deliberate back-and-forth stroke on the observed torso.
  await feed(page, .1, .4);
  for (const x of [.3, .37, .44, .51, .45, .38, .31]) await feed(page, x, .5, 105);
  expect((await snapshot(page)).lit).toBe(true);
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  for (const kind of FIREWORKS) {
    // Each complete reference effect has a longer audio tail now. Re-grab and
    // strike a fresh match for each take rather than racing its 16s lifetime.
    if (kind !== FIREWORKS[0]) {
      await page.getByRole('button', { name: 'Reset experience', exact: true }).click();
      await hold(page, .3, .5, 330); await feed(page, .1, .4);
      for (const x of [.3, .37, .44, .51, .45, .38, .31]) await feed(page, x, .5, 105);
      expect((await snapshot(page)).lit).toBe(true);
    }
    await page.getByRole('button', { name: FIREWORK_LABELS[kind], exact: true }).click();
    await page.screenshot({ path: `test-results/prop-${kind.toLowerCase()}.png` });
    fuse = (await snapshot(page)).fuse;
    // A screenshot can pause synthetic observations long enough to require a
    // fresh pinch hold; allow both that hold and the real 260ms fuse dwell.
    await hold(page, fuse.x, fuse.y, 700);
    expect((await snapshot(page)).phase).toBe('FUSE_IGNITING');
    await hold(page, fuse.x, fuse.y, 900);
    expect((await snapshot(page)).phase).toBe('EFFECT_PLAYING');
    await page.waitForTimeout(kind === 'Laxmi' || kind === 'Gola' ? 100 : kind === 'Rocket' ? ROCKET_FLIGHT + 150 : 1200);
    await page.screenshot({ path: `test-results/effect-${kind.toLowerCase()}.png` });
    if (kind !== FIREWORKS.at(-1)) {
      const deadline = Date.now() + 8000;
      while (['EFFECT_PLAYING', 'FUSE_IGNITING', 'RESETTING'].includes((await snapshot(page)).phase) && Date.now() < deadline) await feed(page, .25, .5, 80);
      expect(['MATCH_LIT', 'MATCH_HELD', 'READY']).toContain((await snapshot(page)).phase);
    }
  }
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Your recorded clip' }); await expect(preview).toBeVisible();
  const media = await preview.locator('video').evaluate(async (element: HTMLVideoElement) => {
    if (element.readyState < 1) await new Promise<void>(resolve => element.addEventListener('loadedmetadata', () => resolve(), { once: true }));
    await element.play();
    const blob = await fetch(element.src).then(r => r.blob());
    const audio = new AudioContext();
    const decoded = await audio.decodeAudioData(await blob.arrayBuffer());
    const samples = decoded.getChannelData(0);
    let energy = 0;
    for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
    await audio.close();
    return { width: element.videoWidth, height: element.videoHeight, bytes: blob.size, type: blob.type, playing: !element.paused, audioRms: Math.sqrt(energy / samples.length) };
  });
  expect(media.width).toBe(720); expect(media.height).toBe(1280); expect(media.bytes).toBeGreaterThan(30000); expect(media.type).toContain('video/'); expect(media.playing).toBe(true);
  expect(media.audioRms).toBeGreaterThan(.001);
  await expect(preview.getByText(/App audio included/)).toBeVisible();
  const download = page.waitForEvent('download'); await preview.getByRole('link', { name: /Download clip/ }).click();
  const saved = await download; expect(saved.suggestedFilename()).toMatch(/^fireplay-\d{8}-\d{6}\.(webm|mp4)$/);
  await saved.saveAs(`test-results/${saved.suggestedFilename()}`);
  await preview.getByRole('button', { name: 'Close clip' }).click();
  await page.getByRole('button', { name: 'Stop camera', exact: true }).click(); expect(errors).toEqual([]);
});
test('denied camera has actionable retry and manual fallback; mobile controls fit', async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Denied', 'NotAllowedError')); });
  await page.setViewportSize({ width: 393, height: 852 }); await page.goto('/');
  await page.getByRole('button', { name: 'Start Camera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry camera', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('site settings');
  await page.getByRole('button', { name: 'No camera? Open manual studio' }).click();
  await expect(page.getByText('MANUAL', { exact: true })).toBeVisible();
  for (const kind of FIREWORKS) await expect(page.getByRole('button', { name: FIREWORK_LABELS[kind], exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Light match' }).click(); await expect(page.getByRole('button', { name: 'Light fuse' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/mobile-manual.png' });
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth })); expect(dimensions.scroll).toBe(dimensions.viewport);
});
test('optional local reference audio decodes and rocket boom aligns when licensed files are present', async ({ page }) => {
  await page.goto('/');
  const haveSamples = await page.evaluate(async () => (await Promise.all(['rocket', 'laxmi', 'gola'].map(async name => (await fetch(`/audio/${name}.mp3`)).ok))).every(Boolean));
  test.skip(!haveSamples, 'Optional third-party recordings are excluded from source control; procedural audio is tested by the recording flow.');
  const result = await page.evaluate(async ({ offset, flight }) => {
    const context = new AudioContext(), results = [];
    for (const name of ['rocket', 'laxmi', 'gola']) {
      const response = await fetch(`/audio/${name}.mp3`);
      if (!response.ok) throw new Error(`Missing ${name} sound`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      const samples = buffer.getChannelData(0);
      const rms = (start: number, duration: number) => {
        const from = Math.floor(start * buffer.sampleRate), to = Math.min(samples.length, Math.floor((start + duration) * buffer.sampleRate));
        let sum = 0; for (let i = from; i < to; i++) sum += samples[i] * samples[i]; return Math.sqrt(sum / (to - from));
      };
      results.push({ name, duration: buffer.duration, before: name === 'rocket' ? rms(offset + flight / 1000 - .18, .1) : 0,
        after: name === 'rocket' ? rms(offset + flight / 1000 + .1, .1) : rms(0, .2) });
    }
    await context.close(); return results;
  }, { offset: ROCKET_AUDIO_OFFSET, flight: ROCKET_FLIGHT });
  for (const audio of result) { expect(audio.duration).toBeGreaterThan(2); expect(audio.after).toBeGreaterThan(.1); }
  expect(result[0].after).toBeGreaterThan(result[0].before * 4);
});
test('reference props and the large Gola blast remain clear above the controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'No camera? Open manual studio' }).click();
  for (const kind of FIREWORKS) {
    await page.getByRole('button', { name: FIREWORK_LABELS[kind], exact: true }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `test-results/reference-${kind.toLowerCase()}.png` });
  }
  await page.getByRole('button', { name: 'Light match' }).click();
  await page.getByRole('button', { name: 'Light fuse' }).click();
  await page.waitForTimeout(960);
  await page.screenshot({ path: 'test-results/reference-gola-fireball.png' });
  await page.waitForTimeout(450);
  await page.screenshot({ path: 'test-results/reference-gola-ring.png' });
  await expect(page.getByRole('button', { name: 'Gola Bomb', exact: true })).toBeInViewport();
});
test('fullscreen compact game keeps the large prop clear of its controls', async ({ page }) => {
  await page.setViewportSize({ width: 319, height: 504 }); await page.goto('/?replay=1');
  await page.getByRole('button', { name: 'No camera? Open manual studio' }).click();
  await page.getByRole('button', { name: 'Gola Bomb', exact: true }).click();
  await page.waitForTimeout(350);
  const scene = await snapshot(page), stage = await page.locator('.scene-canvas').boundingBox();
  const controls = await page.locator('.stage-controls').boundingBox(), top = await page.locator('.stage-top').boundingBox();
  expect(stage).not.toBeNull(); expect(controls).not.toBeNull(); expect(top).not.toBeNull();
  expect(stage!.width).toBe(319); expect(stage!.height).toBe(504); expect(stage!.x).toBe(0); expect(stage!.y).toBe(0);
  expect(stage!.y + (scene.object.y + propBottom('Gola')) * stage!.height).toBeLessThan(controls!.y - 4);
  expect(stage!.y + scene.fuse.y * stage!.height).toBeGreaterThan(top!.y + top!.height + 2);
  await page.screenshot({ path: 'test-results/compact-gola.png' });
});
