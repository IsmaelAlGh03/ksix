import { describe, expect, it } from 'vitest';
import { createRoomId, parseRoomId } from './room-id';

describe('createRoomId', () => {
  it('reads as two words and a random suffix', () => {
    expect(createRoomId()).toMatch(/^[a-z]+-[a-z]+-[a-z2-7]{8}$/);
  });

  it('does not repeat itself', () => {
    const ids = new Set(Array.from({ length: 500 }, createRoomId));

    expect(ids.size).toBe(500);
  });
});

describe('parseRoomId', () => {
  it('accepts a bare room name', () => {
    expect(parseRoomId('quiet-harbor-k3n9wqxz')).toBe('quiet-harbor-k3n9wqxz');
  });

  it('pulls the room out of a full link', () => {
    expect(parseRoomId('https://ksix.dev/room/quiet-harbor-k3n9wqxz')).toBe('quiet-harbor-k3n9wqxz');
  });

  it('ignores a trailing slash and query string', () => {
    expect(parseRoomId('https://ksix.dev/room/quiet-harbor-k3n9wqxz/?x=1')).toBe('quiet-harbor-k3n9wqxz');
  });

  it('trims and lowercases what was pasted', () => {
    expect(parseRoomId('  Quiet-Harbor-K3N9WQXZ  ')).toBe('quiet-harbor-k3n9wqxz');
  });

  it('rejects an empty entry', () => {
    expect(parseRoomId('   ')).toBeNull();
  });

  it('rejects characters that cannot appear in a room name', () => {
    expect(parseRoomId('quiet harbor/41')).toBeNull();
  });

  it('rejects an over-long room name', () => {
    expect(parseRoomId('a'.repeat(65))).toBeNull();
  });
});
