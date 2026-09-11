import express, { type Express } from 'express';
import cors from 'cors';
import { isAllowedOrigin } from './env';
import { iceServers } from './ice';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(cors({ origin: (origin, cb) => cb(null, isAllowedOrigin(origin)) }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ice', (_req, res) => {
    void iceServers().then((servers) => {
      res.set('Cache-Control', 'no-store');
      res.json({ iceServers: servers });
    });
  });

  return app;
}
