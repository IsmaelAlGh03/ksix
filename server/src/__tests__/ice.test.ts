import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { mintTurnCredential, relayUrls } from '../ice';

describe('relayUrls', () => {
  it('keeps only turn and turns urls', () => {
    expect(relayUrls('turn:a:80, turns:b:443, stun:c:19302')).toEqual(['turn:a:80', 'turns:b:443']);
  });

  it('returns nothing for a blank or stun-only list', () => {
    expect(relayUrls('')).toEqual([]);
    expect(relayUrls(' , ')).toEqual([]);
    expect(relayUrls('stun:c:19302')).toEqual([]);
  });
});

describe('mintTurnCredential', () => {
  it('stamps the username with the expiry', () => {
    const { username, expiresAt } = mintTurnCredential('shh', 3600, 1_700_000_000_000);

    expect(expiresAt).toBe(1_700_000_000 + 3600);
    expect(username).toBe(`${expiresAt}:ksix`);
  });

  it('signs the username with the shared secret', () => {
    const { username, credential } = mintTurnCredential('shh', 3600, 1_700_000_000_000);

    expect(credential).toBe(createHmac('sha1', 'shh').update(username).digest('base64'));
  });

  it('produces a different credential for a different secret', () => {
    const a = mintTurnCredential('one', 3600, 1_700_000_000_000);
    const b = mintTurnCredential('two', 3600, 1_700_000_000_000);

    expect(a.credential).not.toBe(b.credential);
  });

  it('moves the expiry forward as time passes', () => {
    const early = mintTurnCredential('shh', 60, 1_700_000_000_000);
    const later = mintTurnCredential('shh', 60, 1_700_000_600_000);

    expect(later.expiresAt).toBeGreaterThan(early.expiresAt);
  });
});
