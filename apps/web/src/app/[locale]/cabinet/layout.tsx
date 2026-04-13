'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';
import { useRouteLocale } from '../../../hooks/useRouteParams';

export default function CabinetLayout({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const locale = useRouteLocale();
  const router = useRouter();

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') {
      router.push(`/${locale}/login`);
    }
    return null;
  }

  // Helper to determine active state of links
  const isActive = (path: string) => pathname === `/${locale}${path}`;
  const isEventsActive = pathname.includes(`/${locale}/cabinet/my-events`) || pathname.includes(`/${locale}/cabinet/events`);

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="container cabinet-layout">
        
        {/* Sidebar */}
        <aside className="cabinet-sidebar">
          
          {/* User Block */}
          <div className="cabinet-user-card">
            <div style={{
              width: 80, height: 80, borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--color-primary), #a855f7)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem', fontWeight: 900, marginBottom: 16,
              boxShadow: 'var(--shadow-primary)'
            }}>
              {user.avatarUrl 
                ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> 
                : user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>
              {user.name}
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 2, marginBottom: 18 }}>
              {user.email}
            </div>
            <Link href={`/${locale}/cabinet`} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
              Редактировать профиль
            </Link>
          </div>

          {/* Navigation */}
          <nav className="cabinet-nav">
            <Link href={`/${locale}/cabinet`} className={`cabinet-nav-item ${isActive('/cabinet') ? 'active' : ''}`}>
              <span style={{ fontSize: '1.2rem' }}>👤</span> {t('cabinet.profile', { fallback: 'Профиль' })}
            </Link>
            
            <Link href={`/${locale}/cabinet/applications`} className={`cabinet-nav-item ${isActive('/cabinet/applications') ? 'active' : ''}`}>
              <span style={{ fontSize: '1.2rem' }}>📄</span> Мои заявки
            </Link>

            <div className={`cabinet-nav-item ${isEventsActive ? 'active' : ''}`} style={{ cursor: 'default' }}>
              <span style={{ fontSize: '1.2rem' }}>📅</span> Мероприятия
            </div>
            <Link href={`/${locale}/cabinet/my-events`} className={`cabinet-nav-subitem ${isActive('/cabinet/my-events') || pathname.includes('/cabinet/my-events/') ? 'active' : ''}`}>
              • Мои мероприятия
            </Link>
            <Link href={`/${locale}/cabinet/events`} className={`cabinet-nav-subitem ${isActive('/cabinet/events') ? 'active' : ''}`}>
              • Все мероприятия
            </Link>
          </nav>

        </aside>

        {/* Content */}
        <main className="cabinet-content">
          {children}
        </main>
        
      </div>
    </div>
  );
}
