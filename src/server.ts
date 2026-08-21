import { createServer } from 'http';
import { createApp } from './app';
import { initSockets } from './sockets';
import { env } from './config/env';

const app = createApp();
const httpServer = createServer(app);
initSockets(httpServer);

httpServer.listen(env.port, () => {
  console.log(`[snickylink-backend] listening on http://localhost:${env.port}`);
});

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0));
});
