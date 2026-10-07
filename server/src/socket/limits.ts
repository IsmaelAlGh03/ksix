export const MAX_SOCKETS_PER_IP = 12;
export const MAX_WATCH_CHANNELS = 20;

const REFILL_PER_SECOND = 8;
const BUCKET_CAPACITY = 24;

export interface TokenBucket {
  take(now?: number): boolean;
}

export function createTokenBucket(
  capacity: number = BUCKET_CAPACITY,
  refillPerSecond: number = REFILL_PER_SECOND,
): TokenBucket {
  let tokens = capacity;
  let last = Date.now();

  return {
    take(now: number = Date.now()): boolean {
      tokens = Math.min(capacity, tokens + ((now - last) / 1000) * refillPerSecond);
      last = now;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    },
  };
}

export interface KeyedLimiter {
  take(key: string, now?: number): boolean;
  size(): number;
}

export function createKeyedLimiter(
  capacity: number,
  windowMs: number,
  maxKeys: number = 10_000,
): KeyedLimiter {
  const windows = new Map<string, { count: number; start: number }>();

  function prune(now: number): void {
    for (const [key, entry] of windows) {
      if (now - entry.start >= windowMs) windows.delete(key);
    }
  }

  return {
    take(key, now = Date.now()) {
      const entry = windows.get(key);
      if (entry === undefined || now - entry.start >= windowMs) {
        if (windows.size >= maxKeys) prune(now);
        if (windows.size >= maxKeys) return false;
        windows.set(key, { count: 1, start: now });
        return true;
      }
      if (entry.count >= capacity) return false;
      entry.count += 1;
      return true;
    },
    size: () => windows.size,
  };
}

export interface ConnectionCounter {
  admit(ip: string): boolean;
  release(ip: string): void;
  active(ip: string): number;
}

export function createConnectionCounter(max: number = MAX_SOCKETS_PER_IP): ConnectionCounter {
  const counts = new Map<string, number>();

  return {
    admit(ip) {
      const next = (counts.get(ip) ?? 0) + 1;
      if (next > max) return false;
      counts.set(ip, next);
      return true;
    },
    release(ip) {
      const next = (counts.get(ip) ?? 0) - 1;
      if (next <= 0) counts.delete(ip);
      else counts.set(ip, next);
    },
    active: (ip) => counts.get(ip) ?? 0,
  };
}
