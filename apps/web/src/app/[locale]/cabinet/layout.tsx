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
    <div className="cabinet-shell">
      <div className="container">
        <div className="cabinet-layout-grid">
          <Sidebar locale={locale} userName={user.name} userEmail={user.email} userAvatar={user.avatarUrl} />
          <div className="cabinet-content-area">
            <div className="cabinet-workspace-topbar">
              <div>
                <small>{locale === 'ru' ? 'Participant workspace' : 'Participant workspace'}</small>
                <strong>{locale === 'ru' ? 'Личный кабинет и участие' : 'Profile and participation operations'}</strong>
              </div>
            </div>
            <div className="cabinet-content-surface">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
