import { expect, test } from '@playwright/test';
import { newRoomId } from './room';

test('the lobby tab names the product', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('ksix · peer-to-peer video rooms');
});

test('a room tab leads with its room, so six open tabs stay apart', async ({ page }) => {
  const roomId = newRoomId('tab');
  await page.goto(`/room/${roomId}`);

  await expect(page).toHaveTitle(`${roomId} · ksix`);
});

test('the icons are served as images, not swallowed by the SPA rewrite', async ({ page }) => {
  for (const path of ['/favicon.svg', '/favicon.ico', '/apple-touch-icon.png']) {
    const response = await page.request.get(path);

    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toContain('image/');
  }
});
