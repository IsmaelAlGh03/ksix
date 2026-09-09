import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDocumentTitle } from './use-document-title';

describe('useDocumentTitle', () => {
  it('sets the tab title', () => {
    renderHook(() => useDocumentTitle('alpha · ksix'));
    expect(document.title).toBe('alpha · ksix');
  });

  it('follows the title when it changes', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'alpha · ksix' },
    });

    rerender({ title: 'beta · ksix' });
    expect(document.title).toBe('beta · ksix');
  });

  it('leaves the title alone once it unmounts, so the next route owns it', () => {
    const { unmount } = renderHook(() => useDocumentTitle('alpha · ksix'));
    unmount();
    expect(document.title).toBe('alpha · ksix');
  });
});
