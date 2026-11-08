import { test, expect } from '@playwright/test';

test('actual local semantic model finds road and rejects an empty sky image', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const worker = new Worker('/vision/ground-worker.js', { type: 'module' });
    const receive = () => new Promise<{ type: string; mask: Uint8Array; labels: Uint8Array; width: number; height: number; message?: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Ground worker timeout')), 45000);
      worker.onerror = error => { clearTimeout(timeout); reject(new Error(error.message)); };
      worker.onmessage = event => { clearTimeout(timeout); if (event.data.type === 'error') reject(new Error(event.data.message)); else resolve(event.data); };
    });
    const ready = receive(); worker.postMessage({ type: 'init', base: location.origin + '/' }); await ready;
    const image = new Image(); image.src = '/tests/fixtures/ground-street.png'; await image.decode();
    const bitmap = await createImageBitmap(image); const positive = receive();
    worker.postMessage({ type: 'frame', bitmap, timestamp: 0 }, [bitmap]); const road = await positive;
    const sky = document.createElement('canvas'); sky.width = 512; sky.height = 512;
    const ctx = sky.getContext('2d')!; ctx.fillStyle = '#75b9ee'; ctx.fillRect(0, 0, 512, 512);
    const empty = await createImageBitmap(sky); const negative = receive();
    worker.postMessage({ type: 'frame', bitmap: empty, timestamp: 1 }, [empty]); const noFloor = await negative;
    worker.terminate();
    return { width: road.width, height: road.height, road: road.mask.filter((v, i) => v >= 140 && road.labels[i] === 6).length / road.mask.length,
      negative: noFloor.mask.filter(v => v >= 140).length / noFloor.mask.length };
  });
  console.log('Actual SegFormer inference', result);
  expect(result.width).toBe(128); expect(result.height).toBe(128);
  expect(result.road).toBeGreaterThan(.15); expect(result.negative).toBeLessThan(.035); expect(errors).toEqual([]);
});

test('video ground is acquired without a podium, stays seated and clears on stop', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const image = new Image(); image.src = '/tests/fixtures/ground-street.png'; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
      const stream = canvas.captureStream(10);
      const timer = setInterval(() => ctx.drawImage(image, 0, 0), 100);
      stream.getTracks().forEach(track => { const stop = track.stop.bind(track); track.stop = () => { clearInterval(timer); stop(); }; });
      return stream;
    };
  });
  await page.goto('/?replay=1');
  await page.getByRole('button', { name: 'Start Camera', exact: true }).click();
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-ground', 'detected', { timeout: 55000 });
  const first = await page.evaluate(() => window.__fireplay!.snapshot());
  expect(first.support.y).toBeGreaterThan(.5); expect(first.support.y).toBeLessThan(.85);
  await page.getByRole('button', { name: 'Gola Bomb', exact: true }).click();
  await page.waitForTimeout(1700);
  const next = await page.evaluate(() => window.__fireplay!.snapshot());
  expect(next.ground).toBe('detected'); expect(Math.abs(next.support.x - first.support.x)).toBeLessThan(.02);
  expect(Math.abs(next.support.y - first.support.y)).toBeLessThan(.02);
  await page.screenshot({ path: 'test-results/actual-ground.png' });
  await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-ground', 'searching'); expect(errors).toEqual([]);
});
