import { expect, test } from '@playwright/test';
import { cameraOf, newRoomId, openPreJoin, submitJoin, joinRoom, tile } from './room';

test.use({
  launchOptions: {
    args: [
      '--use-fake-device-for-media-capture',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  },
});

test('a joiner with no devices is told, and the room shows what it cost', async ({ browser }) => {
  const roomId = newRoomId('refused');
  const granted = await browser.newContext();
  const refused = await browser.newContext();
  await granted.grantPermissions(['camera', 'microphone'], { origin: 'http://localhost:5173' });

  try {
    const ada = await joinRoom(granted, roomId, 'Ada');
    const bob = await openPreJoin(refused, roomId, 'Bob');

    await expect(bob.getByRole('alert')).toBeVisible();
    await expect(
      bob.getByRole('button', { name: `Join ${roomId} without camera or mic` }),
    ).toBeVisible();

    await submitJoin(bob);

    await expect(ada.getByText('2 of 6')).toBeVisible();
    await expect(tile(ada, 'Bob')).toBeVisible();
    await expect(cameraOf(ada, 'Bob')).toHaveCount(0);

    await bob.getByRole('textbox', { name: 'Message' }).fill('you cannot see me');
    await bob.getByRole('button', { name: 'Send' }).click();
    await expect(
      ada.getByRole('region', { name: 'Messages' }).getByText('you cannot see me'),
    ).toBeVisible();
  } finally {
    await granted.close();
    await refused.close();
  }
});
