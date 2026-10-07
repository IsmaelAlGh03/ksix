import express, { type Express } from 'express';
import cors from 'cors';
import { isAllowedOrigin } from './env';
import { iceServers } from './ice';
import { createKeyedLimiter, type KeyedLimiter } from './socket/limits';

const ICE_REQUESTS_PER_MINUTE = 10;

export function createApp(
  iceLimiter: KeyedLimiter = createKeyedLimiter(ICE_REQUESTS_PER_MINUTE, 60_000),
): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(cors({ origin: (origin, cb) => cb(null, isAllowedOrigin(origin)) }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ice', (req, res) => {
    if (!isAllowedOrigin(req.headers.origin)) {
      res.status(403).json({ error: 'origin not allowed' });
      return;
    }
    if (!iceLimiter.take(req.ip ?? 'unknown')) {
      res.status(429).set('Retry-After', '60').json({ error: 'too many requests' });
      return;
    }
    void iceServers().then((servers) => {
      res.set('Cache-Control', 'no-store');
      res.json({ iceServers: servers });
    });
  });

  return app;
}
