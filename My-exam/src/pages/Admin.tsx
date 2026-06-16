import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy, updateDoc } from 'firebase/firestore';
import { Exam, Question, Attempt, Candidate } from '@/src/types';
import { Button } from '@/lib/ui/button';
import { Input } from '@/lib/ui/input';
import { Label } from '@/lib/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/lib/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/ui/tabs';
import { ScrollArea } from '@/lib/ui/scroll-area';
import { Badge } from '@/lib/ui/badge';
import { Separator } from '@/lib/ui/separator';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  BookOpen, 
  LayoutDashboard, 
  Settings, 
  PlusCircle, 
  ChevronRight,
  ArrowLeft,
  Users,
  Search,
  UserPlus,
  Library,
  Copy,
  Import,
  CheckCircle2,
  TrendingUp,
  BarChart2,
  PieChart as PieChartIcon,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/src/context/AuthContext';
import { getSocket } from '@/src/lib/socket';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { cn } from '@/src/lib/utils/utils';
import * as XLSX from 'xlsx';

export default function Admin() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Form states for new exam
  const [newExam, setNewExam] = useState({ title: '', subject: '', description: '', durationMinutes: 30 });
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  // Form states for new question
  const [newQuestion, setNewQuestion] = useState({ text: '', options: ['', '', '', ''], correctOptionIndex: 0 });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  
  // Form states for candidate
  const [newCandidate, setNewCandidate] = useState({ fullName: '', examNumber: '' });
  const [activeTab, setActiveTab] = useState<'exams' | 'candidates' | 'bank' | 'analytics' | 'active'>('exams');
  const [liveStudents, setLiveStudents] = useState<Record<string, any>>({});
  const { user } = useAuth();

  // Real-time Proctoring Listener
  useEffect(() => {
    let socket: any;
    const setupSocket = async () => {
      const token = await user?.getIdToken();
      if (!token) return;
      socket = await getSocket(token);

      socket.on('proctor-alert', (data: any) => {
        setLiveStudents(prev => {
          const studentSocketId = data.student.id;
          const currentStudent = prev[studentSocketId] || { ...data.student, violations: [], lastSeen: new Date().toISOString() };
          
          let updatedStudent = { ...currentStudent };
          
          if (data.type === 'webcam-snapshot') {
            updatedStudent.lastSnapshot = data.details.image;
          } else {
            updatedStudent.violations = [...(currentStudent.violations || []), { type: data.type, timestamp: data.timestamp, details: data.details }];
            toast.warning(`Security Alert: ${updatedStudent.email} - ${data.type}`);
          }
          
          updatedStudent.lastSeen = new Date().toISOString();
          return { ...prev, [studentSocketId]: updatedStudent };
        });
      });
    };
    setupSocket();
    return () => socket?.off('proctor-alert');
  }, [user]);

  const sendProctorCommand = async (socketId: string, command: string, message?: string) => {
    const token = await user?.getIdToken();
    const socket = token ? await getSocket(token) : null;
    socket?.emit('proctor-command', { targetSocketId: socketId, command, message });
    toast.success(`Sent ${command} command.`);
  };
  
  // Question Bank states
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState('EduTest Unified');
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [logoUrl, setLogoUrl] = useState('');
  const [analyticsQuestions, setAnalyticsQuestions] = useState<Record<string, Question[]>>({});
  const [selectedAnalyticsExam, setSelectedAnalyticsExam] = useState<string | null>(null);

  useEffect(() => {
    fetchExams();
    fetchCandidates();
    fetchQuestionBank();
    fetchAttempts();
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics' && attempts.length > 0) {
      const examIds = Array.from(new Set<string>(attempts.map(a => a.examId)));
      examIds.forEach(id => {
        if (!analyticsQuestions[id]) {
          fetchQuestionsForAnalytics(id);
        }
      });
    }
  }, [activeTab, attempts]);

  async function fetchQuestionsForAnalytics(examId: string) {
    try {
      const qSnap = await getDocs(collection(db, 'exams', examId, 'questions'));
      const qList = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      setAnalyticsQuestions(prev => ({ ...prev, [examId]: qList }));
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchAttempts() {
    try {
      const qSnap = await getDocs(collection(db, 'attempts'));
      setAttempts(qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attempt)));
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchQuestionBank() {
    try {
      const q = query(collection(db, 'question_bank'), orderBy('createdAt', 'desc'));
      const qSnap = await getDocs(q);
      setBankQuestions(qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
    } catch (e) {
      console.error(e);
    }
  }

  const addToBank = async (q: Partial<Question>) => {
    try {
      const bankData = {
        text: q.text,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation || '',
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'question_bank'), bankData);
      toast.success("Added to Question Bank!");
      fetchQuestionBank();
    } catch (e) {
      toast.error("Failed to add to bank");
    }
  };

  const importFromBank = async (bankQ: Question) => {
    if (!selectedExamId) return;
    try {
      const qData = {
        text: bankQ.text,
        options: bankQ.options,
        correctOptionIndex: bankQ.correctOptionIndex,
        explanation: bankQ.explanation || '',
        examId: selectedExamId
      };
      await addDoc(collection(db, 'exams', selectedExamId, 'questions'), qData);
      
      // Update exam question count
      await updateDoc(doc(db, 'exams', selectedExamId), {
        totalQuestions: questions.length + 1
      });
      
      toast.success("Imported question!");
      fetchQuestions(selectedExamId);
    } catch (e) {
      toast.error("Import failed");
    }
  };

  async function fetchCandidates() {
    try {
      const q = query(collection(db, 'candidates'), orderBy('createdAt', 'desc'));
      const qSnap = await getDocs(q);
      setCandidates(qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Candidate)));
    } catch (e) {
      toast.error("Failed to load candidates");
    }
  }

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCandidate.fullName || !newCandidate.examNumber) {
      toast.error("Full Name and Exam Number are required.");
      return;
    }
    try {
      await addDoc(collection(db, 'candidates'), {
        ...newCandidate,
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      toast.success("Candidate Registered!");
      setNewCandidate({ fullName: '', examNumber: '' });
      fetchCandidates();
    } catch (e) {
      toast.error("Registration failed.");
    }
  };

  const deleteCandidate = async (id: string) => {
    if (!confirm("Remove this candidate?")) return;
    try {
      await deleteDoc(doc(db, 'candidates', id));
      toast.success("Candidate removed.");
      fetchCandidates();
    } catch (e) {
      toast.error("Delete failed.");
    }
  };

  useEffect(() => {
    if (selectedExamId) {
      fetchQuestions(selectedExamId);
      const exam = exams.find(e => e.id === selectedExamId);
      if (exam) {
        setNewExam({ 
          title: exam.title, 
          subject: exam.subject, 
          description: exam.description || '', 
          durationMinutes: exam.durationMinutes 
        });
        setEditingExamId(exam.id);
      }
    } else {
      setQuestions([]);
      setNewExam({ title: '', subject: '', description: '', durationMinutes: 30 });
      setEditingExamId(null);
    }
  }, [selectedExamId, exams]);

  async function fetchExams() {
    setLoading(true);
    try {
      const q = query(collection(db, 'exams'), orderBy('createdAt', 'desc'));
      const qSnap = await getDocs(q);
      const examList = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      setExams(examList);
    } catch (e) {
      toast.error("Failed to load exams");
    } finally {
      setLoading(false);
    }
  }

  async function fetchQuestions(examId: string) {
    try {
      const qSnap = await getDocs(collection(db, 'exams', examId, 'questions'));
      setQuestions(qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
    } catch (e) {
      toast.error("Failed to load questions");
    }
  }

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedExamId) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        setLoading(true);
        let importedCount = 0;

        for (const row of data) {
          // Expected columns: question, a, b, c, d, correct (index 0-3)
          if (!row.question || !row.a) continue;

          const qData = {
            text: row.question,
            options: [row.a, row.b, row.c, row.d].filter(Boolean),
            correctOptionIndex: parseInt(row.correct) || 0,
            explanation: row.explanation || '',
            createdAt: serverTimestamp()
          };

          await addDoc(collection(db, 'exams', selectedExamId, 'questions'), qData);
          importedCount++;
        }

        // Update exam question count
        await updateDoc(doc(db, 'exams', selectedExamId), {
          totalQuestions: questions.length + importedCount
        });

        toast.success(`Successfully imported ${importedCount} questions!`);
        fetchQuestions(selectedExamId);
        setIsImportModalOpen(false);
      } catch (error) {
        console.error("Bulk import error:", error);
        toast.error("Format error: Ensure your Excel follows the template.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleCreateOrUpdateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExamId) {
        await updateDoc(doc(db, 'exams', editingExamId), {
          ...newExam,
          updatedAt: serverTimestamp(),
        });
        toast.success("Exam updated!");
      } else {
        await addDoc(collection(db, 'exams'), {
          ...newExam,
          totalQuestions: 0,
          createdAt: serverTimestamp(),
        });
        toast.success("Exam created!");
      }
      setNewExam({ title: '', subject: '', description: '', durationMinutes: 30 });
      setEditingExamId(null);
      setSelectedExamId(null);
      fetchExams();
    } catch (e) {
      toast.error("Error saving exam");
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm("Are you sure? All questions will be lost.")) return;
    try {
      await deleteDoc(doc(db, 'exams', id));
      toast.success("Exam deleted");
      if (selectedExamId === id) setSelectedExamId(null);
      fetchExams();
    } catch (e) {
      toast.error("Error deleting exam");
    }
  };

  const handleAddOrUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId) return;
    try {
      if (editingQuestionId) {
        await updateDoc(doc(db, 'exams', selectedExamId, 'questions', editingQuestionId), newQuestion);
        toast.success("Question updated!");
      } else {
        await addDoc(collection(db, 'exams', selectedExamId, 'questions'), newQuestion);
        // Update exam question count
        await updateDoc(doc(db, 'exams', selectedExamId), {
          totalQuestions: questions.length + 1
        });
        toast.success("Question added!");
      }
      setNewQuestion({ text: '', options: ['', '', '', ''], correctOptionIndex: 0 });
      setEditingQuestionId(null);
      fetchQuestions(selectedExamId);
    } catch (e) {
      toast.error("Error saving question");
    }
  };

  const startEditQuestion = (q: Question) => {
    setNewQuestion({
      text: q.text,
      options: [...q.options],
      correctOptionIndex: q.correctOptionIndex
    });
    setEditingQuestionId(q.id);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-primary bg-background">
      <header className="bg-white border-b-2 border-primary/40 p-6 flex justify-between items-center shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-full text-primary hover:bg-primary/5">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-primary">Admin Console</h1>
        </div>
        <div className="flex gap-2 bg-primary/5 p-1 rounded-2xl border-2 border-primary/40 shadow-sm">
          <Button 
            variant={activeTab === 'exams' ? 'default' : 'ghost'} 
            onClick={() => setActiveTab('exams')}
            className={cn("rounded-xl px-4 font-bold uppercase tracking-widest text-[10px] border-none", activeTab === 'exams' ? "bg-primary text-white" : "text-primary/40 hover:text-primary")}
          >
            <BookOpen className="w-3 h-3 mr-2" />
            Exams
          </Button>
          <Button 
            variant={activeTab === 'bank' ? 'default' : 'ghost'} 
            onClick={() => setActiveTab('bank')}
            className={cn("rounded-xl px-4 font-bold uppercase tracking-widest text-[10px] border-none", activeTab === 'bank' ? "bg-primary text-white" : "text-primary/40 hover:text-primary")}
          >
            <Library className="w-3 h-3 mr-2" />
            Bank
          </Button>
          <Button 
            variant={activeTab === 'candidates' ? 'default' : 'ghost'} 
            onClick={() => setActiveTab('candidates')}
            className={cn("rounded-xl px-4 font-bold uppercase tracking-widest text-[10px] border-none", activeTab === 'candidates' ? "bg-primary text-white" : "text-primary/40 hover:text-primary")}
          >
            <Users className="w-3 h-3 mr-2" />
            Candidates
          </Button>
          <Button 
            variant={activeTab === 'active' ? 'default' : 'ghost'} 
            onClick={() => setActiveTab('active')}
            className={cn("rounded-xl px-4 font-bold uppercase tracking-widest text-[10px] border-none", activeTab === 'active' ? "bg-primary text-white" : "text-primary/40 hover:text-primary")}
          >
            <AlertCircle className="w-3 h-3 mr-2" />
            Active Monitoring
            {Object.keys(liveStudents).length > 0 && (
              <Badge className="ml-2 bg-white/20 text-white border-none text-[8px]">{Object.keys(liveStudents).length}</Badge>
            )}
          </Button>
          <Button 
            variant={activeTab === 'analytics' ? 'default' : 'ghost'} 
            onClick={() => setActiveTab('analytics')}
            className={cn("rounded-xl px-4 font-bold uppercase tracking-widest text-[10px] border-none", activeTab === 'analytics' ? "bg-primary text-white" : "text-primary/40 hover:text-primary")}
          >
            <BarChart2 className="w-3 h-3 mr-2" />
            Analytics
          </Button>
          <Button 
            variant={activeTab === 'settings' ? 'default' : 'ghost'} 
            onClick={() => setActiveTab('settings')}
            className={cn("rounded-xl px-4 font-bold uppercase tracking-widest text-[10px] border-none", activeTab === 'settings' ? "bg-primary text-white" : "text-primary/40 hover:text-primary")}
          >
            <Settings className="w-3 h-3 mr-2" />
            Identity & Settings
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {activeTab === 'exams' ? (
          <>
            {/* Left: Exams List */}
            <aside className="w-full md:w-96 bg-white border-r-2 border-primary/40 flex flex-col shrink-0 overflow-hidden">
          <div className="p-6 border-b-2 border-primary/40 bg-primary/5">
            <h2 className="text-[10px] font-black text-primary/40 uppercase tracking-widest mb-4">
              {editingExamId ? 'Edit Examination' : 'Exam Collections'}
            </h2>
            <form onSubmit={handleCreateOrUpdateExam} className="space-y-3">
              <Input 
                placeholder="Title (e.g. JAMB Physics)" 
                value={newExam.title} 
                onChange={e => setNewExam({...newExam, title: e.target.value})}
                required
                className="bg-white border-2 border-primary/30 rounded-xl h-11 text-xs font-bold text-primary placeholder:text-primary/30"
              />
              <Input 
                placeholder="Subject" 
                value={newExam.subject} 
                onChange={e => setNewExam({...newExam, subject: e.target.value})}
                required
                className="bg-white border-2 border-primary/30 rounded-xl h-11 text-xs font-bold text-primary placeholder:text-primary/30"
              />
              <Input 
                placeholder="Brief Description" 
                value={newExam.description} 
                onChange={e => setNewExam({...newExam, description: e.target.value})}
                className="bg-white border-2 border-primary/30 rounded-xl h-11 text-xs font-bold text-primary placeholder:text-primary/30"
              />
              <Input 
                type="number"
                placeholder="Duration (min)" 
                value={newExam.durationMinutes} 
                onChange={e => setNewExam({...newExam, durationMinutes: parseInt(e.target.value)})}
                required
                className="bg-white border-2 border-primary/30 rounded-xl h-11 text-xs font-bold text-primary placeholder:text-primary/30"
              />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1 h-11 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2 hover:bg-primary/90 border-none shadow-lg shadow-primary/20">
                  <PlusCircle className="w-3.5 h-3.5" />
                  {editingExamId ? 'Update Exam' : 'Add New Exam'}
                </Button>
                {editingExamId && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => { setSelectedExamId(null); setEditingExamId(null); setNewExam({ title: '', subject: '', description: '', durationMinutes: 30 }); }}
                    className="h-11 rounded-xl border-2 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>

          <ScrollArea className="flex-1 bg-white">
            <div className="p-3">
              {exams.map(exam => (
                <button
                  key={exam.id}
                  onClick={() => setSelectedExamId(exam.id)}
                  className={`w-full text-left p-4 rounded-2xl mb-2 transition-all group border-2 ${
                    selectedExamId === exam.id ? 'bg-primary text-white border-primary border-transparent' : 'bg-primary/5 hover:bg-primary/10 text-primary/60 border-primary/10'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm truncate ${selectedExamId === exam.id ? 'text-white' : 'text-primary'}`}>{exam.title}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${selectedExamId === exam.id ? 'text-white/60' : 'text-primary/40'}`}>
                        {exam.subject} &bull; {exam.durationMinutes}M
                      </p>
                    </div>
                    {selectedExamId === exam.id ? (
                      <Trash2 
                        className="w-4 h-4 text-white hover:opacity-70 cursor-pointer" 
                        onClick={(e) => { e.stopPropagation(); handleDeleteExam(exam.id); }}
                      />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-primary/20 group-hover:text-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Right: Questions Manager */}
        <section className="flex-1 overflow-y-auto p-8 bg-background">
          {!selectedExamId ? (
            <div className="h-full flex items-center justify-center text-center">
              <div className="max-w-xs space-y-4">
                <div className="w-16 h-16 bg-primary/5 border-2 border-primary/40 rounded-2xl flex items-center justify-center mx-auto">
                  <BookOpen className="w-8 h-8 text-primary/20" />
                </div>
                <h3 className="text-xl font-black text-primary uppercase tracking-tighter">No Exam Selected</h3>
                <p className="text-primary/40 text-sm font-medium">Select an exam from the left panel to manage its questions and settings.</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-black text-primary uppercase tracking-tighter leading-tight mb-2">Item <br /> Composer</h2>
                  <p className="text-primary/40 font-bold uppercase tracking-widest text-[10px]">Manage assessment content for {exams.find(e => e.id === selectedExamId)?.title}</p>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsImportModalOpen(true)}
                    className="h-10 rounded-full border-2 border-primary/20 text-primary font-black uppercase text-[10px] px-6 gap-2 hover:bg-primary/5"
                  >
                    <Import className="w-3.5 h-3.5" />
                    Import from Bank
                  </Button>
                  <Badge variant="outline" className="h-10 rounded-full border-2 border-primary/40 text-primary font-black uppercase text-[10px] px-4 flex items-center">{questions.length} Items</Badge>
                </div>
              </div>

              {/* Add Question Form */}
              <Card className="rounded-[32px] border-2 border-primary/40 overflow-hidden bg-white shadow-xl shadow-primary/5">
                <CardHeader className="bg-primary p-8 text-white">
                  <CardTitle className="text-lg uppercase tracking-widest font-black flex items-center gap-3">
                    <PlusCircle className={cn("w-5 h-5", editingQuestionId && "rotate-45")} />
                    {editingQuestionId ? 'Update Item' : 'Create New Item'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Question Body</Label>
                    <textarea 
                      className="w-full flex min-h-[100px] rounded-2xl border-2 border-primary/10 bg-primary/5 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all text-primary placeholder:text-primary/20"
                      placeholder="Type the question content here..."
                      value={newQuestion.text}
                      onChange={e => setNewQuestion({...newQuestion, text: e.target.value})}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {newQuestion.options.map((opt, i) => (
                      <div key={i} className="space-y-2">
                        <Label className="text-[10px] font-black text-primary/40 uppercase tracking-widest flex justify-between">
                          Option {String.fromCharCode(65 + i)}
                          {newQuestion.correctOptionIndex === i && <span className="text-primary">Correct Answer</span>}
                        </Label>
                        <div className="flex gap-2">
                          <Input 
                            value={opt} 
                            onChange={e => {
                              const opts = [...newQuestion.options];
                              opts[i] = e.target.value;
                              setNewQuestion({...newQuestion, options: opts});
                            }}
                            className="rounded-xl bg-primary/5 border-2 border-primary/10 h-12 text-primary font-bold placeholder:text-primary/20"
                            placeholder={`Enter option ${String.fromCharCode(65 + i)}`}
                            required
                          />
                          <Button 
                            type="button"
                            variant={newQuestion.correctOptionIndex === i ? 'default' : 'outline'}
                            onClick={() => setNewQuestion({...newQuestion, correctOptionIndex: i})}
                            className={cn("rounded-xl h-12 shrink-0 px-4 border-2 shadow-md transition-all", newQuestion.correctOptionIndex === i ? "bg-primary text-white border-primary" : "text-primary border-primary/20 hover:bg-primary/5")}
                          >
                            {newQuestion.correctOptionIndex === i ? '✓' : ''}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-6">
                    <Button onClick={handleAddOrUpdateQuestion} className="flex-1 h-14 bg-primary text-white hover:bg-primary/90 rounded-[20px] font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 transition-all border-none">
                      {editingQuestionId ? 'Update Item' : 'Store Question'}
                    </Button>
                    {!editingQuestionId && (
                      <Button 
                        type="button"
                        onClick={() => addToBank(newQuestion)}
                        variant="outline"
                        className="h-14 rounded-[20px] px-8 font-black uppercase text-[10px] tracking-widest border-2 border-primary/20 text-primary hover:bg-primary/5"
                      >
                        <Library className="w-4 h-4 mr-2" />
                        To Bank
                      </Button>
                    )}
                    {editingQuestionId && (
                      <Button 
                        variant="outline" 
                        onClick={() => { setEditingQuestionId(null); setNewQuestion({ text: '', options: ['', '', '', ''], correctOptionIndex: 0 }); }}
                        className="h-14 rounded-[20px] px-8 font-black uppercase text-[10px] tracking-widest border-2 border-primary/20 text-primary hover:bg-primary/5"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Current Questions List */}
              <div className="space-y-6">
                <h3 className="text-sm font-black text-primary/40 uppercase tracking-[0.2em] pl-4 border-l-4 border-primary">Live Preview Matrix</h3>
                <div className="grid grid-cols-1 gap-4">
                  {questions.map((q, idx) => (
                    <Card key={q.id} className="rounded-3xl border-2 border-primary/10 bg-white hover:border-primary/40 transition-all cursor-pointer overflow-hidden shadow-lg shadow-primary/5" onClick={() => startEditQuestion(q)}>
                      <CardContent className="p-8">
                        <div className="flex justify-between gap-8">
                          <div className="flex-1 text-primary">
                            <div className="flex items-center gap-4 mb-4">
                              <Badge className="bg-primary/5 text-primary font-black border-2 border-primary/10 px-3">ITEM {idx + 1}</Badge>
                              {editingQuestionId === q.id && <Badge className="bg-primary text-white border-none px-3">Editing</Badge>}
                            </div>
                            <p className="font-bold text-lg mb-6 leading-relaxed tracking-tight">{q.text}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {q.options.map((opt, i) => (
                                <div key={i} className={`p-4 rounded-xl text-xs font-bold border-2 transition-all ${q.correctOptionIndex === i ? 'bg-primary text-white border-primary shadow-md' : 'bg-primary/5 text-primary/60 border-primary/5'}`}>
                                  <span className="opacity-40 mr-2">{String.fromCharCode(65 + i)}</span> {opt}
                                </div>
                              ))}
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={async (e) => {
                              e.stopPropagation();
                              if(!confirm("Delete question?")) return;
                              await deleteDoc(doc(db, 'exams', selectedExamId, 'questions', q.id));
                              // Update exam question count
                              await updateDoc(doc(db, 'exams', selectedExamId), {
                                totalQuestions: questions.length - 1
                              });
                              fetchQuestions(selectedExamId);
                            }}
                            className="rounded-2xl text-primary/10 hover:text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
          </>
        ) : activeTab === 'analytics' ? (
          <div className="flex-1 overflow-y-auto p-12 font-sans bg-background">
            <div className="max-w-6xl mx-auto space-y-12">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-5xl font-black text-primary uppercase tracking-tighter leading-tight mb-2">Performance <br /> Intelligence</h2>
                  <p className="text-primary/40 font-bold uppercase tracking-widest text-[10px]">Real-time analytics across all examination cycles</p>
                </div>
                <div className="flex gap-4">
                   <div className="flex flex-col items-end">
                     <span className="text-2xl font-black text-primary">{attempts.length}</span>
                     <span className="text-[9px] font-black text-primary/30 uppercase tracking-widest leading-none">Total Sessions</span>
                     <Button 
                       variant="ghost" 
                       size="sm" 
                       onClick={() => {
                         const ws = XLSX.utils.json_to_sheet(attempts);
                         const wb = XLSX.utils.book_new();
                         XLSX.utils.book_append_sheet(wb, ws, "Results");
                         XLSX.writeFile(wb, "Exam_Results_Export.xlsx");
                       }}
                       className="mt-2 text-[8px] font-black uppercase text-primary/40 hover:text-primary p-0 h-auto"
                     >
                       Download Master XLS
                     </Button>
                   </div>
                </div>
              </div>

              {/* Top Level Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="rounded-[40px] border-2 border-primary/40 bg-white p-10 shadow-2xl shadow-primary/5">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-primary/5 rounded-2xl flex items-center justify-center border-2 border-primary/10">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-primary uppercase tracking-widest leading-none mb-1">Pass Ratio Distribution</h4>
                      <p className="text-xs font-bold text-primary/30">Aggregate student success rate across subjects</p>
                    </div>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(() => {
                        return exams.map(e => {
                          const examAt = attempts.filter(a => a.examId === e.id);
                          if (examAt.length === 0) return null;
                          const passCount = examAt.filter(a => a.score >= (a.totalPossible / 2)).length;
                          return {
                            name: e.subject,
                            rate: Math.round((passCount / examAt.length) * 100)
                          };
                        }).filter(Boolean);
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--primary) / 0.1)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'oklch(var(--primary) / 0.4)', fontSize: 10, fontWeight: 900}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: 'oklch(var(--primary) / 0.4)', fontSize: 10, fontWeight: 900}} dx={-10} unit="%" />
                        <Tooltip 
                          contentStyle={{borderRadius: '16px', border: '2px solid oklch(var(--primary) / 0.1)', background: 'white'}}
                          itemStyle={{fontSize: '10px', fontWeight: 900, textTransform: 'uppercase'}}
                        />
                        <Bar 
                          dataKey="rate" 
                          fill="oklch(var(--primary))" 
                          radius={[8, 8, 8, 8]} 
                          barSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="rounded-[40px] border-2 border-primary/40 bg-white p-10 shadow-2xl shadow-primary/5">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-primary/5 rounded-2xl flex items-center justify-center border-2 border-primary/10">
                      <BarChart2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-primary uppercase tracking-widest leading-none mb-1">Average Proficiency</h4>
                      <p className="text-xs font-bold text-primary/30">Mean scores normalized across varied subjects</p>
                    </div>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={(() => {
                        return exams.map(e => {
                          const examAt = attempts.filter(a => a.examId === e.id);
                          if (examAt.length === 0) return null;
                          const avgScore = examAt.reduce((acc, curr) => acc + curr.score, 0) / examAt.length;
                          return {
                            name: e.subject,
                            score: parseFloat(avgScore.toFixed(1))
                          };
                        }).filter(Boolean);
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--primary) / 0.1)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'oklch(var(--primary) / 0.4)', fontSize: 10, fontWeight: 900}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: 'oklch(var(--primary) / 0.4)', fontSize: 10, fontWeight: 900}} dx={-10} />
                        <Tooltip 
                          contentStyle={{borderRadius: '16px', border: '2px solid oklch(var(--primary) / 0.1)', background: 'white'}}
                        />
                        <Area type="monotone" dataKey="score" stroke="oklch(var(--primary))" fill="oklch(var(--primary) / 0.1)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {/* Subject Drilldown */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                <div className="md:col-span-1 space-y-4">
                  <h3 className="text-sm font-black text-primary/40 uppercase tracking-[0.2em] pl-4 border-l-4 border-primary">Subject Inspector</h3>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                       {exams.map(exam => {
                          const attemptsCount = attempts.filter(a => a.examId === exam.id).length;
                          return (
                            <button
                              key={exam.id}
                              onClick={() => setSelectedAnalyticsExam(exam.id)}
                              className={cn(
                                "w-full text-left p-6 rounded-3xl transition-all border-2",
                                selectedAnalyticsExam === exam.id ? "bg-primary border-primary shadow-xl" : "bg-white border-primary/10 hover:border-primary/40"
                              )}
                            >
                              <p className={cn("font-black text-xs uppercase tracking-tight mb-2", selectedAnalyticsExam === exam.id ? "text-white" : "text-primary")}>{exam.title}</p>
                              <div className="flex justify-between items-center">
                                <Badge className={cn("px-2 py-0.5 text-[8px] font-black uppercase rounded-lg", selectedAnalyticsExam === exam.id ? "bg-white text-primary" : "bg-primary/5 text-primary/40")}>{exam.subject}</Badge>
                                <span className={cn("text-[9px] font-black", selectedAnalyticsExam === exam.id ? "text-white/40" : "text-primary/20")}>{attemptsCount} SESSIONS</span>
                              </div>
                            </button>
                          );
                       })}
                    </div>
                  </ScrollArea>
                </div>

                <div className="md:col-span-3">
                  {!selectedAnalyticsExam ? (
                    <div className="h-full bg-primary/[0.02] border-2 border-dashed border-primary/20 rounded-[40px] flex flex-col items-center justify-center p-12 text-center">
                       <PieChartIcon className="w-12 h-12 text-primary/10 mb-6" />
                       <h4 className="text-xl font-black text-primary uppercase tracking-tighter mb-2">Detailed Selection Pending</h4>
                       <p className="max-w-xs text-xs font-bold text-primary/30 uppercase leading-relaxed">Select a subject from the inspector matrix to generate granular failure analysis and item-level metrics.</p>
                    </div>
                  ) : (
                    <motion.div 
                      key={selectedAnalyticsExam}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-10"
                    >
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                          {(() => {
                            const exAt = attempts.filter(a => a.examId === selectedAnalyticsExam);
                            const avg = exAt.length > 0 ? exAt.reduce((acc, curr) => acc + curr.score, 0) / exAt.length : 0;
                            const passCount = exAt.filter(a => a.score >= (a.totalPossible / 2)).length;
                            return (
                              <>
                                <div className="p-8 bg-white border-2 border-primary/10 rounded-[32px] shadow-sm">
                                   <p className="text-[9px] font-black text-primary/30 uppercase tracking-[0.2em] mb-4">Mean Accuracy</p>
                                   <h5 className="text-4xl font-black text-primary leading-none uppercase tracking-tighter">{avg.toFixed(1)} <span className="text-sm text-primary/20">pts</span></h5>
                                </div>
                                <div className="p-8 bg-white border-2 border-primary/10 rounded-[32px] shadow-sm">
                                   <p className="text-[9px] font-black text-primary/30 uppercase tracking-[0.2em] mb-4">Success Ratio</p>
                                   <h5 className="text-4xl font-black text-primary leading-none uppercase tracking-tighter">{exAt.length > 0 ? Math.round((passCount/exAt.length)*100) : 0} <span className="text-sm text-primary/20">%</span></h5>
                                </div>
                                <div className="p-8 bg-white border-2 border-primary/10 rounded-[32px] shadow-sm">
                                   <p className="text-[9px] font-black text-primary/30 uppercase tracking-[0.2em] mb-4">Peak Attainment</p>
                                   <h5 className="text-4xl font-black text-primary leading-none uppercase tracking-tighter">{exAt.length > 0 ? Math.max(...exAt.map(a => a.score)) : 0} <span className="text-sm text-primary/20">pts</span></h5>
                                </div>
                              </>
                            );
                          })()}
                       </div>

                       <div>
                          <h3 className="text-sm font-black text-primary/40 uppercase tracking-[0.2em] pl-4 border-l-4 border-primary mb-8">Item Failure Matrix (Top Incorrects)</h3>
                          <div className="grid grid-cols-1 gap-4">
                            {(() => {
                              const qs = analyticsQuestions[selectedAnalyticsExam] || [];
                              const exAt = attempts.filter(a => a.examId === selectedAnalyticsExam);
                              
                              const failureMetrics = qs.map(q => {
                                const incorrectAttempts = exAt.filter(a => a.answers[q.id] !== undefined && a.answers[q.id] !== q.correctOptionIndex);
                                
                                // Count which wrong option was picked most
                                const wrongOptionCounts: Record<number, number> = {};
                                incorrectAttempts.forEach(a => {
                                  const ans = a.answers[q.id];
                                  wrongOptionCounts[ans] = (wrongOptionCounts[ans] || 0) + 1;
                                });
                                
                                const topWrongOption = Object.entries(wrongOptionCounts).sort((a,b) => b[1] - a[1])[0];

                                return {
                                  question: q,
                                  failureCount: incorrectAttempts.length,
                                  totalResponses: exAt.filter(a => a.answers[q.id] !== undefined).length,
                                  topWrongOption: topWrongOption ? parseInt(topWrongOption[0]) : null
                                };
                              })
                              .sort((a,b) => b.failureCount - a.failureCount)
                              .slice(0, 5); // Top 5 most missed

                              return failureMetrics.map((f, i) => (
                                <Card key={f.question.id} className="rounded-3xl border-2 border-primary/10 bg-white p-8">
                                   <div className="flex justify-between items-start mb-6">
                                      <div className="flex gap-4 items-center">
                                         <Badge className="bg-red-50 text-red-600 border-red-100 font-black px-3 uppercase text-[9px] tracking-widest">CRITICAL LOSS POINT</Badge>
                                         <span className="text-xs font-black text-primary/20 uppercase tracking-widest">FAILURE RANK {i+1}</span>
                                      </div>
                                      <div className="text-right">
                                         <p className="text-xl font-black text-red-600 leading-none mb-1">{f.totalResponses > 0 ? Math.round((f.failureCount/f.totalResponses)*100) : 0}%</p>
                                         <p className="text-[8px] font-black text-primary/30 uppercase tracking-[0.2em]">INCORRECT RATE</p>
                                      </div>
                                   </div>
                                   <p className="font-bold text-sm text-primary mb-6 leading-relaxed tracking-tight">{f.question.text}</p>
                                   
                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                         <p className="text-[8px] font-black text-primary/40 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                            <CheckCircle2 className="w-2 h-2 text-primary" />
                                            Expected Resolution
                                         </p>
                                         <p className="text-xs font-black text-primary uppercase">{f.question.options[f.question.correctOptionIndex]}</p>
                                      </div>
                                      {f.topWrongOption !== null && (
                                        <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100">
                                           <p className="text-[8px] font-black text-red-600/40 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                              <AlertCircle className="w-2 h-2 text-red-600" />
                                              Common Misconception
                                           </p>
                                           <p className="text-xs font-black text-red-600 uppercase">{f.question.options[f.topWrongOption]}</p>
                                        </div>
                                      )}
                                   </div>
                                </Card>
                              ));
                            })()}
                          </div>
                       </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'candidates' ? (
          <div className="flex-1 overflow-y-auto p-12 font-sans bg-background">
            <div className="max-w-4xl mx-auto space-y-12">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-5xl font-black text-primary uppercase tracking-tighter leading-tight mb-2">Student <br /> Directory</h2>
                  <p className="text-primary/40 font-bold uppercase tracking-widest text-[10px]">Onboard and monitor examinees for live subjects</p>
                </div>
                <Badge variant="outline" className="h-10 rounded-full border-2 border-primary/40 text-primary font-black px-6 uppercase text-[10px] tracking-widest leading-none flex items-center">{candidates.length} Registered</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {/* Registration Form */}
                <Card className="rounded-[40px] border-2 border-primary/40 bg-white shadow-2xl shadow-primary/5 overflow-hidden h-fit">
                  <CardHeader className="bg-primary text-white p-10">
                    <CardTitle className="text-lg uppercase tracking-widest font-black flex items-center gap-4">
                      <UserPlus className="w-6 h-6" />
                      Add Entry
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-10">
                    <form onSubmit={handleCreateCandidate} className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Candidate Signature</Label>
                        <Input 
                          placeholder="Legal Full Name"
                          value={newCandidate.fullName}
                          onChange={e => setNewCandidate({...newCandidate, fullName: e.target.value})}
                          className="h-14 rounded-2xl bg-primary/5 border-2 border-primary/10 text-primary font-bold placeholder:text-primary/20 px-6"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Exam Serial Identity</Label>
                        <Input 
                          placeholder="ET-1000-XYZ"
                          value={newCandidate.examNumber}
                          onChange={e => setNewCandidate({...newCandidate, examNumber: e.target.value})}
                          className="h-14 rounded-2xl bg-primary/5 border-2 border-primary/10 font-black uppercase tracking-widest text-primary placeholder:text-primary/20 px-6"
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full h-14 bg-primary text-white hover:bg-primary/90 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 border-none transition-all mt-4">
                        Lock Record
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Candidate Table */}
                <div className="md:col-span-2 space-y-8">
                  <div className="flex items-center gap-x-6 bg-white p-6 rounded-[32px] border-2 border-primary/40 shadow-xl shadow-primary/5">
                    <Search className="w-6 h-6 text-primary/20" />
                    <input 
                      type="text" 
                      placeholder="Search registry by name or index..."
                      className="bg-transparent border-none outline-none text-sm font-bold w-full text-primary placeholder:text-primary/20"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {candidates.map(candidate => (
                      <div key={candidate.id} className="group flex items-center justify-between p-6 bg-white border-2 border-primary/10 rounded-3xl hover:border-primary/40 transition-all shadow-sm hover:shadow-xl hover:shadow-primary/5">
                        <div className="flex items-center gap-5 text-primary">
                          <div className="w-14 h-14 bg-primary/5 rounded-2xl border-2 border-primary/10 flex items-center justify-center font-black text-primary/30 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all uppercase text-xl">
                            {candidate.fullName.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-black text-lg group-hover:text-primary transition-colors leading-tight uppercase tracking-tight">{candidate.fullName}</h4>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/30">{candidate.examNumber}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge className="bg-primary/5 text-primary border-2 border-primary/10 font-black uppercase tracking-widest text-[8px] px-3 py-1">{candidate.status}</Badge>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => deleteCandidate(candidate.id)}
                            className="h-10 w-10 text-primary/10 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {candidates.length === 0 && (
                      <div className="py-20 text-center bg-primary/5 rounded-[40px] border-2 border-dashed border-primary/20">
                        <Users className="w-12 h-12 text-primary/10 mx-auto mb-4" />
                        <p className="text-primary/20 font-black uppercase tracking-widest text-[10px]">No Subject Records Found</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-12 font-sans bg-background">
            <div className="max-w-4xl mx-auto space-y-12">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-5xl font-black text-primary uppercase tracking-tighter leading-tight mb-2">Question <br /> Library</h2>
                  <p className="text-primary/40 font-bold uppercase tracking-widest text-[10px]">Global repository of reusable assessment items</p>
                </div>
                <Badge variant="outline" className="h-10 rounded-full border-2 border-primary/40 text-primary font-black px-6 uppercase text-[10px] tracking-widest leading-none flex items-center">{bankQuestions.length} Library Items</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {/* Bank Entry Form */}
                <Card className="rounded-[40px] border-2 border-primary/40 bg-white shadow-2xl shadow-primary/5 overflow-hidden h-fit">
                  <CardHeader className="bg-primary text-white p-10">
                    <CardTitle className="text-lg uppercase tracking-widest font-black flex items-center gap-4">
                      <PlusCircle className="w-6 h-6" />
                      Add to Bank
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-10 space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Question Text</Label>
                        <textarea 
                          className="w-full flex min-h-[100px] rounded-2xl border-2 border-primary/10 bg-primary/5 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all text-primary placeholder:text-primary/20"
                          placeholder="Global question content..."
                          value={newQuestion.text}
                          onChange={e => setNewQuestion({...newQuestion, text: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Options Matrix</Label>
                        {newQuestion.options.map((opt, i) => (
                          <div key={i} className="flex gap-2">
                            <Input 
                              value={opt} 
                              onChange={e => {
                                const opts = [...newQuestion.options];
                                opts[i] = e.target.value;
                                setNewQuestion({...newQuestion, options: opts});
                              }}
                              className="rounded-xl bg-primary/5 border-2 border-primary/10 h-11 text-xs font-bold text-primary placeholder:text-primary/20"
                              placeholder={`Option ${String.fromCharCode(65 + i)}`}
                            />
                            <Button 
                              type="button"
                              onClick={() => setNewQuestion({...newQuestion, correctOptionIndex: i})}
                              className={cn("w-11 h-11 rounded-xl shrink-0 p-0 border-2", newQuestion.correctOptionIndex === i ? "bg-primary text-white border-primary" : "text-primary border-primary/10 hover:bg-primary/5")}
                            >
                              {newQuestion.correctOptionIndex === i ? '✓' : ''}
                            </Button>
                          </div>
                        ))}
                      </div>

                      <Button 
                        onClick={() => addToBank(newQuestion)}
                        className="w-full h-14 bg-primary text-white hover:bg-primary/90 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 border-none transition-all mt-4"
                      >
                        Establish Item
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Bank List */}
                <div className="md:col-span-2 space-y-8">
                  <div className="flex items-center gap-x-6 bg-white p-6 rounded-[32px] border-2 border-primary/40 shadow-xl shadow-primary/5">
                    <Search className="w-6 h-6 text-primary/20" />
                    <input 
                      type="text" 
                      placeholder="Search library by content or tags..."
                      className="bg-transparent border-none outline-none text-sm font-bold w-full text-primary placeholder:text-primary/20"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6">
                    {bankQuestions.map((q, idx) => (
                      <Card key={q.id} className="rounded-3xl border-2 border-primary/10 bg-white hover:border-primary/40 shadow-sm transition-all overflow-hidden">
                        <CardContent className="p-8">
                          <div className="flex justify-between gap-8">
                            <div className="flex-1 text-primary">
                              <div className="flex items-center gap-4 mb-4">
                                <Badge className="bg-primary/5 text-primary font-black border-2 border-primary/10 px-3 uppercase text-[8px] tracking-widest">BANK_ITEM_{idx + 1}</Badge>
                              </div>
                              <p className="font-bold text-lg mb-6 leading-relaxed tracking-tight">{q.text}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {q.options.map((opt, i) => (
                                  <div key={i} className={`p-4 rounded-xl text-xs font-bold border-2 transition-all ${q.correctOptionIndex === i ? 'bg-primary text-white border-primary shadow-md' : 'bg-primary/5 text-primary/60 border-primary/5'}`}>
                                    <span className="opacity-40 mr-2">{String.fromCharCode(65 + i)}</span> {opt}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={async (e) => {
                                e.stopPropagation();
                                if(!confirm("Delete from bank?")) return;
                                await deleteDoc(doc(db, 'question_bank', q.id));
                                fetchQuestionBank();
                              }}
                              className="h-10 w-10 text-primary/10 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {bankQuestions.length === 0 && (
                      <div className="py-20 text-center bg-primary/5 rounded-[40px] border-2 border-dashed border-primary/20">
                        <Library className="w-12 h-12 text-primary/10 mx-auto mb-4" />
                        <p className="text-primary/20 font-black uppercase tracking-widest text-[10px]">No Library Items Discovered</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'active' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-black uppercase tracking-tighter text-primary">Live Proctor Console</h2>
                <p className="text-[10px] text-primary/40 font-bold uppercase tracking-[0.2em] mt-2">Real-time surveillance & session authority</p>
              </div>
              <div className="flex gap-4">
                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest">
                  System: Online
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Object.values(liveStudents).length === 0 ? (
                <div className="col-span-full py-40 text-center bg-primary/5 rounded-[48px] border-2 border-dashed border-primary/20">
                  <AlertCircle className="w-16 h-16 text-primary/10 mx-auto mb-6" />
                  <p className="text-primary/20 font-black uppercase tracking-[0.3em] text-xs">No active examination sessions detected</p>
                </div>
              ) : (
                Object.values(liveStudents).map((student: any) => (
                  <Card key={student.id} className={cn("rounded-[32px] border-2 transition-all overflow-hidden bg-white shadow-xl", student.violations?.length > 3 ? "border-red-500/40 shadow-red-500/10" : student.violations?.length > 0 ? "border-amber-500/40 shadow-amber-500/10" : "border-primary/10 shadow-primary/5")}>
                    <div className="p-8">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-xl">
                            {student.email ? student.email[0].toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="font-black text-primary leading-tight">{student.email}</p>
                            <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">{student.examNumber}</p>
                          </div>
                        </div>
                        <Badge className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md", student.violations?.length > 0 ? "bg-red-500 text-white" : "bg-green-500 text-white")}>
                          {student.violations?.length > 0 ? `${student.violations.length} VIOLATIONS` : 'STABLE'}
                        </Badge>
                      </div>

                      {/* Webcam Snapshot */}
                      <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden mb-6 border-2 border-primary/10 group">
                        {student.lastSnapshot ? (
                          <img src={student.lastSnapshot} alt="Student" className="w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20">
                            <Library className="w-8 h-8 mb-2" />
                            <p className="text-[8px] font-black uppercase tracking-widest">Waiting for burst...</p>
                          </div>
                        )}
                        <div className="absolute top-2 right-2 flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-500/50" />
                          <span className="text-[8px] font-black text-white bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-md">LIVE</span>
                        </div>
                      </div>

                      {/* Violation Feed */}
                      <div className="space-y-2 mb-8 max-h-24 overflow-y-auto pr-2 scrollbar-hide">
                        {student.violations?.map((v: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 p-2 bg-red-50 rounded-lg border border-red-100">
                            <AlertCircle className="w-3 h-3 text-red-500" />
                            <p className="text-[9px] font-bold text-red-600 uppercase tracking-tighter">{v.type} @ {new Date(v.timestamp).toLocaleTimeString()}</p>
                          </div>
                        ))}
                      </div>

                      {/* Proctor Actions */}
                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          onClick={() => sendProctorCommand(student.id, 'lock', "Admin has paused your session for review.")}
                          className="h-10 bg-amber-500 text-white hover:bg-amber-600 rounded-xl font-black uppercase tracking-widest text-[8px] shadow-lg shadow-amber-500/20"
                        >
                          Suspend
                        </Button>
                        <Button 
                          onClick={() => sendProctorCommand(student.id, 'terminate')}
                          className="h-10 bg-red-500 text-white hover:bg-red-600 rounded-xl font-black uppercase tracking-widest text-[8px] shadow-lg shadow-red-500/20"
                        >
                          Terminate
                        </Button>
                        <Button 
                          onClick={() => sendProctorCommand(student.id, 'unlock')}
                          variant="outline"
                          className="col-span-2 h-10 border-2 border-primary/20 text-primary hover:bg-primary/5 rounded-xl font-black uppercase tracking-widest text-[8px]"
                        >
                          Restore Session
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tighter text-primary">Portal Identity</h2>
              <p className="text-[10px] text-primary/40 font-bold uppercase tracking-[0.2em] mt-2">White-label your examination environment</p>
            </div>

            <Card className="rounded-[32px] border-2 border-primary/10 p-10 space-y-8 shadow-xl shadow-primary/5 bg-white">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Organization Name</label>
                <input 
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="w-full h-14 px-6 rounded-2xl bg-primary/5 border-none focus:ring-2 focus:ring-primary font-bold text-primary"
                  placeholder="e.g. Harvard University"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Portal Logo URL</label>
                <input 
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full h-14 px-6 rounded-2xl bg-primary/5 border-none focus:ring-2 focus:ring-primary font-bold text-primary"
                  placeholder="https://link-to-your-logo.png"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Primary Theme Color</label>
                <div className="flex gap-4 items-center">
                  <input 
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-20 h-14 rounded-2xl border-none cursor-pointer overflow-hidden p-0"
                  />
                  <div className="flex-1 h-14 px-6 rounded-2xl bg-primary/5 border-none flex items-center font-mono font-bold text-primary">
                    {primaryColor.toUpperCase()}
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => toast.success("Identity profile updated successfully!")}
                className="w-full h-16 bg-primary text-white hover:bg-primary/90 rounded-2xl font-black uppercase tracking-widest"
              >
                Save Identity Profile
              </Button>
            </Card>
          </div>
        )}
      </main>

      {/* Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-primary/20 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-4xl bg-white rounded-[40px] border-2 border-primary/40 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
            <div className="p-8 border-b-2 border-primary/10 flex justify-between items-center bg-white sticky top-0 bg-white/80 backdrop-blur-md z-10">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter text-primary">Item Library & Bulk Import</h2>
                <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest mt-1">Select from bank or upload Excel/CSV to inject into this cycle</p>
              </div>
              <div className="flex gap-4 items-center">
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleBulkImport}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                  />
                  <Button variant="outline" className="h-10 rounded-full border-2 border-primary/40 text-primary font-black uppercase text-[10px] px-6 gap-2 hover:bg-primary/5">
                    <Plus className="w-4 h-4" />
                    Upload Excel
                  </Button>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsImportModalOpen(false)}
                  className="rounded-full text-primary/20 hover:text-primary hover:bg-primary/5"
                >
                  <PlusCircle className="w-6 h-6 rotate-45" />
                </Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 p-8">
              <div className="grid grid-cols-1 gap-6">
                {bankQuestions.length === 0 ? (
                  <div className="py-20 text-center border-2 border-dashed border-primary/10 rounded-3xl">
                    <p className="text-primary/20 font-bold uppercase tracking-widest text-xs">The Question Bank is empty.</p>
                  </div>
                ) : (
                  bankQuestions.map((q) => (
                    <div 
                      key={q.id}
                      className="p-8 border-2 border-primary/10 rounded-3xl hover:border-primary/40 transition-all bg-white shadow-sm flex flex-col md:flex-row gap-8 items-start"
                    >
                      <div className="flex-1">
                        <p className="font-bold text-lg mb-4 leading-tight">{q.text}</p>
                        <div className="flex flex-wrap gap-2">
                          {q.options.map((opt, i) => (
                            <Badge key={i} variant="outline" className={cn("text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg", q.correctOptionIndex === i ? "bg-green-50 text-green-600 border-green-200" : "bg-primary/5 text-primary/40 border-primary/5")}>
                              {String.fromCharCode(65 + i)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button 
                        onClick={() => importFromBank(q)}
                        className="h-12 px-6 bg-primary text-white hover:bg-primary/90 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 shrink-0"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Inject Item
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            
            <div className="p-6 bg-primary/5 border-t-2 border-primary/10 text-center">
              <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em]">Unified Examination Center &bull; Question Repository Access</p>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}
