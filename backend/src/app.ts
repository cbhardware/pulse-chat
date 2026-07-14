import express, { Application } from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhooks.js';
import mediaRoutes from './routes/media.js';
import { allowedFrontendOrigins } from './config/env.js';

export function createApp(): Application {
  const app: Application = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow server-to-server calls and CLI checks that do not send Origin.
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedFrontendOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    })
  );
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
