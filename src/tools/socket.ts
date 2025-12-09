import { Server } from 'socket.io';

let io: Server;

export function initSocket(server: any) {
  io = new Server(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    console.log('[SOCKET] Cliente conectado:', socket.id);

    socket.on('joinRoom', (room: string) => {
      console.log('[SOCKET] joinRoom recibido ->', room, 'desde socket:', socket.id);
      socket.join(room);
      console.log('[SOCKET] Salas del socket ahora:', Array.from(socket.rooms));
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Cliente desconectado:', socket.id);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.IO no inicializado');
  return io;
}
