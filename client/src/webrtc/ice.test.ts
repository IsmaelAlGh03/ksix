import { describe, expect, it } from 'vitest';
import { hasTurn, iceServers, loadIceServers, parseIceServers } from './ice';

const STUN = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];

const relay = {
  urls: ['turn:relay.example.com:80'],
  username: '1700000000:ksix',
  credential: 'signature',
};

function turnEntry(servers: RTCIceServer[]): RTCIceServer | undefined {
  return servers.find((server) => server.username !== undefined);
}

function respondWith(body: unknown, ok = true): typeof fetch {
  return (() =>
    Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) })) as unknown as typeof fetch;
}

describe('parseIceServers', () => {
  it('falls back to STUN when the payload has no relay', () => {
    const servers = parseIceServers({ iceServers: [{ urls: STUN }] });

    expect(servers).toHaveLength(1);
    expect(servers[0]?.urls).toEqual(STUN);
  });

  it('keeps a complete relay entry alongside STUN', () => {
    const servers = parseIceServers({ iceServers: [{ urls: STUN }, relay] });

    expect(servers).toHaveLength(2);
    expect(turnEntry(servers)).toEqual(relay);
  });

  it('drops a relay missing its credential', () => {
    expect(parseIceServers({ iceServers: [{ ...relay, credential: '' }] })).toHaveLength(1);
    expect(parseIceServers({ iceServers: [{ urls: relay.urls, username: relay.username }] })).toHaveLength(1);
  });

  it('drops non-relay urls from a credentialled entry', () => {
    expect(parseIceServers({ iceServers: [{ ...relay, urls: ['stun:relay.example.com:80'] }] })).toHaveLength(1);
  });

  it('accepts a single relay url given as a string', () => {
    const servers = parseIceServers({ iceServers: [{ ...relay, urls: 'turn:relay.example.com:80' }] });

    expect(turnEntry(servers)?.urls).toEqual(['turn:relay.example.com:80']);
  });

  it('survives a malformed payload', () => {
    expect(parseIceServers(null)).toHaveLength(1);
    expect(parseIceServers({})).toHaveLength(1);
    expect(parseIceServers({ iceServers: 'nope' })).toHaveLength(1);
    expect(parseIceServers({ iceServers: [null, 7, 'x'] })).toHaveLength(1);
  });
});

describe('loadIceServers', () => {
  it('caches what the endpoint returns', async () => {
    await loadIceServers(respondWith({ iceServers: [{ urls: STUN }, relay] }));

    expect(hasTurn()).toBe(true);
    expect(turnEntry(iceServers())).toEqual(relay);
  });

  it('falls back to STUN when the endpoint fails', async () => {
    await loadIceServers(respondWith({}, false));

    expect(hasTurn()).toBe(false);
    expect(iceServers()).toHaveLength(1);
  });

  it('falls back to STUN when the request throws', async () => {
    await loadIceServers((() => Promise.reject(new Error('offline'))) as unknown as typeof fetch);

    expect(hasTurn()).toBe(false);
    expect(iceServers()[0]?.urls).toEqual(STUN);
  });
});
