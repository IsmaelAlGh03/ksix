import { createHmac } from 'node:crypto';
import { env } from './env';

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface IcePayload {
  iceServers: IceServer[];
  expiresAt: number;
}

const STUN_URLS = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];

function isRelayUrl(url: string): boolean {
  return url.startsWith('turn:') || url.startsWith('turns:');
}

export function relayUrls(raw: string): string[] {
  return raw
    .split(',')
    .map((url) => url.trim())
    .filter(isRelayUrl);
}

export function mintTurnCredential(
  secret: string,
  ttlSeconds: number,
  now: number = Date.now(),
): { username: string; credential: string; expiresAt: number } {
  const expiresAt = Math.floor(now / 1000) + ttlSeconds;
  const username = `${expiresAt}:ksix`;
  const credential = createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential, expiresAt };
}

export function iceConfig(now: number = Date.now()): IcePayload {
  const urls = relayUrls(env.turnUrls);

  if (urls.length === 0 || env.turnSecret === '') {
    return { iceServers: [{ urls: STUN_URLS }], expiresAt: 0 };
  }

  const { username, credential, expiresAt } = mintTurnCredential(
    env.turnSecret,
    env.turnTtlSeconds,
    now,
  );

  return {
    iceServers: [{ urls: STUN_URLS }, { urls, username, credential }],
    expiresAt,
  };
}
