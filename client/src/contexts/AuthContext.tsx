import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, login, setupPin } from '@/lib/parcelService';
import { normalizeRole } from '@/lib/roles';
import { toast } from 'sonner';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginUser: (employeeId: string, pin?: string) => Promise<{ success: boolean, needsSetup?: boolean, error?: string, role?: string, name?: string, branch?: string }>;
  setupUserPin: (employeeId: string, pin: string, name: string, branch: string) => Promise<{ success: boolean, error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Session timeout: 6 hours of inactivity
const SESSION_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const SESSION_KEY = 'doc_track_user';
const LAST_ACTIVE_KEY = 'doc_track_last_active';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSession = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_ACTIVE_KEY);
  };

  const resetInactivityTimer = () => {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      clearSession();
      toast.warning('เซสชันหมดอายุเนื่องจากไม่มีการใช้งาน 6 ชั่วโมง');
    }, SESSION_TIMEOUT_MS);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem(SESSION_KEY);
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as User;
        // Check if session has already expired
        const lastActive = Number(localStorage.getItem(LAST_ACTIVE_KEY) || '0');
        if (lastActive && Date.now() - lastActive > SESSION_TIMEOUT_MS) {
          clearSession();
          toast.warning('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
        } else {
          const normalizedUser = { ...parsed, role: normalizeRole(parsed.role) };
          setUser(normalizedUser);
          localStorage.setItem(SESSION_KEY, JSON.stringify(normalizedUser));
          resetInactivityTimer();
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);

    const handleAuthError = () => {
      clearSession();
      toast.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    };

    // Track user activity to reset inactivity timer
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => {
      if (localStorage.getItem(SESSION_KEY)) resetInactivityTimer();
    };

    window.addEventListener('auth_error', handleAuthError);
    activityEvents.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));

    return () => {
      window.removeEventListener('auth_error', handleAuthError);
      activityEvents.forEach(e => window.removeEventListener(e, handleActivity));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loginUser = async (employeeId: string, pin?: string) => {
    setLoading(true);
    try {
      const res = await login(employeeId, pin);
      if (res.success && res.user) {
        setUser(res.user);
        localStorage.setItem(SESSION_KEY, JSON.stringify(res.user));
        resetInactivityTimer();
      }
      return res;
    } finally {
      setLoading(false);
    }
  };

  const setupUserPin = async (employeeId: string, pin: string, name: string, branch: string) => {
    setLoading(true);
    try {
      const res = await setupPin(employeeId, pin, name, branch);
      if (res.success && res.user) {
        setUser(res.user);
        localStorage.setItem(SESSION_KEY, JSON.stringify(res.user));
        resetInactivityTimer();
      }
      return res;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearSession();
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, setupUserPin, logout }}>
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
