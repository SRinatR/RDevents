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
        <div className="cabinet-shell-stage">
          <header className="cabinet-shell-topbar">
            <div>
              <small>{locale === 'ru' ? 'Рабочая среда участника' : 'Participant workspace'}</small>
              <strong>{locale === 'ru' ? 'Кабинет управления участием' : 'Participation command workspace'}</strong>
            </div>
            <div className="cabinet-shell-user-meta">
              <span>{user.name || user.email}</span>
              <span>{locale === 'ru' ? 'Сквозной профиль и заявки' : 'Unified profile and applications'}</span>
            </div>
          </header>

          <div className="cabinet-layout-grid">
            <Sidebar locale={locale} userName={user.name} userEmail={user.email} userAvatar={user.avatarUrl} />
            <div className="cabinet-content-area">
              <div className="cabinet-content-surface">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
