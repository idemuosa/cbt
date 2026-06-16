export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  examNumber?: string;
  role: 'student' | 'admin';
  createdAt: string;
}

export interface Candidate {
  id: string;
  examNumber: string;
  fullName: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  subject: string;
  durationMinutes: number;
  totalQuestions: number;
  createdBy: string;
  createdAt: string;
}

export interface Question {
  id: string;
  examId: string;
  text: string;
  type?: 'mcq' | 'essay';
  options: string[]; // only for mcq
  correctOptionIndex: number; // only for mcq
  rubric?: string; // only for essay
  explanation?: string;
}

export interface Attempt {
  id: string;
  userId: string;
  examId: string;
  score: number;
  totalPossible: number;
  answers: Record<string, any>;
  aiFeedback?: Record<string, { score: number, feedback: string }>;
  startedAt: any; // ServerTimestamp
  completedAt?: any; // ServerTimestamp
  status: 'in-progress' | 'completed';
}
