import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMicLevel } from './use-mic-level';

function fakeWatch() {
  let report: ((level: number) => void) | null = null;
  const stop = vi.fn();
  const watch = vi.fn((_stream: MediaStream, onLevel: (level: number) => void) => {
    report = onLevel;
    return stop;
  });
  return { watch, stop, report: (level: number) => act(() => report?.(level)) };
}

const stream = {} as MediaStream;

function wait(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useMicLevel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at zero and not yet quiet', () => {
    const { watch } = fakeWatch();
    const { result } = renderHook(() => useMicLevel(stream, true, watch));

    expect(result.current).toEqual({ level: 0, quiet: false, heard: false });
  });

  it('follows the reported level', () => {
    const { watch, report } = fakeWatch();
    const { result } = renderHook(() => useMicLevel(stream, true, watch));

    report(0.6);

    expect(result.current.level).toBe(0.6);
  });

  it('turns quiet after a stretch with nothing above the threshold', () => {
    const { watch, report } = fakeWatch();
    const { result } = renderHook(() => useMicLevel(stream, true, watch));

    report(0.2);
    wait(1500);

    expect(result.current.quiet).toBe(true);
  });

  it('stays lively while sound keeps arriving', () => {
    const { watch, report } = fakeWatch();
    const { result } = renderHook(() => useMicLevel(stream, true, watch));

    wait(1000);
    report(0.5);
    wait(1000);
    report(0.5);
    wait(1000);

    expect(result.current.quiet).toBe(false);
  });

  it('comes back from quiet when sound returns', () => {
    const { watch, report } = fakeWatch();
    const { result } = renderHook(() => useMicLevel(stream, true, watch));

    wait(1500);
    expect(result.current.quiet).toBe(true);

    report(0.5);
    expect(result.current.quiet).toBe(false);
  });

  it('does not watch without a stream', () => {
    const { watch } = fakeWatch();
    renderHook(() => useMicLevel(null, true, watch));

    expect(watch).not.toHaveBeenCalled();
  });

  it('reads zero, stops watching and is never quiet while the mic is off', () => {
    const { watch, stop, report } = fakeWatch();
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) => useMicLevel(stream, on, watch),
      { initialProps: { on: true } },
    );

    report(0.6);
    rerender({ on: false });
    wait(2000);

    expect(stop).toHaveBeenCalled();
    expect(result.current).toEqual({ level: 0, quiet: false, heard: true });
  });

  it('remembers having heard you even once you go quiet', () => {
    const { watch, report } = fakeWatch();
    const { result } = renderHook(() => useMicLevel(stream, true, watch));

    report(0.5);
    wait(1500);

    expect(result.current).toMatchObject({ quiet: true, heard: true });
  });

  it('forgets what it heard when the stream changes', () => {
    const { watch, report } = fakeWatch();
    const { result, rerender } = renderHook(
      ({ s }: { s: MediaStream }) => useMicLevel(s, true, watch),
      { initialProps: { s: stream } },
    );

    report(0.5);
    rerender({ s: {} as MediaStream });

    expect(result.current.heard).toBe(false);
  });

  it('stops watching on unmount', () => {
    const { watch, stop } = fakeWatch();
    const { unmount } = renderHook(() => useMicLevel(stream, true, watch));

    unmount();

    expect(stop).toHaveBeenCalled();
  });
});
