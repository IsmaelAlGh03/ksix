import { describe, expect, it, vi } from 'vitest';
import { levelFromSamples, watchMicLevel } from './mic-level';

function sine(amplitude: number, length = 1024): Float32Array {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) samples[i] = amplitude * Math.sin((i / length) * Math.PI * 8);
  return samples;
}

describe('levelFromSamples', () => {
  it('reads silence as zero', () => {
    expect(levelFromSamples(new Float32Array(1024))).toBe(0);
  });

  it('reads a full-scale tone as one', () => {
    const samples = new Float32Array(1024).fill(1);
    expect(levelFromSamples(samples)).toBe(1);
  });

  it('puts a speaking-level tone in the upper half', () => {
    const level = levelFromSamples(sine(0.1));
    expect(level).toBeGreaterThan(0.5);
    expect(level).toBeLessThan(0.8);
  });

  it('puts a whisper-level tone below a speaking one', () => {
    expect(levelFromSamples(sine(0.005))).toBeLessThan(levelFromSamples(sine(0.1)));
  });

  it('never goes below zero for a tiny signal', () => {
    expect(levelFromSamples(sine(0.00001))).toBe(0);
  });
});

function fakeContext(fill: (buffer: Float32Array) => void) {
  const source = { connect: vi.fn() };
  const closed = vi.fn(async () => {});
  const context = {
    state: 'running',
    resume: vi.fn(async () => {}),
    close: closed,
    createMediaStreamSource: vi.fn(() => source),
    createAnalyser: () => ({
      fftSize: 0,
      getFloatTimeDomainData: fill,
    }),
  };
  return { context: context as unknown as AudioContext, source, closed };
}

describe('watchMicLevel', () => {
  it('reports a level on every tick', () => {
    let tick: (() => void) | null = null;
    const { context, source } = fakeContext((buffer) => buffer.fill(1));
    const onLevel = vi.fn();

    watchMicLevel({} as MediaStream, onLevel, {
      context: () => context,
      every: (fn) => {
        tick = fn;
        return () => {};
      },
    });

    expect(source.connect).toHaveBeenCalled();
    tick!();
    tick!();
    expect(onLevel.mock.calls).toEqual([[1], [1]]);
  });

  it('stops the ticks and closes the context when stopped', async () => {
    const cancel = vi.fn();
    const { context, closed } = fakeContext(() => {});

    const stop = watchMicLevel({} as MediaStream, vi.fn(), {
      context: () => context,
      every: () => cancel,
    });
    stop();

    expect(cancel).toHaveBeenCalled();
    expect(closed).toHaveBeenCalled();
  });

  it('is a no-op when audio is unavailable', () => {
    const every = vi.fn(() => () => {});

    const stop = watchMicLevel({} as MediaStream, vi.fn(), {
      context: () => {
        throw new Error('no AudioContext');
      },
      every,
    });

    expect(every).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });
});
