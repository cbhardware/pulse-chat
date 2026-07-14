import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getMe, login, signup } from '../lib/api';
import { clearTokens, getTokens, saveTokens } from '../lib/tokenStore';
import type { AuthUser } from '../types';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  loginWithPassword: (phoneNumber: string, password: string) => Promise<void>;
  signupWithPassword: (phoneNumber: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tokens = getTokens();
    if (!tokens) {
      setLoading(false);
      return;
    }

    getMe()
      .then((me) => setUser(me))
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async loginWithPassword(phoneNumber: string, password: string) {
      const response = await login({ phoneNumber, password });
      saveTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
      setUser(response.user);
    },
    async signupWithPassword(phoneNumber: string, password: string, name?: string) {
      const response = await signup({ phoneNumber, password, name });
      saveTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
      setUser(response.user);
    },
    logout() {
      clearTokens();
      setUser(null);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
