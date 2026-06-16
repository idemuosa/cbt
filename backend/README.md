# Exam CBT Real-time Backend

This service provides real-time proctoring and synchronization for the Exam CBT platform using Express and Socket.io.

## Features
- **Real-time Proctoring**: Tracks tab switching, focus/blur, and full-screen exits.
- **Admin Alerts**: Instant notifications to admins when students switch tabs.
- **Remote Synchronization**: Admins can broadcast commands (Start, Stop, Pause) to all students.
- **Secure Authentication**: Validates Firebase ID tokens for all socket connections.

## Prerequisites
- Node.js 20+
- Firebase Project (for Auth validation)
- Railway Account (for deployment)

## Local Setup

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up environment variables:
    - Create a `.env` file based on `.env.example`.
    - Provide your Firebase Service Account JSON as a string.
4.  Run the development server:
    ```bash
    npm run dev
    ```

## Frontend Integration

To connect your React application to this backend:

```typescript
import { io } from 'socket.io-client';

const socket = io('YOUR_BACKEND_URL', {
  auth: {
    token: await auth.currentUser?.getIdToken()
  }
});

// Reporting focus change
window.onblur = () => {
  socket.emit('proctor-event', {
    examId: 'math-101',
    type: 'tab-switch',
    details: { timestamp: Date.now() }
  });
};
```

## Deployment to Railway

This project is ready for deployment on **Railway** using the included `Dockerfile`.

1.  Push this code to a GitHub repository.
2.  On Railway, click **New Project** -> **Deploy from GitHub repo**.
3.  Select the repository and specify the `backend` directory if prompt.
4.  Add the required **Environment Variables** in the Railway dashboard:
    - `FIREBASE_SERVICE_ACCOUNT` (Your service account JSON)
    - `CLIENT_URL` (Your frontend URL)
    - `PORT` (Railway usually provides this automatically)
