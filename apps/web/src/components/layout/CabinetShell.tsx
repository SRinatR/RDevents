'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type CabinetShellProps = {
  locale: string;
  children: ReactNode;
};

const CABINET_NAV = [
  { href: '/cabinet', labelRu: 'Обзор', labelEn: 'Overview' },
  { href: '/cabinet/profile', labelRu: 'Профиль', labelEn: 'Profile' },
  { href: '/cabinet/events', labelRu: 'События', labelEn: 'Events' },
  { href: '/cabinet/my-events', labelRu: 'Мои участия', labelEn: 'My events' },
  { href: '/cabinet/applications', labelRu: 'Заявки', labelEn: 'Applications' },
  { href: '/cabinet/volunteer', labelRu: 'Волонтёрство', labelEn: 'Volunteer' },
  { href: '/cabinet/team-invitations', labelRu: 'Приглашения', labelEn: 'Invitations' },
];

export function CabinetShell({ locale, children }: CabinetShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAdmin, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const isRu = locale === 'ru';

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/${locale}/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, locale, pathname, router]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.push(`/${locale}`);
  }

  if (loading || !user) {
    return (
      <div className="cabinet-shell cabinet-shell-loading">
        <div className="admin-shell-loader" />
      </div>
    );
  }

  return (
    <div className="cabinet-shell" data-shell="cabinet">
      <header className="cabinet-topbar">
        <Link href={`/${locale}/cabinet`} className="cabinet-brand">
          <span className="cabinet-brand-mark">RD</span>
          <span>
            <strong>{isRu ? 'Личный кабинет' : 'Cabinet'}</strong>
            <small>{user.email}</small>
          </span>
        </Link>
        <button
          type="button"
          className="cabinet-menu-button"
          onClick={() => setNavOpen((value) => !value)}
          aria-expanded={navOpen}
        >
          {isRu ? 'Меню' : 'Menu'}
        </button>
        <div className="cabinet-topbar-actions">
          {isAdmin ? (
            <Link href={`/${locale}/admin`} className="btn btn-primary btn-sm">
              {isRu ? 'Админка' : 'Admin'}
            </Link>
          ) : null}
          <Link href={`/${locale}`} className="btn btn-secondary btn-sm">
            {isRu ? 'На сайт' : 'Site'}
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
            {isRu ? 'Выйти' : 'Logout'}
          </button>
        </div>
      </header>
      <div className="cabinet-layout">
        <aside className={`cabinet-sidebar ${navOpen ? 'open' : ''}`}>
          <nav className="cabinet-sidebar-nav" aria-label={isRu ? 'Навигация кабинета' : 'Cabinet navigation'}>
            {CABINET_NAV.map((item) => {
              const href = `/${locale}${item.href}`;
              const active = pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={item.href}
                  href={href}
                  className={`cabinet-sidebar-link ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {isRu ? item.labelRu : item.labelEn}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="cabinet-content">{children}</main>
      </div>
    </div>
  );
}
