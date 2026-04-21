'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import { EmptyState, LoadingLines, Notice, Panel, SectionHeader } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

export default function EventContentPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoadingData(true);
    setError('');
    try {
      const eventResult = await adminApi.listEvents({ id: eventId, limit: 1 });
      setEvent(eventResult.data[0] ?? null);
    } catch (err: any) {
      setError(err.message || 'Failed to load content');
      setEvent(null);
    } finally {
      setLoadingData(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  const tags = useMemo(() => {
    const value = (event as any)?.tags;
    return Array.isArray(value) ? value.map(String) : [];
  }, [event]);

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Контент события' : 'Event content'}
        subtitle={locale === 'ru' ? 'Публичная страница, описание, медиа и теги' : 'Public page, copy, media, and tags'}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : event ? (
        <div className="admin-event-summary-grid">
          <Panel variant="elevated" className="admin-command-panel">
            <SectionHeader title={locale === 'ru' ? 'Публичная карточка' : 'Public card'} subtitle={event.slug ? `/${event.slug}` : undefined} />
            {(event as any).coverImageUrl ? (
              <img className="admin-event-cover-preview" src={(event as any).coverImageUrl} alt="" />
            ) : (
              <EmptyState title={locale === 'ru' ? 'Обложка не задана' : 'No cover image'} description={locale === 'ru' ? 'Добавьте изображение в настройках события.' : 'Add an image from event settings.'} />
            )}
            {tags.length ? <div className="signal-muted">{tags.join(', ')}</div> : null}
          </Panel>

          <Panel variant="elevated" className="admin-command-panel">
            <SectionHeader title={locale === 'ru' ? 'Тексты' : 'Copy'} subtitle={locale === 'ru' ? 'То, что видит пользователь на странице события' : 'What users see on the event page'} />
            <div className="admin-content-preview-stack">
              <div>
                <small>{locale === 'ru' ? 'Название' : 'Title'}</small>
                <strong>{event.title}</strong>
              </div>
              <div>
                <small>{locale === 'ru' ? 'Короткое описание' : 'Short description'}</small>
                <p>{(event as any).shortDescription || '—'}</p>
              </div>
              <div>
                <small>{locale === 'ru' ? 'Описание' : 'Description'}</small>
                <p>{(event as any).fullDescription || (event as any).description || '—'}</p>
              </div>
              <div>
                <small>{locale === 'ru' ? 'Условия участия' : 'Conditions'}</small>
                <p>{(event as any).conditions || '—'}</p>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
