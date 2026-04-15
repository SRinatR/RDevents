'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import Sidebar from '@/components/layout/Sidebar';

export default function CabinetLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const locale = useRouteLocale();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/${locale}/login`);
    }
  }, [loading, user, router, locale]);

  if (loading) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (!user) return null;

  const navTrail = [
    { href: `/${locale}/cabinet`, label: locale === 'ru' ? 'Профиль' : 'Profile' },
    { href: `/${locale}/cabinet/applications`, label: locale === 'ru' ? 'Заявки' : 'Applications' },
    { href: `/${locale}/cabinet/events`, label: locale === 'ru' ? 'Каталог' : 'Catalog' },
    { href: `/${locale}/cabinet/my-events`, label: locale === 'ru' ? 'Мои события' : 'My events' },
  ];

  return (
    <div className="cabinet-shell app-shell app-shell-workspace workspace-shell-v2" data-shell="workspace">
      <div className="container workspace-shell-container">
        <div className="cabinet-shell-stage shell-layout-group workspace-shell-frame">
          <header className="cabinet-shell-topbar workspace-shell-header workspace-shell-header-v2">
            <div className="workspace-topbar-main">
              <div className="cabinet-shell-title-block">
                <small>{locale === 'ru' ? 'Participant workspace' : 'Participant workspace'}</small>
                <strong>{locale === 'ru' ? 'Личный кабинет участника' : 'Participant cabinet'}</strong>
              </div>
              <p>{locale === 'ru' ? 'Единый личный контур для профиля, заявок и управления участием в событиях.' : 'A unified personal loop for profile, applications, and event participation management.'}</p>
            </div>
            <div className="workspace-shell-statuses workspace-shell-statuses-v2">
              <span className="signal-status-badge tone-info">{locale === 'ru' ? 'Личный контур' : 'Personal loop'}</span>
              <span className="signal-status-badge tone-neutral">{locale === 'ru' ? 'Профиль · Заявки · События' : 'Profile · Applications · Events'}</span>
            </div>
          </header>

          <div className="workspace-topbar-trail">
            {navTrail.map((item) => (
              <Link key={item.href} href={item.href} className={`signal-chip-link ${pathname.startsWith(item.href) ? 'active' : ''}`}>
                {item.label}
              </Link>
            ))}
          </div>

          <div className="cabinet-layout-grid workspace-layout-grid-v2">
            <Sidebar locale={locale} userName={user.name} userEmail={user.email} userAvatar={user.avatarUrl} />
            <div className="cabinet-content-area">
              <div className="cabinet-content-surface workspace-content-surface-v2">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
