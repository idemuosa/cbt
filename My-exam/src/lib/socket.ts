import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = async (token: string): Promise<Socket> => {
  if (socket) return socket;

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  
  socket = io(backendUrl, {
    auth: {
      token
    },
    reconnection: true,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Connected to real-time backend');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
