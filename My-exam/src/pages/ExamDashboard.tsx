import { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Exam } from '@/src/types';
import { motion } from 'motion/react';
import { useAuth } from '@/src/context/AuthContext';
import { Button } from '@/lib/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/lib/ui/card';
import { 
  BookOpen, 
  Clock, 
  PlayCircle, 
  Settings, 
  LogOut, 
  GraduationCap,
  FileText,
  Bell,
  CheckCircle,
  Database
} from 'lucide-react';
import { cn } from '@/src/lib/utils/utils';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/lib/ui/badge';
import { Separator } from '@/lib/ui/separator';

export default function ExamDashboard() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile, logOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchExams() {
      try {
        const q = query(collection(db, 'exams'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const examList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
        setExams(examList);
      } catch (error) {
        console.error("Error fetching exams:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchExams();
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-background">
      <header className="bg-white/80 backdrop-blur-md text-primary px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 border-b-2 border-primary/40 sticky top-0 z-50">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-5"
        >
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight leading-none">
              Candidate: <span className="text-primary/60 font-bold">{profile?.displayName}</span>
            </h1>
            <p className="text-[10px] text-primary/40 font-bold uppercase tracking-[0.2em] mt-1.5">Unified Examination Center &bull; Live Session</p>
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <div className="text-right hidden md:block">
            <p className="text-[10px] text-primary/30 font-black uppercase tracking-widest leading-none mb-1">Status</p>
            <Badge className="bg-primary/5 text-primary border border-primary/10 font-bold text-[10px] uppercase tracking-widest px-3 rounded-full">Verified Candidate</Badge>
          </div>
          <Separator orientation="vertical" className="h-8 bg-primary/10 mx-2" />
          <div className="flex gap-2">
            {profile?.role === 'admin' && (
              <Button variant="ghost" onClick={() => navigate('/admin')} className="text-primary hover:bg-primary/5 font-black uppercase text-[10px] tracking-widest gap-2 rounded-xl">
                <Settings className="w-4 h-4" />
                Admin
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={logOut} className="rounded-full text-primary/40 hover:text-primary hover:bg-primary/5">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-8 md:p-12 text-primary">
        {/* JAMB Quick Info Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-white rounded-[40px] border-2 border-primary/40 p-8 md:p-10 shadow-2xl shadow-primary/5 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-700">
              <Database className="w-64 h-64 rotate-12" />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row gap-10">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-32 h-32 md:w-40 md:h-40 bg-primary/5 rounded-[32px] border-4 border-white overflow-hidden shrink-0 shadow-xl"
              >
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary/10 font-black text-4xl">?</div>
                )}
              </motion.div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <Badge className="bg-primary text-white border-none font-black text-[10px] uppercase tracking-widest px-3 rounded-full">Official Slip</Badge>
                  <span className="text-[10px] text-primary/40 font-bold uppercase tracking-widest italic">Verification: ACTIVE</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-primary mb-2 leading-none">{profile?.displayName}</h2>
                <p className="text-lg font-bold text-primary/40 mb-8">Reg No: {profile?.examNumber || 'ET-' + (profile?.id?.slice(0, 8).toUpperCase() || 'UNKNOWN')}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-[10px] font-black text-primary/30 uppercase tracking-widest mb-1">State of Origin</p>
                    <p className="font-bold text-primary/80">Lagos State</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-primary/30 uppercase tracking-widest mb-1">LGA</p>
                    <p className="font-bold text-primary/80">Ikeja</p>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-[10px] font-black text-primary/30 uppercase tracking-widest mb-1">Gender</p>
                    <p className="font-bold text-primary/80">Not Specified</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-10 flex flex-wrap gap-4 pt-8 border-t border-primary/10">
              <Button size="sm" className="bg-primary text-white hover:bg-primary/90 rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2 px-6 h-11 border-none shadow-lg shadow-primary/20">
                <FileText className="w-3.5 h-3.5" />
                Print Exam Slip
              </Button>
              <Button size="sm" variant="outline" className="text-primary border-primary/20 hover:bg-primary/5 rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2 px-6 h-11">
                <CheckCircle className="w-3.5 h-3.5" />
                Update Profile
              </Button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[40px] border-2 border-primary/40 p-8 flex flex-col shadow-2xl shadow-primary/5"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black uppercase tracking-tighter">Announcements</h3>
              <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
            </div>
            
            <div className="space-y-6">
              {[
                { date: "April 22, 2026", text: "Ensure you arrive 30 minutes before your scheduled examination time." },
                { date: "April 20, 2026", text: "The 2026 Unified Matriculation session has officially commenced." },
                { date: "April 18, 2026", text: "System maintenance completed successfully.", muted: true }
              ].map((news, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + (idx * 0.1) }}
                  className={cn("pb-6 border-b border-primary/5 last:border-0 last:pb-0", news.muted && "opacity-50")}
                >
                  <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.2em] mb-2">{news.date}</p>
                  <p className="text-sm font-bold leading-snug">{news.text}</p>
                </motion.div>
              ))}
            </div>
            
            <div className="mt-auto pt-8">
              <Button variant="ghost" className="w-full text-primary/40 hover:text-primary font-bold uppercase text-[10px] tracking-widest rounded-xl hover:bg-primary/5">
                View All Notifications
              </Button>
            </div>
          </motion.div>
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-black uppercase tracking-tighter text-primary mb-2">Available Assessments</h2>
          <p className="text-primary/40 font-bold uppercase tracking-widest text-[10px]">Please select an examination to proceed to the secure testing environment.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-72 bg-primary/5 rounded-[32px] animate-pulse border border-primary/10" />
            ))}
          </div>
        ) : (
          <>
            {exams.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white border-2 border-primary/30 rounded-[40px] p-24 text-center shadow-2xl shadow-primary/5"
              >
                <div className="inline-flex items-center justify-center w-24 h-24 bg-primary/5 rounded-full mb-8">
                  <BookOpen className="w-10 h-10 text-primary/20" />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tighter mb-3">No Active Examinations</h3>
                <p className="text-primary/40 font-medium max-w-sm mx-auto">There are currently no examinations scheduled for your department. Please contact the administrator.</p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {exams.map((exam, index) => (
                  <motion.div
                    key={exam.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + (index * 0.05) }}
                    whileHover={{ y: -8 }}
                    className="flex"
                  >
                    <Card className="group flex flex-col w-full h-full overflow-hidden border-2 border-primary/40 shadow-xl shadow-primary/5 bg-white rounded-[32px] hover:border-primary transition-all duration-500">
                      <div className="h-2 bg-primary w-full" />
                      <CardHeader className="p-8 pb-4 flex-1">
                        <div className="flex justify-between items-start mb-6">
                          <Badge variant="secondary" className="bg-primary/5 text-primary font-black px-4 py-1.5 rounded-lg uppercase tracking-[0.1em] text-[10px] border-2 border-primary/30">
                            {exam.subject}
                          </Badge>
                          <div className="flex items-center gap-2 text-primary/40 font-mono font-bold text-xs">
                            <Clock className="w-3.5 h-3.5" />
                            {exam.durationMinutes}M
                          </div>
                        </div>
                        <CardTitle className="text-2xl font-black text-primary leading-tight uppercase transition-colors">
                          {exam.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 text-primary/40 mt-3 font-medium leading-relaxed">
                          {exam.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-8 py-4 shrink-0">
                        <Separator className="bg-primary/5 mb-6" />
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-primary/30">
                          <span>Progress Status</span>
                          <span className="text-primary/80 font-black italic">OPEN FOR ENTRY</span>
                        </div>
                      </CardContent>
                      <CardFooter className="p-8 pt-0 shrink-0">
                        <Button 
                          onClick={() => navigate(`/exam/${exam.id}`)}
                          className="w-full h-16 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] gap-3 transition-all border-none shadow-lg shadow-primary/20 active:scale-95"
                        >
                          <PlayCircle className="w-5 h-5 px-0" />
                          Access Examination
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
