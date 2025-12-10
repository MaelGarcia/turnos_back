// src/index.ts
process.env.TZ = 'America/Mexico_City';
import { createServer } from 'http';
import { buildServer } from './server/app';
import { initSocket } from './tools/socket';
import { startBot } from './bot/main';

const app = buildServer();
const server = createServer(app);
const EXPRESS_PORT = process.env.EXPRESS_PORT;
const DB_PORT = process.env.POSTGRES_DB_PORT;

// Inicializar Socket.IO
initSocket(server);

server.listen(EXPRESS_PORT, () => {
  console.log(`📀 Base de datos conectando atraves del puerto: ${DB_PORT}`)
  console.log(`🌐 Servidor API con Socket.IO en http://localhost:${EXPRESS_PORT}`);
});

// Iniciar el bot
startBot()
  .then(() => console.log('🤖 Servicio Bot Funcionando...'))
  .catch((err) => console.error('❌ Bot Falló:', err));
