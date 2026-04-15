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
    <div className="cabinet-shell app-shell app-shell-workspace" data-shell="workspace">
      <div className="container workspace-shell-container">
        <div className="cabinet-shell-stage shell-layout-group workspace-shell-frame">
          <header className="cabinet-shell-topbar workspace-shell-header">
            <div className="cabinet-shell-title-block">
              <small>{locale === 'ru' ? 'Рабочая среда участника' : 'Participant workspace'}</small>
              <strong>{locale === 'ru' ? 'Кабинет участника' : 'Participant cabinet'}</strong>
            </div>
            <div className="cabinet-shell-user-meta workspace-user-meta">
              <span>{user.name || user.email}</span>
              <span>{locale === 'ru' ? 'Профиль, события и заявки' : 'Profile, events, and applications'}</span>
            </div>
            <div className="workspace-shell-statuses">
              <span className="signal-status-badge tone-info">{locale === 'ru' ? 'Личный контур' : 'Personal workspace'}</span>
              <span className="signal-status-badge tone-neutral">{locale === 'ru' ? 'События · Заявки · Команды' : 'Events · Applications · Teams'}</span>
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
