import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app';
import { createKeyedLimiter } from '../socket/limits';

const ALLOWED_ORIGIN = 'http://localhost:5173';

let http: Server;
let base: string;

function ice(origin?: string): Promise<Response> {
  return fetch(`${base}/ice`, { headers: origin === undefined ? {} : { origin } });
}

beforeAll(async () => {
  http = createServer(createApp(createKeyedLimiter(3, 60_000)));
  await new Promise<void>((resolve) => http.listen(0, resolve));
  base = `http://localhost:${(http.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => http.close(() => resolve()));
});

describe('/ice', () => {
  it('refuses a request with no origin', async () => {
    expect((await ice()).status).toBe(403);
  });

  it('refuses a request from a site that is not on the list', async () => {
    expect((await ice('https://evil.example')).status).toBe(403);
  });

  it('serves the allowed origin until the per-ip limit runs out', async () => {
    const statuses = [];
    for (let i = 0; i < 4; i += 1) statuses.push((await ice(ALLOWED_ORIGIN)).status);

    expect(statuses).toEqual([200, 200, 200, 429]);
  });
});

describe('createKeyedLimiter', () => {
  it('counts each key separately', () => {
    const limiter = createKeyedLimiter(1, 1000);

    expect(limiter.take('a', 0)).toBe(true);
    expect(limiter.take('a', 0)).toBe(false);
    expect(limiter.take('b', 0)).toBe(true);
  });

  it('opens a new window once the old one has passed', () => {
    const limiter = createKeyedLimiter(1, 1000);

    limiter.take('a', 0);
    expect(limiter.take('a', 999)).toBe(false);
    expect(limiter.take('a', 1000)).toBe(true);
  });

  it('prunes expired keys instead of growing without bound', () => {
    const limiter = createKeyedLimiter(1, 1000, 2);

    limiter.take('a', 0);
    limiter.take('b', 0);
    expect(limiter.take('c', 500)).toBe(false);
    expect(limiter.take('c', 1000)).toBe(true);
    expect(limiter.size()).toBe(1);
  });
});
