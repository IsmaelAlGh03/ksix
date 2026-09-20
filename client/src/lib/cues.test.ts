import { describe, expect, it, vi } from 'vitest';
import { createCues } from './cues';

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    items,
  } as unknown as Storage & { items: Map<string, string> };
}

function fakeContext() {
  const started: number[] = [];
  const context = {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {}),
    createGain: () => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }),
    createOscillator: () => {
      const oscillator = {
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(() => started.push(oscillator.frequency.value)),
        stop: vi.fn(),
      };
      return oscillator;
    },
  };
  return { context: context as unknown as AudioContext, started, resume: context.resume };
}

describe('createCues', () => {
  it('plays a rising pair for a join', () => {
    const { context, started } = fakeContext();
    const cues = createCues({ context: () => context, storage: fakeStorage() });

    cues.play('join');

    expect(started).toHaveLength(2);
    expect(started[0]).toBeLessThan(started[1]!);
  });

  it('plays a falling pair for a leave', () => {
    const { context, started } = fakeContext();
    const cues = createCues({ context: () => context, storage: fakeStorage() });

    cues.play('leave');

    expect(started).toHaveLength(2);
    expect(started[0]).toBeGreaterThan(started[1]!);
  });

  it('plays a single tick for a message', () => {
    const { context, started } = fakeContext();
    const cues = createCues({ context: () => context, storage: fakeStorage() });

    cues.play('message');

    expect(started).toHaveLength(1);
  });

  it('creates the context once and reuses it', () => {
    const { context } = fakeContext();
    const factory = vi.fn(() => context);
    const cues = createCues({ context: factory, storage: fakeStorage() });

    cues.play('join');
    cues.play('message');

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('resumes a suspended context before playing', () => {
    const { context, resume } = fakeContext();
    (context as unknown as { state: string }).state = 'suspended';
    const cues = createCues({ context: () => context, storage: fakeStorage() });

    cues.play('join');

    expect(resume).toHaveBeenCalled();
  });

  it('stays silent while disabled and never opens a context', () => {
    const { context, started } = fakeContext();
    const factory = vi.fn(() => context);
    const cues = createCues({ context: factory, storage: fakeStorage() });

    cues.setEnabled(false);
    cues.play('join');

    expect(started).toHaveLength(0);
    expect(factory).not.toHaveBeenCalled();
  });

  it('is on when nothing has been stored', () => {
    const cues = createCues({ context: () => fakeContext().context, storage: fakeStorage() });
    expect(cues.enabled()).toBe(true);
  });

  it('reads a stored off preference', () => {
    const storage = fakeStorage({ 'ksix:sounds': 'off' });
    const cues = createCues({ context: () => fakeContext().context, storage });
    expect(cues.enabled()).toBe(false);
  });

  it('remembers the preference', () => {
    const storage = fakeStorage();
    const cues = createCues({ context: () => fakeContext().context, storage });

    cues.setEnabled(false);

    expect(storage.items.get('ksix:sounds')).toBe('off');
    expect(cues.enabled()).toBe(false);
  });

  it('does not throw when audio is unavailable', () => {
    const cues = createCues({
      context: () => {
        throw new Error('no AudioContext');
      },
      storage: fakeStorage(),
    });

    expect(() => cues.play('join')).not.toThrow();
  });

  it('does not throw when storage is unavailable', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    const cues = createCues({ context: () => fakeContext().context, storage });

    expect(cues.enabled()).toBe(true);
    expect(() => cues.setEnabled(false)).not.toThrow();
  });
});
