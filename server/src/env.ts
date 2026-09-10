import 'dotenv/config';

function str(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}"`);
  }
  return parsed;
}

export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  port: int('PORT', 4000),
  clientOrigins: str('CLIENT_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  turnUrls: str('TURN_URLS', ''),
  turnSecret: str('TURN_SECRET', ''),
  turnTtlSeconds: int('TURN_TTL_SECONDS', 3600),
} as const;

export const isProduction = env.nodeEnv === 'production';

const PREVIEW_SCOPE = str('VERCEL_PREVIEW_SCOPE', '');

function previewPattern(scope: string): RegExp | null {
  if (!/^[a-z0-9-]+$/.test(scope)) return null;
  return new RegExp('^ksix-[a-z0-9]{6,16}-' + scope + '[.]vercel[.]app$');
}

const previewHost = previewPattern(PREVIEW_SCOPE);

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (origin === undefined) return false;
  if (env.clientOrigins.includes(origin)) return true;
  if (previewHost === null) return false;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  return url.protocol === 'https:' && url.port === '' && previewHost.test(url.hostname);
}
