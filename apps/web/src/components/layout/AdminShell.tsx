'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type AdminShellProps = {
  locale: string;
  children: ReactNode;
};

type AdminNavItem = {
  href: string;
  labelRu: string;
  labelEn: string;
  platformOnly?: boolean;
};

const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', labelRu: 'Обзор', labelEn: 'Overview' },
  { href: '/admin/events', labelRu: 'События', labelEn: 'Events' },
  { href: '/admin/participants', labelRu: 'Участники', labelEn: 'Participants' },
  { href: '/admin/teams', labelRu: 'Команды', labelEn: 'Teams' },
  { href: '/admin/volunteers', labelRu: 'Волонтёры', labelEn: 'Volunteers' },
  { href: '/admin/users', labelRu: 'Пользователи', labelEn: 'Users', platformOnly: true },
  { href: '/admin/email', labelRu: 'Email', labelEn: 'Email', platformOnly: true },
  { href: '/admin/analytics', labelRu: 'Аналитика', labelEn: 'Analytics' },
  { href: '/admin/system-reports', labelRu: 'Отчёты системы', labelEn: 'System reports', platformOnly: true },
];

export function AdminShell({ locale, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAdmin, isPlatformAdmin, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isRu = locale === 'ru';

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [loading, user, isAdmin, locale, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const navItems = useMemo(() => ADMIN_NAV.filter((item) => !item.platformOnly || isPlatformAdmin), [isPlatformAdmin]);

  async function handleLogout() {
    await logout();
    router.push(`/${locale}`);
  }

  if (loading || !user || !isAdmin) {
    return (
      <div className="admin-shell admin-shell-loading">
        <div className="admin-shell-loader" />
      </div>
    );
  }

  return (
    <div className="admin-shell" data-shell="admin">
      <button
        type="button"
        className={`admin-sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        aria-hidden={!sidebarOpen}
        tabIndex={-1}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <Link href={`/${locale}/admin`} className="admin-sidebar-brand">
            <span className="admin-sidebar-brand-mark">RD</span>
            <span>
              <strong>RDEvents</strong>
              <small>{isRu ? 'Админ-панель' : 'Admin panel'}</small>
            </span>
          </Link>
        </div>
        <nav className="admin-sidebar-nav" aria-label={isRu ? 'Админ навигация' : 'Admin navigation'}>
          {navItems.map((item) => {
            const href = `/${locale}${item.href}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={item.href}
                href={href}
                className={`admin-sidebar-link ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {isRu ? item.labelRu : item.labelEn}
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <Link href={`/${locale}`} className="admin-sidebar-link admin-sidebar-link-muted">
            {isRu ? 'На сайт' : 'Back to site'}
          </Link>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label={isRu ? 'Открыть меню' : 'Open menu'}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="admin-topbar-title">
            <strong>{isRu ? 'Панель управления' : 'Control panel'}</strong>
            <small>{user.email}</small>
          </div>
          <div className="admin-topbar-actions">
            <Link href={`/${locale}/cabinet`} className="btn btn-secondary btn-sm">
              {isRu ? 'ЛК' : 'Cabinet'}
            </Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              {isRu ? 'Выйти' : 'Logout'}
            </button>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
