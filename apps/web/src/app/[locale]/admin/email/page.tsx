'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState } from '@/components/ui/signal-primitives';

export default function AdminEmailPage() {
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  if (loading || !user || !isAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="signal-page-shell admin-control-page">
        <EmptyState
          title={locale === 'ru' ? 'Доступ запрещён' : 'Access denied'}
          description={locale === 'ru' ? 'Управление email доступно только платформенным администраторам.' : 'Email management is only available to platform administrators.'}
        />
      </div>
    );
  }

  return (
    <div className="signal-page-shell admin-control-page">
      <EmptyState
        title={locale === 'ru' ? 'Модуль временно недоступен' : 'Module temporarily unavailable'}
        description={locale === 'ru' 
          ? 'Email-администрирование (рассылки, автоматизации, шаблоны) ещё не реализовано.' 
          : 'Email administration (broadcasts, automations, templates) is not implemented yet.'}
      />
    </div>
  );
}