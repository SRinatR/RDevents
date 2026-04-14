'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import Sidebar from '@/components/layout/Sidebar';

export default function CabinetLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const locale = useRouteLocale();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/${locale}/login`);
    }
  }, [loading, user, router, locale]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F7]">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FAF8F7]">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex gap-8">
          <Sidebar 
            locale={locale}
            userName={user.name}
            userEmail={user.email}
            userAvatar={user.avatarUrl}
          />
          <div className="flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
