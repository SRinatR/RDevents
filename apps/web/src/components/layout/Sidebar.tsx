'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SidebarProps {
  locale: string;
  userName?: string | null;
  userEmail?: string;
  userAvatar?: string | null;
}

export default function Sidebar({ locale, userName, userEmail, userAvatar }: SidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    { label: locale === 'ru' ? 'Профиль' : 'Profile', href: `/${locale}/cabinet`, icon: <ProfileIcon /> },
    { label: locale === 'ru' ? 'Мои заявки' : 'My Applications', href: `/${locale}/cabinet/applications`, icon: <ListIcon /> },
    {
      label: locale === 'ru' ? 'Мероприятия' : 'Events',
      href: `/${locale}/cabinet/events`,
      icon: <CalendarIcon />,
      submenu: [
        { label: locale === 'ru' ? 'Мои мероприятия' : 'My Events', href: `/${locale}/cabinet/my-events` },
        { label: locale === 'ru' ? 'Все мероприятия' : 'All Events', href: `/${locale}/cabinet/events` },
      ],
    },
  ];

  const displayName = userName || userEmail || 'User';
  const initials = displayName.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside className="cabinet-sidebar-card">
      <div className="cabinet-user-block">
        <div className="signal-avatar cabinet-avatar">
          {userAvatar ? <img src={userAvatar} alt="" /> : initials}
        </div>
        <div className="cabinet-user-content">
          <h2>{userName || displayName}</h2>
          {userEmail ? <p>{userEmail}</p> : null}
          <span className="cabinet-user-pill">{locale === 'ru' ? 'Рабочее пространство участника' : 'Participant workspace'}</span>
        </div>
      </div>

      <Link href={`/${locale}/cabinet`} className="btn btn-secondary btn-sm btn-block-center cabinet-profile-action">
        {locale === 'ru' ? 'Редактировать профиль' : 'Edit profile'}
      </Link>

      <nav className="cabinet-nav-list">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== `/${locale}/cabinet` && pathname.startsWith(item.href));
          const isParentActive = item.submenu?.some((subitem) => pathname === subitem.href || pathname.startsWith(subitem.href));

          return (
            <div key={item.href}>
              <Link href={item.href} className={cn('cabinet-nav-link', (isActive || isParentActive) && 'active')}>
                <span className="cabinet-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
              {item.submenu ? (
                <div className="cabinet-subnav">
                  {item.submenu.map((subitem) => (
                    <Link key={subitem.href} href={subitem.href} className={cn('cabinet-subnav-link', pathname === subitem.href && 'active')}>
                      {subitem.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="cabinet-side-note">
        <strong>{locale === 'ru' ? 'Рабочее пространство' : 'Workspace'}</strong>
        <span>{locale === 'ru' ? 'Разделы профиля и участия находятся в едином операционном контуре.' : 'Profile and participation modules are presented in a unified operational shell.'}</span>
      </div>
    </aside>
  );
}

function IconFrame({ children }: { children: React.ReactNode }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
function ProfileIcon() { return <IconFrame><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></IconFrame>; }
function ListIcon() { return <IconFrame><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></IconFrame>; }
function CalendarIcon() { return <IconFrame><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="16" y1="3" x2="16" y2="7" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="3" y1="11" x2="21" y2="11" /></IconFrame>; }
