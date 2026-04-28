'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import { EmptyState, LoadingLines, Notice, Panel, SectionHeader } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

export default function EventFormsPage() {
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
      setError(err.message || 'Failed to load form settings');
      setEvent(null);
    } finally {
      setLoadingData(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  const profileFields = useMemo(() => {
    const value = (event as any)?.requiredProfileFields;
    return Array.isArray(value) ? value.map(String) : [];
  }, [event]);

  const eventFields = useMemo(() => {
    const value = (event as any)?.requiredEventFields;
    return Array.isArray(value) ? value.map(String) : [];
  }, [event]);

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Формы регистрации' : 'Registration forms'}
        subtitle={locale === 'ru' ? 'Обязательные поля и правила участия события' : 'Required fields and participation rules for this event'}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : event ? (
        <>
          <div className="signal-two-col admin-dashboard-grid">
            <Panel variant="elevated" className="admin-command-panel">
              <SectionHeader title={locale === 'ru' ? 'Поля профиля' : 'Profile fields'} subtitle={locale === 'ru' ? 'Поля, которые должны быть заполнены в профиле пользователя' : 'Fields that must be completed in the user profile'} />
              {profileFields.length === 0 ? (
                <EmptyState title={locale === 'ru' ? 'Нет обязательных полей профиля' : 'No required profile fields'} description={locale === 'ru' ? 'Пользователю достаточно базового аккаунта.' : 'A basic account is enough for registration.'} />
              ) : (
                <div className="signal-muted">{profileFields.join(', ')}</div>
              )}
            </Panel>

            <Panel variant="elevated" className="admin-command-panel">
              <SectionHeader title={locale === 'ru' ? 'Поля анкеты события' : 'Event-specific fields'} subtitle={locale === 'ru' ? 'Ответы сохраняются только для выбранного события' : 'Answers are stored only for the selected event'} />
              {eventFields.length === 0 ? (
                <EmptyState title={locale === 'ru' ? 'Нет дополнительных вопросов' : 'No extra questions'} description={locale === 'ru' ? 'Регистрация не просит отдельные ответы по событию.' : 'Registration does not ask event-specific questions.'} />
              ) : (
                <div className="signal-muted">{eventFields.join(', ')}</div>
              )}
            </Panel>
          </div>

          <Panel variant="elevated" className="admin-command-panel">
            <SectionHeader title={locale === 'ru' ? 'Правила участия' : 'Participation rules'} subtitle={locale === 'ru' ? 'Как пользователь попадает в список участников' : 'How a user enters the participant list'} />
            <div className="admin-event-facts-grid">
              <div><small>{locale === 'ru' ? 'Модерация участников' : 'Participant approval'}</small><strong>{(event as any).requireParticipantApproval ? (locale === 'ru' ? 'Включена' : 'Enabled') : (locale === 'ru' ? 'Не требуется' : 'Not required')}</strong></div>
              <div><small>{locale === 'ru' ? 'Режим лимита' : 'Limit mode'}</small><strong>{(event as any).participantLimitMode ?? 'UNLIMITED'}</strong></div>
              <div><small>{locale === 'ru' ? 'Цель / лимит' : 'Target / limit'}</small><strong>{(event as any).participantTarget ?? event.capacity ?? '—'}</strong></div>
              <div><small>{locale === 'ru' ? 'Видимость счётчика' : 'Count visibility'}</small><strong>{(event as any).participantCountVisibility ?? 'PUBLIC'}</strong></div>
              <div><small>{locale === 'ru' ? 'Командное событие' : 'Team-based'}</small><strong>{(event as any).isTeamBased ? (locale === 'ru' ? 'Да' : 'Yes') : (locale === 'ru' ? 'Нет' : 'No')}</strong></div>
              <div><small>{locale === 'ru' ? 'Режим входа в команду' : 'Team join mode'}</small><strong>{(event as any).teamJoinMode ?? 'OPEN'}</strong></div>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
