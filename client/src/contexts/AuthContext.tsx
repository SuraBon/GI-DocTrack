import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, login, setupPin } from '@/lib/parcelService';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginUser: (employeeId: string, pin?: string) => Promise<{ success: boolean, needsSetup?: boolean, error?: string, role?: string, name?: string, branch?: string }>;
  setupUserPin: (employeeId: string, pin: string, name: string, branch: string) => Promise<{ success: boolean, error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for saved user session
    const savedUser = localStorage.getItem('doc_track_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('doc_track_user');
      }
    }
    setLoading(false);

    const handleAuthError = () => {
      setUser(null);
      localStorage.removeItem('doc_track_user');
      // Toast handles UI feedback, no need to alert
    };

    window.addEventListener('auth_error', handleAuthError);
    return () => window.removeEventListener('auth_error', handleAuthError);
  }, []);

  const loginUser = async (employeeId: string, pin?: string) => {
    setLoading(true);
    const res = await login(employeeId, pin);
    if (res.success && res.user) {
      setUser(res.user);
      localStorage.setItem('doc_track_user', JSON.stringify(res.user));
    }
    setLoading(false);
    return res;
  };

  const setupUserPin = async (employeeId: string, pin: string, name: string, branch: string) => {
    setLoading(true);
    const res = await setupPin(employeeId, pin, name, branch);
    if (res.success && res.user) {
      setUser(res.user);
      localStorage.setItem('doc_track_user', JSON.stringify(res.user));
    }
    setLoading(false);
    return res;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('doc_track_user');
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
