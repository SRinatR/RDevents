'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import Sidebar from '@/components/layout/Sidebar';

export default function CabinetLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const locale = useRouteLocale();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/${locale}/login`);
    }
  }, [loading, user, router, locale]);

  if (loading) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (!user) return null;

  const navTrail = [
    { href: `/${locale}/cabinet`, label: locale === 'ru' ? 'Профиль' : 'Profile' },
    { href: `/${locale}/cabinet/applications`, label: locale === 'ru' ? 'Заявки' : 'Applications' },
    { href: `/${locale}/cabinet/events`, label: locale === 'ru' ? 'Каталог' : 'Catalog' },
    { href: `/${locale}/cabinet/my-events`, label: locale === 'ru' ? 'Мои события' : 'My events' },
  ];

  return (
    <div className="cabinet-shell app-shell">
      <div className="cabinet-fullbleed">
        <div className="cabinet-shell-stage cabinet-shell-stage-v3">
          <div className="workspace-topbar-trail">
            {navTrail.map((item) => (
              <Link key={item.href} href={item.href} className={`signal-chip-link ${pathname.startsWith(item.href) ? 'active' : ''}`}>
                {item.label}
              </Link>
            ))}
          </div>

          <div className="cabinet-layout-grid">
            <Sidebar locale={locale} userName={user.name || user.fullNameCyrillic || user.email} userEmail={user.email} userAvatar={user.avatarUrl} />
            <div className="cabinet-content-area">
              <div className="cabinet-content-surface">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
