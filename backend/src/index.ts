import http from 'http';
import dotenv from 'dotenv';
import { setupSocketServer } from './sockets/socketServer.js';
import { env } from './config/env.js';
import { createApp } from './app.js';

dotenv.config();

const app = createApp();
const server = http.createServer(app);

// Setup Real-Time Socket.io Server
const io = setupSocketServer(server);
app.set('io', io);

const PORT = env.PORT;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 [PulseChat Server] Running on http://${HOST}:${PORT}`);
  console.log(`📡 [Socket.io] Real-time websocket engine active`);
  console.log(`📲 [Twilio MMS] Webhook endpoint ready at http://localhost:${PORT}/api/webhooks/twilio/incoming`);
});
