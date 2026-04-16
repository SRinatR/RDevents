'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  allow: boolean;
};

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin, isSuperAdmin } = useAuth();
  const locale = useRouteLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [loading, user, isAdmin, router, locale]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const navItems = useMemo<NavItem[]>(() => [
    { href: `/${locale}/admin`, label: t('admin.title'), icon: <DashboardIcon />, allow: true },
    { href: `/${locale}/admin/events`, label: t('admin.events'), icon: <CalendarIcon />, allow: true },
    { href: `/${locale}/admin/volunteers`, label: t('admin.volunteers'), icon: <UsersIcon />, allow: true },
    { href: `/${locale}/admin/analytics`, label: t('admin.analytics'), icon: <ChartIcon />, allow: true },
    { href: `/${locale}/admin/users`, label: t('admin.users'), icon: <TeamIcon />, allow: isPlatformAdmin },
    { href: `/${locale}/admin/admins`, label: t('admin.admins'), icon: <ShieldIcon />, allow: isSuperAdmin },
  ], [locale, t, isPlatformAdmin, isSuperAdmin]);

  if (loading) {
    return (
      <div className="admin-loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="admin-app-shell app-shell app-shell-admin" data-shell="admin">
      <aside className={cn('admin-sidebar admin-shell-sidebar admin-command-sidebar', sidebarOpen && 'open')}>
          <div className="admin-sidebar-brand">
            <img src="/logo.svg" alt="Русский Дом" width="34" height="34" className="admin-brand-mark" />
            <div>
              <div className="admin-brand-title">Русский Дом</div>
              <div className="admin-brand-subtitle">{locale === 'ru' ? 'Панель управления' : 'Control center'}</div>
            </div>
          </div>

        <nav className="admin-nav" aria-label="Admin">
          {navItems.filter((item) => item.allow).map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} className={cn('admin-nav-item', active && 'active')} aria-current={active ? 'page' : undefined}>
                <span className="admin-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">{user.name || user.email}</div>
          <div className="admin-sidebar-role">{isSuperAdmin ? 'Super Admin' : isPlatformAdmin ? 'Platform Admin' : 'Event Admin'}</div>
        </div>
      </aside>

      <div className="admin-content-shell admin-shell-content admin-command-content">
        <header className="admin-topbar admin-topbar-command admin-shell-topbar">
          <button className="admin-menu-button" onClick={() => setSidebarOpen((value) => !value)} type="button" aria-label="Toggle navigation">
            <MenuIcon />
          </button>
          <div className="admin-topbar-title-wrap">
            <div className="admin-topbar-title">{locale === 'ru' ? 'Панель администратора' : 'Admin panel'}</div>
            <div className="admin-topbar-subtitle">{user.name || user.email}</div>
          </div>
          <div className="admin-topbar-chip">{isSuperAdmin ? 'Super admin' : isPlatformAdmin ? 'Platform admin' : 'Event admin'}</div>
          <div className="admin-topbar-signal-cluster">
            <span className="signal-status-badge tone-info">{locale === 'ru' ? 'Контур управления' : 'Control surface'}</span>
            <span className="signal-status-badge tone-neutral">{locale === 'ru' ? 'Операции · Очереди · Доступ' : 'Ops · Queues · Access'}</span>
          </div>
          <Link href={`/${locale}/admin/events/new`} className="btn btn-primary btn-sm admin-topbar-action">
            {t('admin.createEvent')}
          </Link>
        </header>
        <div className="admin-command-strip admin-ops-strip">
          <div><small>{locale === "ru" ? "Рабочие разделы" : "Work areas"}</small><strong>{locale === "ru" ? "События · Волонтёры · Аналитика · Доступ" : "Events · Volunteers · Analytics · Access"}</strong></div>
          <div><small>{locale === "ru" ? "Оператор" : "Operator"}</small><strong>{user.name || user.email}</strong></div>
        </div>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}

function IconFrame({ children }: { children: ReactNode }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

function DashboardIcon() { return <IconFrame><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="4" /><rect x="14" y="10" width="7" height="11" /><rect x="3" y="13" width="7" height="8" /></IconFrame>; }
function CalendarIcon() { return <IconFrame><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></IconFrame>; }
function UsersIcon() { return <IconFrame><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></IconFrame>; }
function ChartIcon() { return <IconFrame><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></IconFrame>; }
function TeamIcon() { return <IconFrame><path d="M16 21v-2a4 4 0 0 0-4-4H4a4 4 0 0 0-4 4v2" /><circle cx="8" cy="7" r="4" /><path d="M20 8v6M23 11h-6" /></IconFrame>; }
function ShieldIcon() { return <IconFrame><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></IconFrame>; }
function MenuIcon() { return <IconFrame><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></IconFrame>; }
