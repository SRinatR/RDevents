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
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (!user) return null;

  return (
    <div className="cabinet-shell app-shell">
      <div className="cabinet-fullbleed cabinet-fullbleed-workspace">
        <div className="cabinet-scene-surface">
          <div className="cabinet-scene-rail">
            <Sidebar locale={locale} userName={user.name || user.fullNameCyrillic || user.email} userEmail={user.email} userAvatar={user.avatarUrl} />
          </div>
          <div className="cabinet-scene-main cabinet-scene-main-workspace">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
