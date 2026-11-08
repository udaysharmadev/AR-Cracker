import { expect, test } from '@playwright/test';
declare global { interface Window { cameraTestStreams?: MediaStream[] } }
test.use({ baseURL: 'http://127.0.0.1:4173' });
test('compiled build uses actual models, excludes replay and releases camera tracks', async ({ page }) => {
  const errors: string[] = [], logs: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.cameraTestStreams = [];
    navigator.mediaDevices.getUserMedia = async constraints => { const stream = await original(constraints); window.cameraTestStreams?.push(stream); return stream; };
  });
  await page.goto('/?replay=1');
  expect(await page.evaluate(() => window.__fireplay)).toBeUndefined();
  await expect(page.getByText('SYNTHETIC REPLAY', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start Camera', exact: true }).click();
  await expect(page.getByTestId('vision-ready')).toBeVisible({ timeout: 55000 });
  await page.waitForTimeout(700); // Exercise actual worker video inference, not just initialization.
  expect(await page.evaluate(() => window.cameraTestStreams?.flatMap(s => s.getTracks().map(t => t.readyState)))).toEqual(['live']);
  await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Camera', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.cameraTestStreams?.flatMap(s => s.getTracks().map(t => t.readyState)))).toEqual(['ended']);
  expect(errors).toEqual([]);
  await test.info().attach('browser-console', { body: logs.join('\n'), contentType: 'text/plain' });
  // MediaPipe routes informational graph messages through stderr/console.error.
  expect(logs.filter(message => !(/^(I\d|W\d|INFO:|WARNING:)/.test(message) || /\[W:onnxruntime:Default, cpuid_info\.cc/.test(message)))).toEqual([]);
});
