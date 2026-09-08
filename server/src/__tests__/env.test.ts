import { afterEach, describe, expect, it, vi } from 'vitest';
import { env, isAllowedOrigin } from '../env';

async function withScope(scope: string) {
  vi.resetModules();
  vi.stubEnv('VERCEL_PREVIEW_SCOPE', scope);
  return import('../env');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('isAllowedOrigin', () => {
  it('allows an origin from the configured list', () => {
    expect(env.clientOrigins).toContain('http://localhost:5173');
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
  });

  it('refuses an unlisted origin', () => {
    expect(isAllowedOrigin('https://example.com')).toBe(false);
  });

  it('refuses a request with no origin header', () => {
    expect(isAllowedOrigin(undefined)).toBe(false);
  });

  it('refuses every preview when no scope is configured', async () => {
    const { isAllowedOrigin: allowed } = await withScope('');
    expect(allowed('https://ksix-abc123-ismael.vercel.app')).toBe(false);
  });
});

describe('isAllowedOrigin with a preview scope', () => {
  it('allows a preview owned by the configured scope', async () => {
    const { isAllowedOrigin: allowed } = await withScope('ismael');
    expect(allowed('https://ksix-abc123-ismael.vercel.app')).toBe(true);
  });

  it('refuses a project merely named ksix- under another scope', async () => {
    const { isAllowedOrigin: allowed } = await withScope('ismael');
    expect(allowed('https://ksix-evil-attacker.vercel.app')).toBe(false);
  });

  it('refuses a scope that only ends in the configured one', async () => {
    const { isAllowedOrigin: allowed } = await withScope('ismael');
    expect(allowed('https://ksix-x-notismael.vercel.app')).toBe(false);
  });

  it('refuses a host where an unescaped dot would have matched', async () => {
    const { isAllowedOrigin: allowed } = await withScope('ismael');
    expect(allowed('https://ksix-x-ismaelavercel.app')).toBe(false);
  });

  it('refuses a lookalike registrable domain', async () => {
    const { isAllowedOrigin: allowed } = await withScope('ismael');
    expect(allowed('https://ksix-x-ismael.vercel.app.evil.com')).toBe(false);
  });

  it('refuses a subdomain below the preview host', async () => {
    const { isAllowedOrigin: allowed } = await withScope('ismael');
    expect(allowed('https://evil.ksix-x-ismael.vercel.app')).toBe(false);
  });

  it('refuses plain http', async () => {
    const { isAllowedOrigin: allowed } = await withScope('ismael');
    expect(allowed('http://ksix-abc123-ismael.vercel.app')).toBe(false);
  });

  it('refuses a malformed origin', async () => {
    const { isAllowedOrigin: allowed } = await withScope('ismael');
    expect(allowed('not a url')).toBe(false);
    expect(allowed('null')).toBe(false);
  });
});
