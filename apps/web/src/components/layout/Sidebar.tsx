'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
    { icon: '👤', label: locale === 'ru' ? 'Профиль' : 'Profile', href: `/${locale}/cabinet` },
    { icon: '📋', label: locale === 'ru' ? 'Мои заявки' : 'My Applications', href: `/${locale}/cabinet/applications` },
    { icon: '🎯', label: locale === 'ru' ? 'Мероприятия' : 'Events', href: `/${locale}/cabinet/events`, submenu: [
      { label: locale === 'ru' ? 'Мои мероприятия' : 'My Events', href: `/${locale}/cabinet/my-events` },
      { label: locale === 'ru' ? 'Все мероприятия' : 'All Events', href: `/${locale}/cabinet/events` }
    ]}
  ];

  const displayName = userName || userEmail || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside className="w-[340px] bg-white rounded-2xl p-6 sticky top-6 self-start shadow-sm">
      <div className="flex flex-col items-center mb-6">
        <div className="relative mb-3">
          <Avatar className="w-24 h-24 bg-[#5CEBAA] text-white font-semibold text-2xl border-4 border-white shadow-md">
            <AvatarFallback className="bg-[#5CEBAA] text-white">
              {userAvatar ? (
                <img src={userAvatar} alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                initials
              )}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -top-1 -right-1 w-7 h-7 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center shadow-sm border-2 border-white">
            <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9zM12 9a1 1 0 100 2h3a1 1 0 100-2h-3zm-1 4a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        <h2 className="font-semibold text-lg mb-1 text-[#1a1a1a]">
          {userName || displayName}
        </h2>
        {userEmail && (
          <p className="text-sm text-[#E55C94] mb-4">{userEmail}</p>
        )}
        <Link href={`/${locale}/cabinet`}>
          <Button
            variant="outline"
            className="w-full rounded-full border-2 border-[#E55C94] text-[#E55C94] hover:bg-[#FCF1F5] font-medium bg-transparent"
          >
            {locale === 'ru' ? 'Редактировать профиль' : 'Edit Profile'}
          </Button>
        </Link>
      </div>

      <nav className="space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== `/${locale}/cabinet` && pathname.startsWith(item.href));
          const isParentActive = item.submenu?.some(sub => pathname === sub.href || pathname.startsWith(sub.href));

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium text-sm",
                  (isActive || isParentActive)
                    ? "text-[#E55C94] bg-[#FCF1F5]"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
              {item.submenu && (
                <div className="ml-11 mt-1 space-y-1">
                  {item.submenu.map((subitem) => {
                    const isSubActive = pathname === subitem.href;
                    return (
                      <Link
                        key={subitem.href}
                        href={subitem.href}
                        className={cn(
                          "block px-4 py-2 rounded-lg text-sm transition-colors",
                          isSubActive
                            ? "text-[#E55C94] font-medium"
                            : "text-gray-600 hover:text-gray-900"
                        )}
                      >
                        {subitem.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-8 rounded-xl bg-[#1a1a1a] p-4 text-white">
        <div className="text-sm font-semibold mb-2">
          {locale === 'ru' ? 'Новые возможности рядом' : 'New opportunities nearby'}
        </div>
        <div className="text-xs opacity-90">
          {locale === 'ru' ? 'Присоединяйтесь к сообществу!' : 'Join the community!'}
        </div>
      </div>
    </aside>
  );
}
