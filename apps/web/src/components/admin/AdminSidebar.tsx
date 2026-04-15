'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import type { ReactNode } from 'react';
import {
  CalendarIcon, UsersIcon, ShieldIcon, HandIcon, ChartIcon, GridIcon, ArrowLeftIcon,
} from './icons';

interface AdminSidebarProps { locale: string }

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
      className={`admin-nav-item${active ? ' active' : ''}`}
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
    { href: `/${locale}/admin`,            label: 'Overview',   icon: <GridIcon /> },
    { href: `/${locale}/admin/events`,     label: 'Events',     icon: <CalendarIcon /> },
    { href: `/${locale}/admin/volunteers`, label: 'Volunteers', icon: <HandIcon /> },
  ];

  const platformNavItems = isPlatformAdmin ? [
    { href: `/${locale}/admin/users`,     label: 'Users',     icon: <UsersIcon /> },
    ...(isSuperAdmin ? [{ href: `/${locale}/admin/admins`, label: 'Access', icon: <ShieldIcon /> }] : []),
    { href: `/${locale}/admin/analytics`, label: 'Analytics', icon: <ChartIcon /> },
  ] : [];

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-logo">E</div>
        <div>
          <div className="admin-sidebar-name">Admin Console</div>
          <div className="admin-sidebar-sub">EventPlatform</div>
        </div>
      </div>

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

      <div className="admin-sidebar-footer">
        <NavItem href={`/${locale}`} active={false} icon={<ArrowLeftIcon />} small>
          Back to site
        </NavItem>
      </div>
    </aside>
  );
}
