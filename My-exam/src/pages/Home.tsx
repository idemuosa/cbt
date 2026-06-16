import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/src/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/lib/ui/button';
import { Input } from '@/lib/ui/input';
import { LogIn, GraduationCap, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function Home() {
  const { signIn, loginWithExamNumber, user, loading } = useAuth();
  const [examNumber, setExamNumber] = useState('');
  const [isStaffLogin, setIsStaffLogin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleCandidateLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examNumber.trim()) {
      toast.error("Please enter your Exam Number.");
      return;
    }
    try {
      await loginWithExamNumber(examNumber.trim());
      toast.success("Identity Verified. Welcome.");
    } catch (e: any) {
      toast.error(e.message || "Authentication failed.");
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", damping: 25, stiffness: 100 }
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden selection:bg-primary/10">
      {/* Background patterns */}
      <div className="absolute inset-0 z-0 opacity-[0.03]">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(var(--primary)_1.5px,transparent:1.5px)] [background-size:32px_32px]" />
      </div>

      <nav className="absolute top-0 w-full p-8 flex justify-between items-center z-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/20">E</div>
          <span className="font-black text-xl tracking-tighter uppercase text-primary">EduTest</span>
        </motion.div>
        <motion.div
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
        >
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsStaffLogin(!isStaffLogin)}
            className="text-[10px] font-black uppercase tracking-widest text-primary/40 hover:text-primary hover:bg-primary/5 rounded-xl px-4"
          >
            {isStaffLogin ? 'Candidate Login' : 'Staff Login'}
          </Button>
        </motion.div>
      </nav>

      <motion.main 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 container mx-auto px-6 py-24 flex flex-col items-center text-center"
      >
        <motion.div
          variants={itemVariants}
          className="inline-flex items-center gap-2 mb-8 px-6 py-2.5 rounded-full border-2 border-primary/30 bg-primary/5 backdrop-blur-sm"
        >
          <GraduationCap className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Unified Examination Portal</span>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="text-6xl md:text-8xl font-black tracking-tight text-primary leading-[0.85] uppercase mb-8"
        >
          Excellence in <br />
          <span className="text-primary/30">Assessment.</span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="max-w-lg text-lg md:text-xl text-primary/60 mb-12 font-medium leading-relaxed"
        >
          Secure, standardized, and reliable Computer Based Testing environment for modern educational institutions.
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="w-full max-w-sm"
        >
          {isStaffLogin ? (
            <Button
              size="lg"
              onClick={signIn}
              disabled={loading}
              className="w-full h-16 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 transition-all border-none active:scale-95"
            >
              <LogIn className="w-4 h-4 mr-3" />
              Staff Login (Google)
            </Button>
          ) : (
            <form onSubmit={handleCandidateLogin} className="space-y-4">
              <div className="relative group">
                <Input 
                  value={examNumber}
                  onChange={e => setExamNumber(e.target.value)}
                  placeholder="EXAM NUMBER"
                  className="h-16 rounded-2xl bg-white border-2 border-primary/40 focus:border-primary px-8 font-black uppercase tracking-[0.3em] text-center text-primary placeholder:text-primary/20 transition-all group-hover:border-primary/60 shadow-inner"
                />
                <Lock className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/10 group-focus-within:text-primary/40 transition-colors" />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-16 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 transition-all border-none active:scale-95"
              >
                Proceed to Examination
              </Button>
            </form>
          )}
        </motion.div>
      </motion.main>

      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 z-10 w-full text-center"
      >
        <p className="text-[10px] text-primary/20 font-bold uppercase tracking-[0.5em]">
          Powered by EduTest Systems &bull; Unified Matriculation Standard
        </p>
      </motion.footer>
    </div>
  );
}
