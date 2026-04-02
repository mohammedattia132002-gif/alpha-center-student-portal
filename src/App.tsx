import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import SplashScreen from './components/SplashScreen';
import { ensurePortalSupabaseSession, isSupabaseConfigured } from './lib/supabase';
import { AlertTriangle } from 'lucide-react';

const AppContent: React.FC = () => {
  const { student, isLoading } = useAuth();
  const [isSupabaseReady, setIsSupabaseReady] = useState(() => !isSupabaseConfigured);
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('hasSeenSplash') !== 'true';
  });

  useEffect(() => {
    let mounted = true;

    const initializeSupabaseSession = async () => {
      if (!isSupabaseConfigured) {
        if (mounted) setIsSupabaseReady(true);
        return;
      }

      const ready = await ensurePortalSupabaseSession();
      if (!ready) {
        console.warn('[App] Supabase auth bootstrap did not establish a session. Continuing with direct client access.');
      }
      if (mounted) {
        setIsSupabaseReady(true);
      }
    };

    void initializeSupabaseSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showSplash) return;
    localStorage.setItem('hasSeenSplash', 'true');

    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 4500);
    return () => clearTimeout(timer);
  }, [showSplash]);

  if (showSplash) {
    return <SplashScreen />;
  }

  if (isLoading || !isSupabaseReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0a0a0a] transition-colors duration-500">
        <div className="w-16 h-16 border-4 border-violet-200 dark:border-violet-900/50 border-t-violet-600 dark:border-t-violet-500 rounded-full animate-spin mb-6 transition-colors duration-500"></div>
        <div className="text-slate-500 dark:text-slate-400 font-medium text-lg transition-colors duration-500">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <>
      {(!isSupabaseConfigured || student?.id === 'demo-1') && (
        <div className="bg-amber-500 text-white text-[10px] py-1 text-center font-bold fixed top-0 left-0 right-0 z-[100] uppercase tracking-widest shadow-sm">
          وضع العرض التجريبي (Mock Mode) - البيانات غير حقيقية
        </div>
      )}
      {student ? <Dashboard /> : <Login />}
    </>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
