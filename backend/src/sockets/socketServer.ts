import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import prisma from '../db/prisma.js';
import { verifyAuthToken } from '../services/authService.js';

type AuthedSocket = Socket & {
  data: {
    userId: string;
    userPhoneNumber: string;
  };
};

function getTokenFromHandshake(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim().length > 0) {
    return authToken.trim();
  }

  const authHeader = socket.handshake.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    return token.length > 0 ? token : null;
  }

  return null;
}

export function setupSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = getTokenFromHandshake(socket);
    if (!token) {
      next(new Error('Unauthorized: missing token'));
      return;
    }

    try {
      const payload = verifyAuthToken(token);
      const authedSocket = socket as AuthedSocket;
      authedSocket.data.userId = payload.sub;
      authedSocket.data.userPhoneNumber = payload.phoneNumber;
      next();
    } catch {
      next(new Error('Unauthorized: invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authedSocket = socket as AuthedSocket;
    console.log(`[Socket.io] Client connected: ${socket.id} (user ${authedSocket.data.userId})`);

    // Join a specific group chat room to receive real-time updates
    socket.on('join_group', async (groupId: string) => {
      if (!groupId || typeof groupId !== 'string') {
        socket.emit('socket_error', { message: 'Invalid group id.' });
        return;
      }

      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: authedSocket.data.userId,
          },
        },
      });

      if (!membership) {
        socket.emit('socket_error', { message: 'Forbidden: not a member of this group.' });
        return;
      }

      socket.join(groupId);
      console.log(`[Socket.io] Socket ${socket.id} joined group room: ${groupId}`);
    });

    // Leave a group chat room
    socket.on('leave_group', (groupId: string) => {
      socket.leave(groupId);
      console.log(`[Socket.io] Socket ${socket.id} left group room: ${groupId}`);
    });

    // Handle real-time typing indicators
    socket.on('typing', ({ groupId, userName }: { groupId: string; userName: string }) => {
      if (!socket.rooms.has(groupId)) {
        return;
      }
      socket.to(groupId).emit('user_typing', { userName });
    });

    socket.on('stop_typing', ({ groupId, userName }: { groupId: string; userName: string }) => {
      if (!socket.rooms.has(groupId)) {
        return;
      }
      socket.to(groupId).emit('user_stop_typing', { userName });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
