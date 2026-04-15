'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import type { ReactNode } from 'react';

interface AdminSidebarProps {
  locale: string;
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3.5" width="13" height="11" rx="1.5" />
      <path d="M5 1.5v4M11 1.5v4M1.5 7.5h13" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-2.761 2.239-4.5 5-4.5s5 1.739 5 4.5" />
      <circle cx="12" cy="5" r="2" />
      <path d="M10.5 9.5c1.5 0 4 0.739 4 3.5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L2 4v4.5c0 3 2.5 5.5 6 6 3.5-.5 6-3 6-6V4L8 1.5z" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v7M6 4v4.5M10 4.5v4.5M4 9.5v.5A4 4 0 0 0 8 14a4 4 0 0 0 4-4v-.5" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 13.5h13" />
      <path d="M4 9.5v4M8 6.5v7M12 3.5v10" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}

interface NavItemProps {
  href: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  small?: boolean;
}

function NavItem({ href, active, icon, children, small }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`admin-nav-item${active ? ' active' : ''}${small ? ' small' : ''}`}
      style={small ? { fontSize: '0.78rem', padding: '6px 8px' } : undefined}
    >
      <span className="admin-nav-icon">{icon}</span>
      {children}
    </Link>
  );
}

export function AdminSidebar({ locale }: AdminSidebarProps) {
  const pathname = usePathname();
  const { isPlatformAdmin, isSuperAdmin } = useAuth();

  function isActive(href: string) {
    if (href === `/${locale}/admin`) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }

  const mainNavItems = [
    { href: `/${locale}/admin`,            label: 'Overview',    icon: <GridIcon /> },
    { href: `/${locale}/admin/events`,     label: 'Events',      icon: <CalendarIcon /> },
    { href: `/${locale}/admin/volunteers`, label: 'Volunteers',  icon: <HandIcon /> },
  ];

  const platformNavItems = isPlatformAdmin ? [
    { href: `/${locale}/admin/users`,     label: 'Users',     icon: <UsersIcon /> },
    ...(isSuperAdmin ? [{ href: `/${locale}/admin/admins`, label: 'Admins', icon: <ShieldIcon /> }] : []),
    { href: `/${locale}/admin/analytics`, label: 'Analytics', icon: <ChartIcon /> },
  ] : [];

  return (
    <aside className="admin-sidebar">
      {/* Brand */}
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-logo">E</div>
        <div>
          <div className="admin-sidebar-name">Admin Console</div>
          <div className="admin-sidebar-sub">EventPlatform</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="admin-sidebar-nav">
        <div className="admin-section-label">Manage</div>
        {mainNavItems.map(item => (
          <NavItem key={item.href} href={item.href} active={isActive(item.href)} icon={item.icon}>
            {item.label}
          </NavItem>
        ))}

        {platformNavItems.length > 0 && (
          <>
            <div className="admin-nav-divider" />
            <div className="admin-section-label">Platform</div>
            {platformNavItems.map(item => (
              <NavItem key={item.href} href={item.href} active={isActive(item.href)} icon={item.icon}>
                {item.label}
              </NavItem>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="admin-sidebar-footer">
        <NavItem href={`/${locale}`} active={false} icon={<ArrowLeftIcon />} small>
          Back to site
        </NavItem>
      </div>
    </aside>
  );
}
