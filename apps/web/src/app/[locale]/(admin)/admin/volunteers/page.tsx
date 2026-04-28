'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldSelect, LoadingLines, Notice, Panel, SectionHeader } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';

const STATUS_FILTERS = ['PENDING', 'ACTIVE', 'REJECTED', 'REMOVED'] as const;

export default function AdminVolunteersPage() {
  const t = useTranslations();
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingVolunteers, setLoadingVolunteers] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    setLoadingData(true);
    adminApi.listEvents({ limit: 100 })
      .then((result) => {
        setEvents(result.data);
        setSelectedEventId(result.data[0]?.id ?? '');
      })
      .catch(() => setEvents([]))
      .finally(() => setLoadingData(false));
  }, [user, isAdmin]);

  const loadVolunteers = useCallback(() => {
    if (!selectedEventId) return;
    setLoadingVolunteers(true);
    adminApi.listEventVolunteers(selectedEventId, status)
      .then((result) => setVolunteers(result.volunteers))
      .catch(() => setVolunteers([]))
      .finally(() => setLoadingVolunteers(false));
  }, [selectedEventId, status]);

  useEffect(() => {
    loadVolunteers();
  }, [loadVolunteers]);

  async function updateStatus(memberId: string, nextStatus: 'ACTIVE' | 'REJECTED') {
    setActionId(memberId);
    try {
      await adminApi.updateVolunteerStatus(selectedEventId, memberId, { status: nextStatus });
      loadVolunteers();
    } finally {
      setActionId(null);
    }
  }

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader title={t('admin.volunteers')} subtitle={locale === 'ru' ? 'Модерация заявок волонтёров по событиям' : 'Volunteer moderation by event scope'} />

      <div className="admin-control-strip">
        <div className="admin-control-card"><small>{locale === 'ru' ? 'Очередь' : 'Queue'}</small><strong>{locale === 'ru' ? 'Модерация волонтёров' : 'Volunteer moderation'}</strong></div>
        <div className="admin-control-card"><small>{locale === 'ru' ? 'Статус' : 'Status'}</small><strong>{status}</strong></div>
      </div>

      <Panel variant="elevated" className="admin-command-panel admin-data-panel">
        <SectionHeader title={locale === 'ru' ? 'Очередь модерации' : 'Moderation queue'} subtitle={locale === 'ru' ? 'Фильтрация по событию и статусу' : 'Filter by event and status'} />

        {loadingData ? <LoadingLines rows={4} /> : events.length === 0 ? (
          <EmptyState title={locale === 'ru' ? 'Нет событий для модерации' : 'No manageable events yet'} description={locale === 'ru' ? 'После создания события здесь появится очередь волонтёров.' : 'Volunteer queue appears once events are available.'} />
        ) : (
          <>
            <AdminToolbar>
              <FieldSelect value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} className="admin-filter-search admin-toolbar-search">
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.title}</option>
                ))}
              </FieldSelect>
              <FieldSelect value={status} onChange={(event) => setStatus(event.target.value)} className="admin-filter-select admin-toolbar-select">
                {STATUS_FILTERS.map((item) => <option key={item} value={item}>{item}</option>)}
              </FieldSelect>
              {selectedEventId ? <Link href={`/${locale}/admin/events/${selectedEventId}/edit`} className="btn btn-secondary btn-sm">{t('common.edit')} event</Link> : null}
            </AdminToolbar>

            {loadingVolunteers ? <LoadingLines rows={5} /> : volunteers.length === 0 ? (
              <EmptyState title={locale === 'ru' ? 'Очередь пуста' : 'Queue is empty'} description={locale === 'ru' ? `Нет заявок со статусом ${status}.` : `No volunteer entries with status ${status}.`} />
            ) : (
              <AdminMobileList>
                {volunteers.map((membership: any) => (
                  <AdminMobileCard
                    key={membership.id}
                    title={
                      <span className="admin-user-cell">
                        <span className="signal-avatar">
                          {membership.user?.avatarUrl ? <Image src={membership.user.avatarUrl} alt="" width={40} height={40} /> : (membership.user?.name || membership.user?.email || '?').charAt(0).toUpperCase()}
                        </span>
                        <span>{membership.user?.name || membership.user?.email}</span>
                      </span>
                    }
                    subtitle={membership.user?.email}
                    meta={[
                      { label: locale === 'ru' ? 'Статус' : 'Status', value: membership.status },
                      { label: locale === 'ru' ? 'Заметки' : 'Notes', value: membership.notes || '—' },
                    ]}
                    actions={
                      membership.status === 'PENDING' ? (
                        <>
                          <button onClick={() => updateStatus(membership.id, 'ACTIVE')} disabled={actionId === membership.id} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Одобрить' : 'Approve'}</button>
                          <button onClick={() => updateStatus(membership.id, 'REJECTED')} disabled={actionId === membership.id} className="btn btn-danger btn-sm">{locale === 'ru' ? 'Отклонить' : 'Reject'}</button>
                        </>
                      ) : null
                    }
                  />
                ))}
              </AdminMobileList>
            )}
          </>
        )}
      </Panel>

      <Notice tone="info">
        {locale === 'ru' ? 'Страница использует текущие API-статусы и не имитирует дополнительные backend-состояния.' : 'This module uses current API statuses and does not simulate unsupported backend states.'}
      </Notice>
    </div>
  );
}
