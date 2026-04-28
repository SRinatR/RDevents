'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
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

type AdminEventOption = {
  id: string;
  title: string;
  slug?: string | null;
  category?: string | null;
  status?: string | null;
  startsAt?: string | null;
  location?: string | null;
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
function GalleryIcon() { return <IconFrame><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m21 15-4.5-4.5a1.5 1.5 0 0 0-2.12 0L9 16" /><path d="m13 19-3.5-3.5a1.5 1.5 0 0 0-2.12 0L3 20" /></IconFrame>; }
function FormIcon() { return <IconFrame><path d="M9 11h6M9 15h6M7 7h10" /><rect x="4" y="3" width="16" height="18" rx="2" /></IconFrame>; }
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
function SupportIcon() { return <IconFrame><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></IconFrame>; }
function ReportIcon() { return <IconFrame><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="10" y1="12" x2="10" y2="12" /><line x1="12" y1="12" x2="12" y2="12" /><line x1="14" y1="12" x2="14" y2="12" /></IconFrame>; }

function getEventIdFromPath(pathname: string, locale: string) {
  const prefix = `/${locale}/admin/events/`;
  if (!pathname.startsWith(prefix)) return '';
  const id = pathname.slice(prefix.length).split('/')[0] ?? '';
  return id === 'new' ? '' : id;
}

function formatEventDate(value?: string | null, locale = 'ru') {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
}

// ─── AdminShell component ──────────────────────────────────────────────────────

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin, isSuperAdmin } = useAuth();
  const locale = useRouteLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const routeEventId = getEventIdFromPath(pathname, locale);
  const [currentEvent, setCurrentEvent] = useState<AdminEventOption | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [loading, user, isAdmin, router, locale]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user || !isAdmin || !routeEventId) {
      setCurrentEvent(null);
      return;
    }

    let active = true;

    adminApi.listEvents({ id: routeEventId, limit: 1 })
      .then((result) => {
        if (!active) return;
        setCurrentEvent((result.data?.[0] as AdminEventOption | undefined) ?? null);
      })
      .catch(() => {
        if (active) setCurrentEvent(null);
      });

    return () => {
      active = false;
    };
  }, [user, isAdmin, routeEventId]);

  // ─── Grouped navigation ───────────────────────────────────────────────────────
  
  const navGroups = useMemo<NavGroup[]>(() => {
    const groups: NavGroup[] = [
      {
        label: 'Platform',
        items: [
          { href: `/${locale}/admin/applications`, label: locale === 'ru' ? 'Приём заявок' : 'Application intake', icon: <HandshakeIcon />, allow: true },
          { href: `/${locale}/admin`, label: t('admin.title'), icon: <DashboardIcon />, allow: true },
          { href: `/${locale}/admin/events`, label: t('admin.events'), icon: <CalendarIcon />, allow: true },
          { href: `/${locale}/admin/analytics`, label: t('admin.analytics'), icon: <ChartIcon />, allow: true },
        ],
      },
      {
        label: 'Communications',
        items: [
          { href: `/${locale}/admin/support`, label: locale === 'ru' ? 'Поддержка' : 'Support', icon: <SupportIcon />, allow: isPlatformAdmin },
          { href: `/${locale}/admin/email`, label: t('admin.email'), icon: <MailIcon />, allow: isPlatformAdmin },
          { href: `/${locale}/admin/email/messages`, label: t('admin.messages'), icon: <InboxIcon />, allow: isPlatformAdmin },
          { href: `/${locale}/admin/email/templates`, label: t('admin.emailTemplates'), icon: <TemplateIcon />, allow: isPlatformAdmin },
          { href: `/${locale}/admin/email/broadcasts`, label: t('admin.broadcasts'), icon: <BroadcastIcon />, allow: isPlatformAdmin },
          { href: `/${locale}/admin/email/automations`, label: t('admin.automations'), icon: <AutomationIcon />, allow: isPlatformAdmin },
          { href: `/${locale}/admin/email/audience`, label: t('admin.audience'), icon: <AudienceIcon />, allow: isPlatformAdmin },
          { href: `/${locale}/admin/email/domains`, label: t('admin.domains'), icon: <GlobeIcon />, allow: isPlatformAdmin },
          { href: `/${locale}/admin/email/webhooks`, label: t('admin.webhooks'), icon: <WebhookIcon />, allow: isPlatformAdmin },
        ],
      },
      {
        label: locale === 'ru' ? 'Организация' : 'Organization',
        items: [
          { href: `/${locale}/admin/organization-map`, label: locale === 'ru' ? 'Карта организации' : 'Organization map', icon: <GlobeIcon />, allow: isPlatformAdmin },
          { href: `/${locale}/admin/workspaces`, label: locale === 'ru' ? 'Отделы' : 'Workspaces', icon: <ShieldIcon />, allow: true },
          { href: `/${locale}/admin/workspaces?view=members`, label: locale === 'ru' ? 'Сотрудники отделов' : 'Workspace staff', icon: <UsersIcon />, allow: true },
          { href: `/${locale}/admin/workspaces?view=access`, label: locale === 'ru' ? 'Политики доступа' : 'Access policies', icon: <SettingsIcon />, allow: true },
        ],
      },
      {
        label: 'Management',
        items: [
          { href: `/${locale}/admin/users`, label: t('admin.users'), icon: <UserCogIcon />, allow: isPlatformAdmin },
          { href: `/${locale}/admin/admins`, label: t('admin.admins'), icon: <ShieldIcon />, allow: isSuperAdmin },
          { href: `/${locale}/admin/settings`, label: t('admin.settings'), icon: <SettingsIcon />, allow: isPlatformAdmin },
          { href: `/${locale}/admin/audit`, label: t('admin.audit'), icon: <AuditIcon />, allow: isPlatformAdmin },
          { href: `/${locale}/admin/system-reports`, label: locale === 'ru' ? 'Системные отчёты' : 'System Reports', icon: <ReportIcon />, allow: isSuperAdmin },
        ],
      },
    ];

    if (routeEventId) {
      const eventBase = `/${locale}/admin/events/${routeEventId}`;
      groups.push({
        label: locale === 'ru' ? 'Текущее событие' : 'Current Event',
        items: [
          { href: `${eventBase}/overview`, label: locale === 'ru' ? 'Обзор' : 'Overview', icon: <DashboardIcon />, allow: true },
          { href: `${eventBase}/participants`, label: t('admin.participants'), icon: <HandshakeIcon />, allow: true },
          { href: `${eventBase}/staff`, label: 'Staff', icon: <ShieldIcon />, allow: true },
          { href: `${eventBase}/volunteers`, label: t('admin.volunteers'), icon: <UsersIcon />, allow: true },
          { href: `${eventBase}/teams`, label: t('admin.teams'), icon: <TeamIcon />, allow: true },
          { href: `${eventBase}/registrations`, label: locale === 'ru' ? 'Регистрации' : 'Registrations', icon: <InboxIcon />, allow: true },
          { href: `${eventBase}/analytics`, label: t('admin.analytics'), icon: <ChartIcon />, allow: true },
          { href: `${eventBase}/media`, label: locale === 'ru' ? 'Фотобанк' : 'Photobank', icon: <GalleryIcon />, allow: true },
          { href: `${eventBase}/forms`, label: locale === 'ru' ? 'Формы' : 'Forms', icon: <FormIcon />, allow: true },
          { href: `${eventBase}/content`, label: locale === 'ru' ? 'Контент' : 'Content', icon: <TemplateIcon />, allow: true },
          { href: `${eventBase}/communications`, label: locale === 'ru' ? 'Коммуникации' : 'Communications', icon: <BroadcastIcon />, allow: true },
          { href: `${eventBase}/settings`, label: t('admin.settings'), icon: <SettingsIcon />, allow: true },
          { href: `${eventBase}/audit`, label: t('admin.audit'), icon: <AuditIcon />, allow: true },
        ],
      });
    }

    return groups;
  }, [locale, t, isPlatformAdmin, isSuperAdmin, routeEventId]);

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
        {/* Navigation */}
        <nav className="admin-nav" aria-label="Admin">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => item.allow);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} className="admin-nav-group">
                <div className="admin-nav-group-label">{group.label}</div>
                {visibleItems.map((item) => {
                  const adminHomeHref = `/${locale}/admin`;
                  const adminEventsHref = `/${locale}/admin/events`;
                  const isPlatformEventsHref = item.href === adminEventsHref;
                  const isActive = pathname === item.href
                    || (isPlatformEventsHref && pathname === `${adminEventsHref}/new`)
                    || (!isPlatformEventsHref && item.href !== adminHomeHref && pathname.startsWith(item.href))
                    || (item.href.endsWith('/overview') && pathname === item.href.replace('/overview', ''));
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
        <button
          className="admin-menu-button admin-menu-floating"
          onClick={() => setSidebarOpen((value) => !value)}
          type="button"
          aria-label="Toggle navigation"
        >
          <MenuIcon />
        </button>

        {currentEvent ? (
          <section className="admin-event-context-bar">
            <div className="admin-event-context-main">
              <div className="admin-event-breadcrumb">
                <Link href={`/${locale}/admin`}>Admin</Link>
                <span>/</span>
                <Link href={`/${locale}/admin/events`}>{t('admin.events')}</Link>
                <span>/</span>
                <strong>{currentEvent.title}</strong>
              </div>
              <div className="admin-event-context-meta">
                {currentEvent.startsAt ? <span>{formatEventDate(currentEvent.startsAt, locale)}</span> : null}
                {currentEvent.location ? <span>{currentEvent.location}</span> : null}
                {currentEvent.category ? <span>{currentEvent.category}</span> : null}
              </div>
            </div>
            <div className="admin-event-context-actions">
              {currentEvent.slug ? <Link href={`/${locale}/events/${currentEvent.slug}`} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Публичная' : 'Public'}</Link> : null}
              <Link href={`/${locale}/admin/events/${currentEvent.id}/overview`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Обзор' : 'Overview'}</Link>
              <Link href={`/${locale}/admin/events/${currentEvent.id}/media`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Фотобанк' : 'Photobank'}</Link>
              <Link href={`/${locale}/admin/events/${currentEvent.id}/analytics`} className="btn btn-secondary btn-sm">{t('admin.analytics')}</Link>
              <Link href={`/${locale}/admin/events/${currentEvent.id}/edit`} className="btn btn-primary btn-sm">{t('common.edit')}</Link>
            </div>
          </section>
        ) : null}

        {/* Main content - scrollable */}
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
