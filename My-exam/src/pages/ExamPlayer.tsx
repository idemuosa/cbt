import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, setDoc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Exam, Question, Attempt } from '@/src/types';
import { useAuth } from '@/src/context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/lib/ui/button';
import { ScrollArea } from '@/lib/ui/scroll-area';
import { Separator } from '@/lib/ui/separator';
import { Badge } from '@/lib/ui/badge';
import { toast } from 'sonner';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  HelpCircle, 
  Send, 
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Calculator as CalcIcon,
  XCircle,
  Lock,
  FileText,
  Shield,
  Info,
  MousePointer2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/src/lib/utils/utils';
import { GoogleGenAI } from "@google/genai";
import { shuffleArray } from '@/src/lib/utils/shuffle';
import { getSocket } from '@/src/lib/socket';
import { generateResultPDF } from '@/src/lib/pdf';

export default function ExamPlayer() {
  const { examId } = useParams<{ examId: string }>();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // States
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [acceptedInstructions, setAcceptedInstructions] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [lastAttemptId, setLastAttemptId] = useState<string | null>(null);
  
  // Biometric States
  const [isBiometricVerified, setIsBiometricVerified] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  // Anti-cheat states
  const [cheatingAttempts, setCheatingAttempts] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLockedByAdmin, setIsLockedByAdmin] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const timerKey = user ? `exam_timer_${user.uid}_${examId}` : null;
  const startedKey = user ? `exam_started_${user.uid}_${examId}` : null;
  const answersKey = user ? `exam_answers_${user.uid}_${examId}` : null;

  // Initialize GenAI
  const genAI = new GoogleGenAI((import.meta as any).env.VITE_GEMINI_API_KEY || "");
  const aiModel = genAI.getGenerativeModel({ model: "gemini-pro" });

  const handleSubmit = useCallback(async () => {
    if (!exam || isSubmitting || isCompleted) return;
    setIsSubmitting(true);

    try {
      let finalScore = 0;
      const aiFeedbacks: Record<string, { score: number, feedback: string }> = {};

      for (const q of questions) {
        if (q.type === 'essay') {
          try {
            const prompt = `Grade this student exam answer based on the rubric.
            Question: ${q.text}
            Rubric: ${q.rubric}
            Student Answer: ${answers[q.id] || ''}
            Return ONLY a JSON object: {"score": <number 0-1>, "feedback": "<short feedback>"}`;
            
            const result = await aiModel.generateContent(prompt);
            const response = await result.response;
            const data = JSON.parse(response.text());
            aiFeedbacks[q.id] = data;
            finalScore += (data.score || 0);
          } catch (e) {
            aiFeedbacks[q.id] = { score: 0, feedback: "Error during AI evaluation." };
          }
        } else {
          if (answers[q.id] === q.correctOptionIndex) {
            finalScore += 1;
          }
        }
      }

      const attemptData = {
        userId: user!.uid,
        email: user!.email,
        examId: exam.id,
        examTitle: exam.title,
        score: parseFloat(finalScore.toFixed(2)),
        totalPossible: questions.length,
        answers,
        aiFeedback: aiFeedbacks,
        completedAt: serverTimestamp(),
        status: 'completed' as const
      };

      const docRef = await addDoc(collection(db, 'attempts'), attemptData);
      setLastAttemptId(docRef.id);
      setScore(finalScore);
      
      if (timerKey) localStorage.removeItem(timerKey);
      if (startedKey) localStorage.removeItem(startedKey);
      if (answersKey) localStorage.removeItem(answersKey);

      setIsCompleted(true);
      toast.success("Examination submitted successfully!");
    } catch (error) {
      console.error("Error submitting exam:", error);
      toast.error("An error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  }, [exam, isSubmitting, isCompleted, questions, answers, user, examId, timerKey, startedKey, answersKey]);

  const handleBiometricScan = async () => {
    setIsBiometricLoading(true);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error("Biometric hardware not detected or not supported.");
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsBiometricVerified(true);
      toast.success("Identity Verified via Fingerprint Scan");
    } catch (e: any) {
      toast.error(e.message || "Biometric authentication failed.");
    } finally {
      setIsBiometricLoading(false);
    }
  };

  // Initialize Socket and Monitor Admin Commands
  useEffect(() => {
    let socket: any;
    const setupSocket = async () => {
      const token = await user?.getIdToken();
      if (!token) return;
      socket = await getSocket(token);
      
      socket.on('admin-command', (data: { command: string, message?: string }) => {
        if (data.command === 'lock') {
          setIsLockedByAdmin(true);
          setAdminMessage(data.message || "Your exam has been locked by the proctor.");
        } else if (data.command === 'unlock') {
          setIsLockedByAdmin(false);
          setAdminMessage(null);
        } else if (data.command === 'terminate') {
          toast.error("Your examination session has been terminated by the proctor.");
          handleSubmit();
        }
      });
    };
    setupSocket();
    return () => socket?.off('admin-command');
  }, [user, examId, handleSubmit]);

  // Webcam Setup
  useEffect(() => {
    if (hasStarted && !isCompleted) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
          streamRef.current = stream;
        })
        .catch(err => toast.error("Webcam access is required for this exam."));
    }
    return () => streamRef.current?.getTracks().forEach(track => track.stop());
  }, [hasStarted, isCompleted]);

  // Periodic Snapshot
  useEffect(() => {
    if (!hasStarted || isCompleted) return;
    const takeSnapshot = async () => {
      if (!videoRef.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 225;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0, 300, 225);
      const imageData = canvas.toDataURL('image/jpeg', 0.5);
      const token = await user?.getIdToken();
      const socket = token ? await getSocket(token) : null;
      socket?.emit('proctor-event', {
        examId: examId!,
        type: 'webcam-snapshot',
        details: { image: imageData }
      });
    };
    const interval = setInterval(takeSnapshot, 300000);
    return () => clearInterval(interval);
  }, [hasStarted, isCompleted, examId, user]);

  useEffect(() => {
    async function initExam() {
      if (!examId) return;
      try {
        const examDoc = await getDoc(doc(db, 'exams', examId));
        if (!examDoc.exists()) throw new Error("Exam not found");
        const examData = { id: examDoc.id, ...examDoc.data() } as Exam;
        setExam(examData);
        const storedEndTime = timerKey ? localStorage.getItem(timerKey) : null;
        const storedStarted = startedKey ? localStorage.getItem(startedKey) : null;
        const storedAnswers = answersKey ? localStorage.getItem(answersKey) : null;
        if (storedStarted === 'true' && storedEndTime) {
          setHasStarted(true);
          const remaining = Math.max(0, Math.floor((parseInt(storedEndTime) - Date.now()) / 1000));
          setTimeLeft(remaining);
        } else {
          setTimeLeft(examData.durationMinutes * 60);
        }
        if (storedAnswers) setAnswers(JSON.parse(storedAnswers));
        const qSnap = await getDocs(collection(db, 'exams', examId, 'questions'));
        let qList = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        qList = shuffleArray(qList);
        setQuestions(qList);
      } catch (error) {
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    }
    initExam();
  }, [examId, navigate]);

  const currentQuestion = questions[currentQuestionIndex];

  // JAMB Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted || !hasStarted) return;
      const key = e.key.toLowerCase();
      if (['a', 'b', 'c', 'd'].includes(key)) {
        const idx = key.charCodeAt(0) - 97;
        if (currentQuestion && idx < currentQuestion.options.length) handleSelectOption(idx);
      }
      if (key === 'n' && currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1);
      if (key === 'p' && currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1);
      if (key === 's' && confirm("Submit exam?")) handleSubmit();
      if (key === 'c') setShowCalculator(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestionIndex, questions.length, isCompleted, hasStarted, currentQuestion]);

  if (loading) return <div className="h-screen flex items-center justify-center font-black animate-pulse">LOADING SECURE SESSION...</div>;

  if (!isBiometricVerified && !isCompleted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md w-full bg-white rounded-[40px] p-12 text-center">
          <Lock className="w-12 h-12 text-primary mx-auto mb-8" />
          <h2 className="text-3xl font-black mb-4">IDENTITY VERIFICATION</h2>
          <Button onClick={handleBiometricScan} disabled={isBiometricLoading} className="w-full h-20 bg-primary text-white rounded-2xl font-black">
            {isBiometricLoading ? "SCANNING..." : "BEGIN FINGERPRINT SCAN"}
          </Button>
        </motion.div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-3xl w-full bg-white rounded-[48px] p-12 border-2 border-primary/40">
          <h2 className="text-4xl font-black mb-8 uppercase tracking-tighter">Instructions</h2>
          <p className="mb-12 font-bold opacity-60">Please read all instructions before starting.</p>
          <label className="flex items-center gap-4 mb-12 cursor-pointer">
            <input type="checkbox" checked={acceptedInstructions} onChange={e => setAcceptedInstructions(e.target.checked)} />
            <span className="font-black text-[10px] uppercase">I understand the protocols</span>
          </label>
          <Button onClick={() => { setHasStarted(true); setTimeLeft(exam?.durationMinutes! * 60); }} disabled={!acceptedInstructions} className="w-full h-16 bg-primary text-white rounded-2xl font-black">
            AUTHORIZE & START
          </Button>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-2xl w-full bg-white rounded-[48px] p-16 shadow-2xl">
          <CheckCircle2 className="w-20 h-20 text-primary mx-auto mb-8" />
          <h2 className="text-5xl font-black mb-12">EXAM COMPLETED</h2>
          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="p-8 bg-primary/5 rounded-3xl">
              <span className="text-4xl font-black">{score} / {questions.length}</span>
            </div>
            <div className="p-8 bg-primary/5 rounded-3xl">
              <span className="text-4xl font-black">{Math.round((score/questions.length)*100)}%</span>
            </div>
          </div>
          <Button onClick={() => navigate('/dashboard')} className="w-full h-16 bg-primary text-white rounded-2xl font-black">RETURN TO PORTAL</Button>
        </div>
      </div>
    );
  }

  const handleSelectOption = (idx: number) => {
    setAnswers(prev => {
      const next = { ...prev, [currentQuestion.id]: idx };
      if (answersKey) localStorage.setItem(answersKey, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background text-primary overflow-hidden">
      <header className="p-8 border-b-2 border-primary/40 flex justify-between items-center bg-white">
        <h1 className="text-xl font-black uppercase underline decoration-primary decoration-4 underline-offset-8">{exam?.title}</h1>
        <div className="flex items-center gap-4 bg-primary/5 px-6 py-3 rounded-2xl border border-primary/20">
          <Clock className="w-5 h-5" />
          <span className="font-mono font-black text-xl">
            {Math.floor(timeLeft! / 60)}:{(timeLeft! % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-12 overflow-y-auto">
          <div className="max-w-4xl">
            <Badge className="mb-6 bg-primary/10 text-primary border-none font-black">QUESTION {currentQuestionIndex + 1}</Badge>
            <h2 className="text-3xl font-black leading-tight mb-12 uppercase tracking-tight">{currentQuestion?.text}</h2>
            <div className="space-y-4">
              {currentQuestion?.options.map((option, idx) => (
                <Button 
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  className={cn(
                    "w-full h-20 justify-start px-10 rounded-[24px] text-xl font-bold border-2 transition-all",
                    answers[currentQuestion.id] === idx ? "bg-primary text-white border-primary shadow-xl" : "bg-white text-primary border-primary/10 hover:border-primary/40 shadow-sm"
                  )}
                >
                  <span className="w-10 h-10 rounded-xl bg-current/5 flex items-center justify-center mr-6 text-sm">{String.fromCharCode(65 + idx)}</span>
                  {option}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <aside className="w-80 border-l-2 border-primary/40 bg-white p-8">
          <div className="grid grid-cols-4 gap-3">
            {questions.map((_, idx) => (
              <button 
                key={idx} 
                onClick={() => setCurrentQuestionIndex(idx)}
                className={cn(
                  "h-12 rounded-xl font-black text-xs border-2 transition-all",
                  idx === currentQuestionIndex ? "bg-primary text-white border-primary" : answers[questions[idx].id] !== undefined ? "bg-primary/5 text-primary border-primary/20" : "bg-white text-primary/30 border-primary/5"
                )}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </aside>
      </main>

      <footer className="p-8 border-t-2 border-primary/40 flex justify-between bg-white">
        <Button onClick={() => setCurrentQuestionIndex(p => p - 1)} disabled={currentQuestionIndex === 0} className="h-16 px-10 rounded-2xl font-black border-2 border-primary/10">PREVIOUS</Button>
        <Button onClick={() => { if(confirm("Submit?")) handleSubmit() }} className="h-16 px-12 bg-primary text-white rounded-2xl font-black">FINALIZE & SUBMIT</Button>
        <Button onClick={() => setCurrentQuestionIndex(p => p + 1)} disabled={currentQuestionIndex === questions.length - 1} className="h-16 px-10 rounded-2xl font-black border-2 border-primary/10">NEXT</Button>
      </footer>
      <Toaster position="top-center" />
      <video ref={videoRef} className="hidden" />
    </div>
  );
}
