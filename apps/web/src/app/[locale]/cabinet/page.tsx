'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import CabinetEventsCatalogView from '@/components/cabinet/events/CabinetEventsCatalogView';
import CabinetEventWorkspaceView from '@/components/cabinet/events/CabinetEventWorkspaceView';
import { LoadingLines, Notice, Panel } from '@/components/ui/signal-primitives';
import { useAuth } from '../../../hooks/useAuth';
import { eventsApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';

export default function CabinetDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/${locale}/login`);
    }
  }, [loading, user, router, locale]);

  useEffect(() => {
    if (!user) return;
    setResolving(true);
    setError('');

    eventsApi.myEvents()
      .then((result) => {
        const approved = (result.events || []).find((item: any) => {
          const status = item?.status ?? item?.registrationStatus ?? item?.membership?.status;
          return !status || status === 'ACTIVE' || status === 'APPROVED';
        });
        const event = approved?.event ?? approved;
        setSelectedSlug(event?.slug ?? null);
      })
      .catch(() => {
        setSelectedSlug(null);
        setError(locale === 'ru' ? 'Не удалось определить активное участие. Открыт каталог событий.' : 'Could not resolve active participation. Showing event catalog.');
      })
      .finally(() => setResolving(false));
  }, [user, locale]);

  const content = useMemo(() => {
    if (selectedSlug) {
      return <CabinetEventWorkspaceView slug={selectedSlug} />;
    }
    return <CabinetEventsCatalogView />;
  }, [selectedSlug]);

  if (loading || !user) return null;

  if (resolving) {
    return (
      <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
        <Panel>
          <LoadingLines rows={6} />
        </Panel>
      </div>
    );
  }

  return (
    <>
      {error ? <Notice tone="warning">{error}</Notice> : null}
      {content}
    </>
  );
}
