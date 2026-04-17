'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState } from '@/components/ui/signal-primitives';

export default function AdminEmailAudiencePage() {
  const { user, loading, isAdmin } = useAuth();
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

  return (
    <div className="signal-page-shell admin-control-page">
      <EmptyState
        title={locale === 'ru' ? 'Модуль временно недоступен' : 'Module temporarily unavailable'}
        description={locale === 'ru' 
          ? 'Аудитория email ещё не реализована.' 
          : 'Email audience is not implemented yet.'}
      />
    </div>
  );
}