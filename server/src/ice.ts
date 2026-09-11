import { env } from './env';

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

const STUN_URLS = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];
const STUN_ONLY: IceServer[] = [{ urls: STUN_URLS }];
const CACHE_MS = 10 * 60 * 1000;

let cached: { servers: IceServer[]; at: number } | null = null;

function isRelayUrl(url: string): boolean {
  return url.startsWith('turn:') || url.startsWith('turns:');
}

function relayUrls(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.filter((url): url is string => typeof url === 'string' && isRelayUrl(url));
}

export function parseMeteredResponse(payload: unknown): IceServer[] {
  const entries = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null && Array.isArray((payload as { iceServers?: unknown }).iceServers)
      ? ((payload as { iceServers: unknown[] }).iceServers)
      : [];

  const relays: IceServer[] = [];

  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { urls, username, credential } = entry as Record<string, unknown>;

    const parsed = relayUrls(urls);
    if (parsed.length === 0) continue;
    if (typeof username !== 'string' || username === '') continue;
    if (typeof credential !== 'string' || credential === '') continue;

    relays.push({ urls: parsed, username, credential });
  }

  return relays;
}

export function meteredUrl(appName: string, apiKey: string): string {
  return `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;
}

export async function iceServers(
  request: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<IceServer[]> {
  if (env.meteredAppName === '' || env.meteredApiKey === '') return STUN_ONLY;
  if (cached !== null && now - cached.at < CACHE_MS) return cached.servers;

  try {
    const response = await request(meteredUrl(env.meteredAppName, env.meteredApiKey));
    if (!response.ok) throw new Error(`metered returned ${response.status}`);

    const relays = parseMeteredResponse(await response.json());
    if (relays.length === 0) throw new Error('metered returned no usable relay');

    cached = { servers: [...STUN_ONLY, ...relays], at: now };
    return cached.servers;
  } catch (error) {
    console.error('ksix: could not fetch relay credentials', error);
    return cached?.servers ?? STUN_ONLY;
  }
}

export function resetIceCache(): void {
  cached = null;
}
