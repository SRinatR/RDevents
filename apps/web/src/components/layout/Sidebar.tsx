'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SidebarProps {
  locale: string;
  userName?: string | null;
  userEmail?: string;
  userAvatar?: string | null;
}

type MenuItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  summary?: string;
  submenu?: Array<{ label: string; href: string }>;
};

export default function Sidebar({ locale, userName, userEmail, userAvatar }: SidebarProps) {
  const pathname = usePathname();

  const primaryItems: MenuItem[] = [
    {
      label: locale === 'ru' ? 'Мой кабинет' : 'My cabinet',
      href: `/${locale}/cabinet`,
      icon: <DashboardIcon />,
      summary: locale === 'ru' ? 'Обзор и участие' : 'Overview and participation',
    },
    {
      label: locale === 'ru' ? 'Профиль' : 'Profile',
      href: `/${locale}/cabinet/profile`,
      icon: <ProfileIcon />,
      summary: locale === 'ru' ? 'Личные данные и готовность' : 'Personal data and readiness',
    },
    {
      label: locale === 'ru' ? 'Заявки и статусы' : 'Applications',
      href: `/${locale}/cabinet/applications`,
      icon: <ApplicationIcon />,
      summary: locale === 'ru' ? 'Участие, команды, решения' : 'Participation, teams, decisions',
    },
    {
      label: locale === 'ru' ? 'Приглашения' : 'Invitations',
      href: `/${locale}/cabinet/team-invitations`,
      icon: <InviteIcon />,
      summary: locale === 'ru' ? 'Команды и приглашения' : 'Teams and invitations',
    },
    {
      label: locale === 'ru' ? 'Поддержка' : 'Support',
      href: `/${locale}/cabinet/support`,
      icon: <SupportIcon />,
      summary: locale === 'ru' ? 'Обращения и помощь' : 'Tickets and help',
    },
  ];

  const eventItems: MenuItem[] = [
    {
      label: locale === 'ru' ? 'Каталог событий' : 'Event catalog',
      href: `/${locale}/cabinet/events`,
      icon: <CalendarIcon />,
      summary: locale === 'ru' ? 'Выбор и вход в события' : 'Discovery and event entry',
    },
    {
      label: locale === 'ru' ? 'Мои мероприятия' : 'My events',
      href: `/${locale}/cabinet/my-events`,
      icon: <FlagIcon />,
      summary: locale === 'ru' ? 'Текущие участия и статусы' : 'Current participations and statuses',
    },
    {
      label: locale === 'ru' ? 'Волонтёрство' : 'Volunteer',
      href: `/${locale}/cabinet/volunteer`,
      icon: <VolunteerIcon />,
      summary: locale === 'ru' ? 'Заявки и доступные роли' : 'Applications and available roles',
    },
  ];

  const displayName = userName || userEmail || 'User';
  const initials = displayName.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside className="cabinet-rail">
      <div className="cabinet-user-block">
        <div className="signal-avatar cabinet-avatar">
          {userAvatar ? <Image src={userAvatar} alt="" width={40} height={40} /> : initials}
        </div>
        <div className="cabinet-user-content">
          <h2>{userName || displayName}</h2>
          {userEmail ? <p>{userEmail}</p> : null}
        </div>
      </div>

      <nav className="cabinet-nav-list workspace-nav-list-v2">
        <div className="cabinet-nav-label">{locale === 'ru' ? 'Личный контур' : 'Personal loop'}</div>
        {primaryItems.map((item) => <NavItem key={item.href} item={item} pathname={pathname} />)}

        <div className="cabinet-nav-label">{locale === 'ru' ? 'Событийный контур' : 'Event loop'}</div>
        {eventItems.map((item) => <NavItem key={item.href} item={item} pathname={pathname} />)}
      </nav>

      <div className="cabinet-side-note workspace-side-note-v2">
        <strong>{locale === 'ru' ? 'Что дальше' : 'What next'}</strong>
        <span>{locale === 'ru' ? 'Проверьте профиль, затем откройте каталог или продолжите текущие участия.' : 'Confirm profile readiness, then open catalog or continue current participations.'}</span>
      </div>
    </aside>
  );
}

function NavItem({ item, pathname }: { item: MenuItem; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link href={item.href} className={cn('cabinet-nav-link', isActive && 'active')} aria-current={isActive ? 'page' : undefined}>
      <span className="cabinet-nav-icon">{item.icon}</span>
      <span className="workspace-nav-item-copy">
        <strong className="workspace-nav-item-title">{item.label}</strong>
        {item.summary ? <small className="workspace-nav-item-summary">{item.summary}</small> : null}
      </span>
    </Link>
  );
}

function IconFrame({ children }: { children: React.ReactNode }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
function DashboardIcon() { return <IconFrame><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></IconFrame>; }
function ProfileIcon() { return <IconFrame><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></IconFrame>; }
function ApplicationIcon() { return <IconFrame><path d="M9 3h6l2 2h3v16H4V5h3z" /><path d="M8 12h8" /><path d="M8 16h6" /></IconFrame>; }
function InviteIcon() { return <IconFrame><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></IconFrame>; }
function CalendarIcon() { return <IconFrame><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="16" y1="3" x2="16" y2="7" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="3" y1="11" x2="21" y2="11" /></IconFrame>; }
function FlagIcon() { return <IconFrame><path d="M4 4v16" /><path d="M4 5h11l-1.5 3L15 11H4" /></IconFrame>; }
function VolunteerIcon() { return <IconFrame><path d="M12 21s-7-4.4-9-9.2C1.5 8 3.5 5 6.8 5c2 0 3.4 1.1 5.2 3.1C13.8 6.1 15.2 5 17.2 5c3.3 0 5.3 3 3.8 6.8C19 16.6 12 21 12 21z" /></IconFrame>; }
function SupportIcon() { return <IconFrame><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></IconFrame>; }
