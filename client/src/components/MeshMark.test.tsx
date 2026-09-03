import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeshMark } from './MeshMark';

function reducedMotion(matches: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MeshMark', () => {
  it('draws six nodes and every link between them', () => {
    const { container } = render(<MeshMark />);

    expect(container.querySelectorAll('line')).toHaveLength(15);
    expect(container.querySelectorAll('[data-node]')).toHaveLength(6);
  });

  it('carries traffic dots when motion is allowed', () => {
    reducedMotion(false);
    const { container } = render(<MeshMark />);

    expect(container.querySelectorAll('[data-dot]')).toHaveLength(3);
  });

  it('drops the dots and restores full-weight links when motion is refused', () => {
    reducedMotion(true);
    const { container } = render(<MeshMark />);

    expect(container.querySelectorAll('[data-dot]')).toHaveLength(0);
    expect(container.querySelector('[data-links]')).toHaveAttribute('opacity', '0.85');
  });

  it('dims the links only while the dots are moving over them', () => {
    reducedMotion(false);
    const { container } = render(<MeshMark />);

    expect(container.querySelector('[data-links]')).toHaveAttribute('opacity', '0.32');
  });
});
