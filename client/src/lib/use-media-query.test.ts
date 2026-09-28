import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './use-media-query';

function stubQuery(initial: boolean): { flip: (matches: boolean) => void } {
  const listeners = new Set<() => void>();
  const query = {
    matches: initial,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.spyOn(window, 'matchMedia').mockImplementation(() => query as unknown as MediaQueryList);

  return {
    flip(matches: boolean): void {
      query.matches = matches;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('useMediaQuery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the query on first render', () => {
    stubQuery(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(true);
  });

  it('follows the viewport when it crosses the query', () => {
    const media = stubQuery(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));

    act(() => media.flip(true));
    expect(result.current).toBe(true);
  });
});
