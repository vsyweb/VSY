import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, AdminUser } from '../types';
import { getProfile } from '../services/api';

interface AuthState {
  user: User | null;
  admin: AdminUser | null;
  token: string | null;
  role: 'user' | 'admin' | 'worker' | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  loginUser: (token: string, user: User) => void;
  loginAdmin: (token: string, admin: AdminUser) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    admin: null,
    token: null,
    role: null,
    isLoading: true,
  });

  const logout = useCallback(() => {
    localStorage.removeItem('vsy_token');
    localStorage.removeItem('vsy_user');
    localStorage.removeItem('vsy_admin');
    localStorage.removeItem('vsy_role');
    setState({ user: null, admin: null, token: null, role: null, isLoading: false });
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await getProfile();
      if (res.success && res.data) {
        setState((prev) => ({
          ...prev,
          user: res.data as User,
        }));
        localStorage.setItem('vsy_user', JSON.stringify(res.data));
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Initialize from localStorage
  useEffect(() => {
    const token = localStorage.getItem('vsy_token');
    const role = localStorage.getItem('vsy_role') as 'user' | 'admin' | 'worker' | null;
    const userStr = localStorage.getItem('vsy_user');
    const adminStr = localStorage.getItem('vsy_admin');

    if (token && role) {
      const user = userStr ? JSON.parse(userStr) as User : null;
      const admin = adminStr ? JSON.parse(adminStr) as AdminUser : null;
      setState({ token, role, user, admin, isLoading: false });
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const loginUser = (token: string, user: User) => {
    localStorage.setItem('vsy_token', token);
    localStorage.setItem('vsy_user', JSON.stringify(user));
    localStorage.setItem('vsy_role', 'user');
    setState({ token, user, admin: null, role: 'user', isLoading: false });
  };

  const loginAdmin = (token: string, admin: AdminUser) => {
    localStorage.setItem('vsy_token', token);
    localStorage.setItem('vsy_admin', JSON.stringify(admin));
    localStorage.setItem('vsy_role', admin.role);
    setState({ token, admin, user: null, role: admin.role, isLoading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, loginUser, loginAdmin, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
