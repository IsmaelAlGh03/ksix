import { describe, expect, it } from 'vitest';
import { LOBBY_TITLE, roomTitle } from './page-title';

describe('page titles', () => {
  it('names the product and what it is on the lobby', () => {
    expect(LOBBY_TITLE).toBe('ksix · peer-to-peer video rooms');
  });

  it('leads with the room, which is what tells two tabs apart', () => {
    expect(roomTitle('quiet-harbor-41')).toBe('quiet-harbor-41 · ksix');
  });

  it('falls back to the product alone when there is no room in the path', () => {
    expect(roomTitle('')).toBe('ksix');
    expect(roomTitle('   ')).toBe('ksix');
  });

  it('trims a room id rather than titling a tab with whitespace', () => {
    expect(roomTitle('  quiet-harbor-41  ')).toBe('quiet-harbor-41 · ksix');
  });

  it('separates with the middot the room header already uses, never an em dash', () => {
    expect(roomTitle('alpha')).not.toContain('—');
    expect(LOBBY_TITLE).not.toContain('—');
  });
});
