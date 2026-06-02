import cors from 'cors';
import express, { Express } from 'express';
import path from 'node:path';
import { loadConfig } from './config';
import { errorHandler } from './middleware/auth';
import authRouter from './routes/auth';
import spacesRouter from './routes/spaces';
import membersRouter from './routes/members';
import dinnerRouter from './routes/dinner';
import adminRouter from './routes/admin';

export function createApp(): Express {
  const cfg = loadConfig();
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  // Static serve for uploaded photos.
  app.use('/uploads', express.static(path.resolve(cfg.uploadsDir)));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, env: cfg.nodeEnv });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/spaces', spacesRouter);
  app.use('/api/members', membersRouter);
  app.use('/api/dinner', dinnerRouter);
  app.use('/api/admin', adminRouter);

  app.use(errorHandler);
  return app;
}
