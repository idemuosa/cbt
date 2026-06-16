import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { registerSocketHandlers } from './socket/handlers';
import { authMiddleware } from './middleware/auth';
import prisma from './db';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.io Setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
});

// Firebase Admin Setup
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
} else {
  console.warn('FIREBASE_SERVICE_ACCOUNT not found in environment variables');
  // For local development, you might fallback to default credentials
  // admin.initializeApp();
}

// Database Connection Check
prisma.$connect()
  .then(() => console.log('PostgreSQL connected via Prisma'))
  .catch((err) => console.error('PostgreSQL connection failed:', err));

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Socket.io Middleware for Authentication
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (socket as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Socket authentication failed:', error);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Root Route
app.get('/', (req, res) => {
  res.send({ status: 'Exam CBT Real-time Backend is running' });
});

// Socket Handlers
registerSocketHandlers(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
