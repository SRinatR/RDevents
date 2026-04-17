'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import { EmptyState, LoadingLines, MetricCard, Notice, Panel, SectionHeader, StatusBadge } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

export default function EventCommunicationsPage() {
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [members, setMembers] = useState<any[]>([]);
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
      const [eventResult, membersResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminApi.listEventMembers(eventId),
      ]);
      setEvent(eventResult.data[0] ?? null);
      setMembers(membersResult.members ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load communications');
      setMembers([]);
    } finally {
      setLoadingData(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  const audience = useMemo(() => ({
    participants: members.filter((member) => member.role === 'PARTICIPANT' && member.status === 'ACTIVE').length,
    pendingParticipants: members.filter((member) => member.role === 'PARTICIPANT' && member.status === 'PENDING').length,
    volunteers: members.filter((member) => member.role === 'VOLUNTEER' && member.status === 'ACTIVE').length,
    volunteerQueue: members.filter((member) => member.role === 'VOLUNTEER' && member.status === 'PENDING').length,
    eventAdmins: members.filter((member) => member.role === 'EVENT_ADMIN' && member.status === 'ACTIVE').length,
  }), [members]);

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Коммуникации события' : 'Event communications'}
        subtitle={locale === 'ru' ? 'Аудитории, рассылки и сообщения вокруг выбранного события' : 'Audiences, broadcasts, and messages around the selected event'}
        actions={isPlatformAdmin ? <Link href={`/${locale}/admin/email/broadcasts`} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Рассылки' : 'Broadcasts'}</Link> : null}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : (
        <>
          <div className="signal-kpi-grid">
            <MetricCard tone="success" label={locale === 'ru' ? 'Участники' : 'Participants'} value={audience.participants} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'Заявки ждут' : 'Pending applications'} value={audience.pendingParticipants} />
            <MetricCard tone="info" label={locale === 'ru' ? 'Волонтёры' : 'Volunteers'} value={audience.volunteers} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'Волонтёры ждут' : 'Volunteer queue'} value={audience.volunteerQueue} />
            <MetricCard tone="neutral" label={locale === 'ru' ? 'Админы события' : 'Event admins'} value={audience.eventAdmins} />
          </div>

          <div className="signal-two-col admin-dashboard-grid">
            <Panel variant="elevated" className="admin-command-panel">
              <SectionHeader title={locale === 'ru' ? 'Сегменты аудитории' : 'Audience segments'} subtitle={locale === 'ru' ? 'Быстрые группы для будущих event-scoped рассылок' : 'Quick groups for future event-scoped messaging'} />
              <div className="admin-funnel-list">
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Подтверждённые участники' : 'Approved participants'}</span><StatusBadge tone="success">{audience.participants}</StatusBadge></div>
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Ожидающие участники' : 'Pending participants'}</span><StatusBadge tone="warning">{audience.pendingParticipants}</StatusBadge></div>
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Активные волонтёры' : 'Active volunteers'}</span><StatusBadge tone="info">{audience.volunteers}</StatusBadge></div>
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Администраторы события' : 'Event admins'}</span><StatusBadge tone="neutral">{audience.eventAdmins}</StatusBadge></div>
              </div>
            </Panel>

            <Panel variant="elevated" className="admin-command-panel">
              <SectionHeader title={locale === 'ru' ? 'Инструменты' : 'Tools'} subtitle={locale === 'ru' ? 'Переходы в существующий email-модуль' : 'Links into the existing email module'} />
              {isPlatformAdmin ? (
                <div className="admin-action-grid">
                  <Link href={`/${locale}/admin/email/messages`} className="signal-chip-link">{locale === 'ru' ? 'Сообщения' : 'Messages'}</Link>
                  <Link href={`/${locale}/admin/email/templates`} className="signal-chip-link">{locale === 'ru' ? 'Шаблоны' : 'Templates'}</Link>
                  <Link href={`/${locale}/admin/email/broadcasts`} className="signal-chip-link">{locale === 'ru' ? 'Рассылки' : 'Broadcasts'}</Link>
                  <Link href={`/${locale}/admin/email/automations`} className="signal-chip-link">{locale === 'ru' ? 'Автоматизации' : 'Automations'}</Link>
                </div>
              ) : (
                <EmptyState
                  title={locale === 'ru' ? 'Email-модуль доступен платформенным админам' : 'Email module is for platform admins'}
                  description={locale === 'ru' ? 'Сейчас страница показывает аудитории события без отправки рассылок.' : 'This page currently shows event audiences without sending broadcasts.'}
                />
              )}
            </Panel>
          </div>

          <Notice tone="info">
            {locale === 'ru'
              ? 'Event-scoped аудитории уже собраны здесь. Отправку по этим сегментам можно подключить отдельным backend-этапом без переделки навигации.'
              : 'Event-scoped audiences are already visible here. Sending to these segments can be wired as a separate backend step without changing navigation.'}
          </Notice>
        </>
      )}
    </div>
  );
}
