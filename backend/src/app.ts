import express, { Application } from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhooks.js';
import mediaRoutes from './routes/media.js';

export function createApp(): Application {
  const app: Application = express();

  app.use(cors());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/media', mediaRoutes);
  app.use('/api/v1', apiRoutes);
  app.use('/api/webhooks', webhookRoutes);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'PulseChat Backend API', timestamp: new Date() });
  });

  return app;
}
