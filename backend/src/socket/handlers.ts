import { Server, Socket } from 'socket.io';

export const registerSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`User connected: ${user.uid} (${user.email})`);

    // Join a specific exam room
    socket.on('join-exam', (examId: string) => {
      socket.join(`exam_${examId}`);
      console.log(`User ${user.uid} joined exam room: exam_${examId}`);
      
      // Notify others in the room (admins) that a student joined
      socket.to(`exam_${examId}`).emit('student-joined', {
        uid: user.uid,
    // Proctoring: Report violations or status updates
    socket.on('proctor-event', (data) => {
      const { examId, type, details } = data;
      
      // Broadcast to all admins
      io.to('admin-room').emit('proctor-alert', {
        student: {
          id: socket.id,
          uid: (socket as any).user.uid,
          email: (socket as any).user.email,
          examNumber: (socket as any).user.examNumber || 'N/A'
        },
        examId,
        type,
        details,
        timestamp: new Date().toISOString()
      });
    });

    // Admin Commands: Lock, Message, Terminate
    socket.on('proctor-command', (data) => {
      const { targetSocketId, command, message } = data;
      io.to(targetSocketId).emit('admin-command', {
        command,
        message,
        timestamp: new Date().toISOString()
      });
    });

    // Room Management
    socket.on('join-exam', (examId) => {
      socket.join(examId);
      if ((socket as any).user.role === 'admin') {
        socket.join('admin-room');
      }
    });

    // Admin commands (Sync timer, end exam, etc.)
    socket.on('admin-command', (data: { examId: string; command: string; payload?: any }) => {
      const { examId, command, payload } = data;
      
      // Basic role check (ensure user is admin - in a real app, verify 'admin' claim)
      if (user.role !== 'admin' && !process.env.DEBUG_MODE) {
        return socket.emit('error', 'Unauthorized: Admin role required');
      }

      console.log(`Admin command for ${examId}: ${command}`);
      
      // Broadcast command to all participants in the exam room
      io.to(`exam_${examId}`).emit('exam-command', {
        command,
        payload,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${user.uid}`);
    });
  });
};
