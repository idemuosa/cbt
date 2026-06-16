import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';
import { UserProfile, Candidate } from '@/src/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  candidate: Candidate | null;
  loading: boolean;
  signIn: () => Promise<void>;
  loginWithExamNumber: (examNumber: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // First check if it's a regular user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const profileData = userDoc.data() as UserProfile;
          setProfile(profileData);
          setCandidate(null);
        } else {
          // If no user profile, check if this is an anonymous candidate session
          // We look for a profile linked to this UID or just check if they have a 'candidateId' in users collection
          // Actually, let's keep it simple: if you login with exam number, we tag you in the 'users' collection with role: 'student'
          // and link to candidate details.
          
          setProfile(null);
          setCandidate(null);
        }
      } else {
        setProfile(null);
        setCandidate(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check/Create profile for Google users
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email!,
        displayName: user.displayName || 'Staff User',
        role: 'admin', // First user could be admin, but let's default to student or handle admin differently
        createdAt: new Date().toISOString(),
      };
      // For this demo, let's make the first user an admin if they use Google
      // Ideally, admins are set manually in Firestore
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
    } else {
      setProfile(userDoc.data() as UserProfile);
    }
  };

  const loginWithExamNumber = async (examNumber: string) => {
    setLoading(true);
    try {
      const q = query(collection(db, 'candidates'), where('examNumber', '==', examNumber));
      const qSnap = await getDocs(q);
      
      if (qSnap.empty) {
        throw new Error("Invalid Exam Number. Please contact the administrator.");
      }
      
      const candidateData = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() } as Candidate;
      
      if (candidateData.status === 'suspended') {
        throw new Error("Your registration is suspended.");
      }

      // Perform anonymous sign in
      const signResult = await signInAnonymously(auth);
      const user = signResult.user;

      // Link UID to this candidate in user profiles
      const profileData: UserProfile = {
        uid: user.uid,
        email: `${examNumber}@edutest.local`,
        displayName: candidateData.fullName,
        examNumber: candidateData.examNumber,
        role: 'student',
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', user.uid), profileData);
      setProfile(profileData);
      setCandidate(candidateData);
    } catch (e: any) {
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const logOut = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, candidate, loading, signIn, loginWithExamNumber, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
