'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  allow: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

// ─── Icon components ────────────────────────────────────────────────────────────

function IconFrame({ children }: { children: ReactNode }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

function DashboardIcon() { return <IconFrame><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="4" /><rect x="14" y="10" width="7" height="11" /><rect x="3" y="13" width="7" height="8" /></IconFrame>; }
function CalendarIcon() { return <IconFrame><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></IconFrame>; }
function UsersIcon() { return <IconFrame><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></IconFrame>; }
function HandshakeIcon() { return <IconFrame><path d="M11 17a4 4 0 0 0 8 0" /><path d="M12 14v-3" /><path d="M8 17a4 4 0 0 1-8 0" /><path d="M12 14V8" /><path d="M14 4l-2 2-2-2" /><path d="M14 20l-2-2-2 2" /></IconFrame>; }
function TeamIcon() { return <IconFrame><path d="M16 21v-2a4 4 0 0 0-4-4H4a4 4 0 0 0-4 4v2" /><circle cx="8" cy="7" r="4" /><path d="M20 8v6M23 11h-6" /></IconFrame>; }
function MailIcon() { return <IconFrame><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></IconFrame>; }
function InboxIcon() { return <IconFrame><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></IconFrame>; }
function TemplateIcon() { return <IconFrame><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></IconFrame>; }
function BroadcastIcon() { return <IconFrame><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /><circle cx="19" cy="5" r="1" /></IconFrame>; }
function AutomationIcon() { return <IconFrame><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></IconFrame>; }
function AudienceIcon() { return <IconFrame><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></IconFrame>; }
function GlobeIcon() { return <IconFrame><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></IconFrame>; }
function WebhookIcon() { return <IconFrame><path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A2 2 0 0 1 8 19a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h.99" /><path d="M9 17.98v-10" /><path d="M15 3.98v10" /><path d="M15 17.98V4.01" /></IconFrame>; }
function ChartIcon() { return <IconFrame><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></IconFrame>; }
function UserCogIcon() { return <IconFrame><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><circle cx="19" cy="19" r="2" /><circle cx="19" cy="19" r="0.5" /></IconFrame>; }
function ShieldIcon() { return <IconFrame><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></IconFrame>; }
function SettingsIcon() { return <IconFrame><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></IconFrame>; }
function AuditIcon() { return <IconFrame><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></IconFrame>; }
function MenuIcon() { return <IconFrame><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></IconFrame>; }

// ─── AdminShell component ──────────────────────────────────────────────────────

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

  // ─── Grouped navigation ───────────────────────────────────────────────────────
  
  const navGroups = useMemo<NavGroup[]>(() => [
    {
      label: 'Core',
      items: [
        { href: `/${locale}/admin`, label: t('admin.title'), icon: <DashboardIcon />, allow: true },
        { href: `/${locale}/admin/events`, label: t('admin.events'), icon: <CalendarIcon />, allow: true },
        { href: `/${locale}/admin/participants`, label: t('admin.participants'), icon: <HandshakeIcon />, allow: true },
        { href: `/${locale}/admin/volunteers`, label: t('admin.volunteers'), icon: <UsersIcon />, allow: true },
        { href: `/${locale}/admin/teams`, label: t('admin.teams'), icon: <TeamIcon />, allow: true },
      ],
    },
    // Email admin module is not implemented yet - hidden from navigation
    // Will be shown again once the feature is properly implemented
    {
      label: 'Management',
      items: [
        { href: `/${locale}/admin/analytics`, label: t('admin.analytics'), icon: <ChartIcon />, allow: true },
        { href: `/${locale}/admin/users`, label: t('admin.users'), icon: <UserCogIcon />, allow: isPlatformAdmin },
        { href: `/${locale}/admin/admins`, label: t('admin.admins'), icon: <ShieldIcon />, allow: isSuperAdmin },
        { href: `/${locale}/admin/settings`, label: t('admin.settings'), icon: <SettingsIcon />, allow: isPlatformAdmin },
        { href: `/${locale}/admin/audit`, label: t('admin.audit'), icon: <AuditIcon />, allow: isPlatformAdmin },
      ],
    },
  ], [locale, t, isPlatformAdmin, isSuperAdmin]);

  if (loading) {
    return (
      <div className="admin-loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  const roleLabel = isSuperAdmin ? 'Super Admin' : isPlatformAdmin ? 'Platform Admin' : 'Event Admin';

  return (
    <div className="admin-app-shell app-shell app-shell-admin" data-shell="admin">
      {/* ── Sticky Sidebar ── */}
      <aside className={cn('admin-sidebar admin-shell-sidebar', sidebarOpen && 'open')}>
        {/* Brand */}
        <div className="admin-sidebar-brand">
          <img src="/logo.svg" alt="Русский Дом" width="34" height="34" className="admin-brand-mark" />
          <div>
            <div className="admin-brand-title">Русский Дом</div>
            <div className="admin-brand-subtitle">{locale === 'ru' ? 'Панель управления' : 'Control center'}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="admin-nav" aria-label="Admin">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => item.allow);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} className="admin-nav-group">
                <div className="admin-nav-group-label">{group.label}</div>
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== `/${locale}/admin` && pathname.startsWith(item.href));
                  return (
                    <Link 
                      key={item.href} 
                      href={item.href} 
                      className={cn('admin-nav-item', isActive && 'active')} 
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="admin-nav-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">{user.name || user.email}</div>
          <div className="admin-sidebar-role">{roleLabel}</div>
        </div>
      </aside>

      {/* ── Content area ── */}
      <div className="admin-content-shell admin-shell-content">
        {/* Topbar */}
        <header className="admin-topbar admin-shell-topbar">
          <button 
            className="admin-menu-button" 
            onClick={() => setSidebarOpen((value) => !value)} 
            type="button" 
            aria-label="Toggle navigation"
          >
            <MenuIcon />
          </button>
          <div className="admin-topbar-title-wrap">
            <div className="admin-topbar-title">
              {locale === 'ru' ? 'Панель администратора' : 'Admin panel'}
            </div>
            <div className="admin-topbar-subtitle">{user.name || user.email}</div>
          </div>
          <div className="admin-topbar-role">
            <span className="signal-status-badge tone-info">{roleLabel}</span>
          </div>
          <Link href={`/${locale}/admin/events/new`} className="btn btn-primary btn-sm admin-topbar-action">
            {t('admin.createEvent')}
          </Link>
        </header>

        {/* Main content - scrollable */}
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}