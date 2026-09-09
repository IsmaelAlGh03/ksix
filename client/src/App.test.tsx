import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('./webrtc/useWebRTC', () => ({
  useWebRTC: () => ({
    status: 'idle',
    localStream: null,
    participants: [],
    mediaError: null,
  }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('shows the lobby at the root', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { name: 'ksix' })).toBeInTheDocument();
  });

  it('shows the room named in the path', () => {
    renderAt('/room/quiet-harbor-41');

    expect(screen.getByText('quiet-harbor-41')).toBeInTheDocument();
  });

  it('titles the lobby tab with the product', () => {
    renderAt('/');

    expect(document.title).toBe('ksix · peer-to-peer video rooms');
  });

  it('titles a room tab with its room, so six open tabs stay apart', () => {
    renderAt('/room/quiet-harbor-41');

    expect(document.title).toBe('quiet-harbor-41 · ksix');
  });

  it('sends an unknown path back to the lobby', () => {
    renderAt('/nowhere');

    expect(screen.getByRole('heading', { name: 'ksix' })).toBeInTheDocument();
  });
});
