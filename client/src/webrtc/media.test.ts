import { describe, expect, it, vi } from 'vitest';
import { describeMediaError, openMedia, readMediaPermission } from './media';

const stream = { id: 'fake' } as unknown as MediaStream;
const fail = (name: string, message = 'no'): DOMException => new DOMException(message, name);
const unknown = async (): Promise<'unknown'> => 'unknown';

describe('openMedia', () => {
  it('returns the full stream when both devices are granted', async () => {
    const request = vi.fn().mockResolvedValue(stream);
    const result = await openMedia(request, undefined, true, unknown);

    expect(result).toEqual({ stream, mode: 'full', error: null });
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith({ video: true, audio: true });
  });

  it('falls back to audio when the camera is refused', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(fail('NotReadableError'))
      .mockResolvedValueOnce(stream);

    const result = await openMedia(request, undefined, true, unknown);

    expect(result.mode).toBe('audio-only');
    expect(result.stream).toBe(stream);
    expect(result.error).toBe('Another app is using your camera. Close it, then try again.');
    expect(request).toHaveBeenNthCalledWith(2, { audio: true });
  });

  it('falls all the way to view-only when both are refused', async () => {
    const request = vi.fn().mockRejectedValue(fail('NotAllowedError'));
    const result = await openMedia(request, undefined, true, unknown);

    expect(result.stream).toBeNull();
    expect(result.mode).toBe('view-only');
    expect(result.error).toBe(
      'Your browser is blocking the camera and microphone. Allow them in the settings for this site, then try again.',
    );
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('carries the caller device choice into both rungs', async () => {
    const video = { deviceId: { exact: 'cam1' } };
    const audio = { deviceId: { exact: 'mic1' } };
    const request = vi
      .fn()
      .mockRejectedValueOnce(fail('NotFoundError'))
      .mockResolvedValueOnce(stream);

    await openMedia(request, { video, audio }, true, unknown);

    expect(request).toHaveBeenNthCalledWith(1, { video, audio });
    expect(request).toHaveBeenNthCalledWith(2, { audio });
  });

  it('does not ask twice off a secure origin, where nothing can work', async () => {
    const request = vi.fn().mockRejectedValue(new TypeError('no mediaDevices'));
    const result = await openMedia(request, undefined, false, unknown);

    expect(result.mode).toBe('view-only');
    expect(result.error).toContain('secure connection');
    expect(request).toHaveBeenCalledOnce();
  });

  it('reads the permission once and lets it name both rungs', async () => {
    const readPermission = vi.fn().mockResolvedValue('denied');
    const request = vi.fn().mockRejectedValue(fail('NotAllowedError'));

    const result = await openMedia(request, undefined, true, readPermission);

    expect(readPermission).toHaveBeenCalledOnce();
    expect(result.error).toContain('lock icon');
  });

  it('does not ask for the permission when nothing was refused', async () => {
    const readPermission = vi.fn().mockResolvedValue('denied');
    await openMedia(vi.fn().mockResolvedValue(stream), undefined, true, readPermission);

    expect(readPermission).not.toHaveBeenCalled();
  });
});

describe('describeMediaError', () => {
  const denied = fail('NotAllowedError', 'denied');

  it('names the secure connection when the page is not a secure context', () => {
    expect(describeMediaError(new TypeError('x'), false)).toBe(
      'The camera and microphone need a secure connection. Open this page over HTTPS.',
    );
  });

  it('blames the secure context before the error, since mediaDevices is missing entirely', () => {
    expect(describeMediaError(denied, false)).toContain('secure connection');
  });

  it('sends a hard block to the lock icon, because reloading will not prompt again', () => {
    expect(describeMediaError(denied, true, 'denied')).toBe(
      'Your browser is blocking the camera and microphone. Allow them from the lock icon beside the address, then try again.',
    );
  });

  it('asks a dismissed prompt to answer it, not to reset anything', () => {
    const message = describeMediaError(denied, true, 'prompt');

    expect(message).toBe(
      'You have not answered the camera and microphone prompt yet. Try again, then choose Allow.',
    );
    expect(message).not.toContain('lock icon');
  });

  it('covers both cases where the browser will not say which it is', () => {
    expect(describeMediaError(denied, true, 'unknown')).toBe(
      'Your browser is blocking the camera and microphone. Allow them in the settings for this site, then try again.',
    );
  });

  it('sends an operating-system block outside the browser', () => {
    const message = describeMediaError(
      fail('NotAllowedError', 'Permission denied by system'),
      true,
      'granted',
    );

    expect(message).toBe(
      'Your computer is blocking the browser from using the camera and microphone. Allow the browser in your privacy settings, then try again.',
    );
  });

  it('names a camera held by another app', () => {
    expect(describeMediaError(fail('NotReadableError', 'busy'), true)).toBe(
      'Another app is using your camera. Close it, then try again.',
    );
  });

  it('names a missing device', () => {
    expect(describeMediaError(fail('NotFoundError', 'none'), true)).toBe(
      'No camera or microphone found. Connect one, then try again.',
    );
  });

  it('falls back to the generic message for an unknown error on a secure page', () => {
    expect(describeMediaError(new TypeError('something else'), true)).toBe(
      'The camera and microphone would not start. Try again, or reload the page.',
    );
  });

  it('never offers a reload as the way out of a refusal', () => {
    const refusals = ['NotAllowedError', 'NotReadableError', 'NotFoundError'];

    for (const name of refusals) {
      for (const permission of ['denied', 'prompt', 'granted', 'unknown'] as const) {
        expect(describeMediaError(fail(name), true, permission)).not.toContain('reload');
      }
    }
  });
});

describe('readMediaPermission', () => {
  function withPermissions(value: unknown): void {
    Object.defineProperty(navigator, 'permissions', { configurable: true, value });
  }

  it('is unknown where the browser has no Permissions API for devices', async () => {
    withPermissions({ query: vi.fn().mockRejectedValue(new TypeError('unsupported')) });
    await expect(readMediaPermission()).resolves.toBe('unknown');
  });

  it('reports denied when either device is blocked', async () => {
    withPermissions({
      query: vi
        .fn()
        .mockResolvedValueOnce({ state: 'granted' })
        .mockResolvedValueOnce({ state: 'denied' }),
    });
    await expect(readMediaPermission()).resolves.toBe('denied');
  });

  it('prefers denied over an unanswered prompt', async () => {
    withPermissions({
      query: vi
        .fn()
        .mockResolvedValueOnce({ state: 'prompt' })
        .mockResolvedValueOnce({ state: 'denied' }),
    });
    await expect(readMediaPermission()).resolves.toBe('denied');
  });

  it('reports prompt when nothing is blocked and something is unanswered', async () => {
    withPermissions({
      query: vi
        .fn()
        .mockResolvedValueOnce({ state: 'granted' })
        .mockResolvedValueOnce({ state: 'prompt' }),
    });
    await expect(readMediaPermission()).resolves.toBe('prompt');
  });

  it('reports granted when both devices are allowed', async () => {
    withPermissions({ query: vi.fn().mockResolvedValue({ state: 'granted' }) });
    await expect(readMediaPermission()).resolves.toBe('granted');
  });
});
