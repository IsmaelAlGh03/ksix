import { beforeEach, describe, expect, it } from 'vitest';
import { meteredUrl, parseMeteredResponse, resetIceCache } from '../ice';

const relay = {
  urls: 'turn:global.relay.metered.ca:443',
  username: 'abc123',
  credential: 'shh',
};

beforeEach(() => {
  resetIceCache();
});

describe('meteredUrl', () => {
  it('builds the credentials endpoint for the app', () => {
    expect(meteredUrl('ksix', 'key')).toBe(
      'https://ksix.metered.live/api/v1/turn/credentials?apiKey=key',
    );
  });

  it('escapes an api key with url-unsafe characters', () => {
    expect(meteredUrl('ksix', 'a/b+c')).toContain('apiKey=a%2Fb%2Bc');
  });
});

describe('parseMeteredResponse', () => {
  it('keeps a credentialled relay from a bare array', () => {
    expect(parseMeteredResponse([relay])).toEqual([
      { urls: [relay.urls], username: relay.username, credential: relay.credential },
    ]);
  });

  it('accepts the same entries wrapped in iceServers', () => {
    expect(parseMeteredResponse({ iceServers: [relay] })).toHaveLength(1);
  });

  it('drops the stun entries metered returns alongside the relays', () => {
    const servers = parseMeteredResponse([{ urls: 'stun:stun.relay.metered.ca:80' }, relay]);

    expect(servers).toHaveLength(1);
    expect(servers[0]?.urls).toEqual([relay.urls]);
  });

  it('drops a relay that arrives without credentials', () => {
    expect(parseMeteredResponse([{ urls: relay.urls }])).toEqual([]);
    expect(parseMeteredResponse([{ ...relay, credential: '' }])).toEqual([]);
  });

  it('survives a malformed payload', () => {
    expect(parseMeteredResponse(null)).toEqual([]);
    expect(parseMeteredResponse('nope')).toEqual([]);
    expect(parseMeteredResponse([null, 7, 'x'])).toEqual([]);
  });
});
