const STUN_URLS = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

const STUN_ONLY: RTCIceServer[] = [{ urls: STUN_URLS }];

let cached: RTCIceServer[] = STUN_ONLY;

function isRelayUrl(url: string): boolean {
  return url.startsWith('turn:') || url.startsWith('turns:');
}

function relayUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return typeof value === 'string' && isRelayUrl(value) ? [value] : [];
  return value.filter((url): url is string => typeof url === 'string' && isRelayUrl(url));
}

export function parseIceServers(payload: unknown): RTCIceServer[] {
  if (typeof payload !== 'object' || payload === null) return STUN_ONLY;

  const { iceServers } = payload as { iceServers?: unknown };
  if (!Array.isArray(iceServers)) return STUN_ONLY;

  const relays: RTCIceServer[] = [];

  for (const entry of iceServers) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { urls, username, credential } = entry as Record<string, unknown>;

    const parsed = relayUrls(urls);
    if (parsed.length === 0) continue;
    if (typeof username !== 'string' || typeof credential !== 'string') continue;
    if (username === '' || credential === '') continue;

    relays.push({ urls: parsed, username, credential });
  }

  return relays.length === 0 ? STUN_ONLY : [...STUN_ONLY, ...relays];
}

export async function loadIceServers(request: typeof fetch = fetch): Promise<RTCIceServer[]> {
  try {
    const response = await request(`${SERVER_URL}/ice`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`ice endpoint returned ${response.status}`);
    cached = parseIceServers(await response.json());
  } catch {
    cached = STUN_ONLY;
  }
  return cached;
}

export function iceServers(): RTCIceServer[] {
  return cached;
}

export function hasTurn(): boolean {
  return cached.some((server) => server.username !== undefined);
}
