'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import { EmptyState, LoadingLines, Notice, Panel, SectionHeader, StatusBadge } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, formatAdminDateTime, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

export default function EventSettingsPage() {
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [admins, setAdmins] = useState<any[]>([]);
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
      const [eventResult, adminsResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminApi.listEventAdmins(eventId).catch(() => ({ eventAdmins: [] })),
      ]);
      setEvent(eventResult.data[0] ?? null);
      setAdmins(adminsResult.eventAdmins ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
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
        title={locale === 'ru' ? 'Настройки события' : 'Event settings'}
        subtitle={locale === 'ru' ? 'Публикация, лимиты, даты, доступы и правила' : 'Publishing, limits, dates, access, and rules'}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : event ? (
        <div className="signal-two-col admin-dashboard-grid">
          <Panel variant="elevated" className="admin-command-panel">
            <SectionHeader title={locale === 'ru' ? 'Основные параметры' : 'Core settings'} subtitle={locale === 'ru' ? 'Публичное состояние и расписание' : 'Public state and schedule'} />
            <div className="admin-event-facts-grid">
              <div><small>{locale === 'ru' ? 'Статус' : 'Status'}</small><strong>{event.status ?? '—'}</strong></div>
              <div><small>{locale === 'ru' ? 'Slug' : 'Slug'}</small><strong>{event.slug ? `/${event.slug}` : '—'}</strong></div>
              <div><small>{locale === 'ru' ? 'Категория' : 'Category'}</small><strong>{event.category ?? '—'}</strong></div>
              <div><small>{locale === 'ru' ? 'Локация' : 'Location'}</small><strong>{event.location ?? '—'}</strong></div>
              <div><small>{locale === 'ru' ? 'Старт' : 'Start'}</small><strong>{formatAdminDateTime(event.startsAt, locale)}</strong></div>
              <div><small>{locale === 'ru' ? 'Финиш' : 'End'}</small><strong>{formatAdminDateTime(event.endsAt, locale)}</strong></div>
              <div><small>{locale === 'ru' ? 'Открытие регистрации' : 'Registration opens'}</small><strong>{formatAdminDateTime(event.registrationOpensAt, locale)}</strong></div>
              <div><small>{locale === 'ru' ? 'Дедлайн' : 'Deadline'}</small><strong>{formatAdminDateTime(event.registrationDeadline, locale)}</strong></div>
            </div>
            {tags.length ? <div className="admin-chip-grid">{tags.map((tag) => <StatusBadge key={tag} tone="info">{tag}</StatusBadge>)}</div> : null}
          </Panel>

          <Panel variant="elevated" className="admin-command-panel">
            <SectionHeader title={locale === 'ru' ? 'Правила и доступ' : 'Rules and access'} subtitle={locale === 'ru' ? 'Лимиты, команды и администраторы события' : 'Limits, teams, and event administrators'} />
            <div className="admin-event-facts-grid">
              <div><small>{locale === 'ru' ? 'Capacity' : 'Capacity'}</small><strong>{event.capacity ?? '—'}</strong></div>
              <div><small>{locale === 'ru' ? 'Модерация участников' : 'Participant approval'}</small><strong>{(event as any).requireParticipantApproval ? (locale === 'ru' ? 'Да' : 'Yes') : (locale === 'ru' ? 'Нет' : 'No')}</strong></div>
              <div><small>{locale === 'ru' ? 'Режим лимита' : 'Limit mode'}</small><strong>{(event as any).participantLimitMode ?? 'UNLIMITED'}</strong></div>
              <div><small>{locale === 'ru' ? 'Команды' : 'Teams'}</small><strong>{(event as any).isTeamBased ? (locale === 'ru' ? 'Включены' : 'Enabled') : (locale === 'ru' ? 'Выключены' : 'Disabled')}</strong></div>
              <div><small>{locale === 'ru' ? 'Размер команды' : 'Team size'}</small><strong>{(event as any).minTeamSize ?? 1}–{(event as any).maxTeamSize ?? 1}</strong></div>
              <div><small>{locale === 'ru' ? 'Админы события' : 'Event admins'}</small><strong>{admins.length}</strong></div>
            </div>
            {admins.length === 0 ? (
              <EmptyState
                title={locale === 'ru' ? 'Админы не назначены' : 'No admins assigned'}
                description={isPlatformAdmin ? (locale === 'ru' ? 'Назначьте админа через форму редактирования.' : 'Assign admins through the edit form.') : (locale === 'ru' ? 'Попросите платформенного админа назначить доступ.' : 'Ask a platform admin to assign access.')}
              />
            ) : (
              <div className="signal-stack">
                {admins.map((admin) => (
                  <div className="signal-ranked-item" key={admin.id}>
                    <span>{admin.user?.name ?? admin.user?.email}</span>
                    <StatusBadge tone="success">{admin.status}</StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
