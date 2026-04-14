'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { tryRefreshSession, doLogin, doRegister, doLogout } from '../lib/auth';
import { authApi } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  bio?: string | null;
  city?: string | null;
  phone?: string | null;
  telegram?: string | null;
  birthDate?: string | null;
  avatarUrl?: string | null;
  role: string;
  isActive: boolean;
  registeredAt: string;
  lastLoginAt?: string | null;
  accounts?: Array<{ provider: string; providerEmail?: string | null; linkedAt: string }>;
  eventRoles?: Array<{
    eventId: string;
    eventSlug: string;
    eventTitle: string;
    role: string;
    status: string;
  }>;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<void>;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  isSuperAdmin: boolean;
}

import React from 'react';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount, try to restore session from refresh cookie
    tryRefreshSession()
      .then((result) => {
        if (result) setUser(result.user);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await doLogin(email, password);
    setUser(result.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const result = await doRegister(email, password, name);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    await doLogout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user: fresh } = await authApi.me();
      setUser(fresh);
    } catch {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<AuthUser>) => {
    const { user: updated } = await authApi.updateProfile(data as any);
    setUser(updated);
  }, []);

  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN' || user?.role === 'SUPER_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isEventAdmin = user?.eventRoles?.some(
    role => role.role === 'EVENT_ADMIN' && ['ACTIVE', 'APPROVED'].includes(role.status)
  ) ?? false;
  const isAdmin = isPlatformAdmin || isEventAdmin;

  return React.createElement(
    AuthContext.Provider,
    { value: { user, loading, login, register, logout, refreshUser, updateProfile, isAdmin, isPlatformAdmin, isSuperAdmin } },
    children
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
