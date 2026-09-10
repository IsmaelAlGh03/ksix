import express, { type Express } from 'express';
import cors from 'cors';
import { isAllowedOrigin } from './env';
import { iceConfig } from './ice';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(cors({ origin: (origin, cb) => cb(null, isAllowedOrigin(origin)) }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ice', (_req, res) => {
    const { iceServers, expiresAt } = iceConfig();
    res.set('Cache-Control', 'no-store');
    res.json({ iceServers, expiresAt });
  });

  return app;
}
