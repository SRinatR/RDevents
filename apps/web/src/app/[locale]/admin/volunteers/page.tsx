'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { StatusBadge } from '../../../../components/admin/StatusBadge';
import { EmptyState } from '../../../../components/admin/EmptyState';

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
      .then(result => {
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
      .then(result => setVolunteers(result.volunteers))
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

  if (loading || !user || !isAdmin) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
      <div className="spinner" />
    </div>
  );

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.volunteers')}
        description={
          locale === 'ru'
            ? 'Заявки волонтёров на события, которыми вы управляете.'
            : 'Review volunteer applications for events you manage.'
        }
      />

      <div className="admin-page-body">
        {loadingData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} className="admin-skeleton" style={{ height: 56 }} />)}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет событий' : 'No events yet'}
            description={locale === 'ru' ? 'Управляемые события не найдены.' : 'No manageable events found.'}
          />
        ) : (
          <>
            {/* Filters toolbar */}
            <div className="admin-toolbar" style={{ marginBottom: 20 }}>
              <select
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
                className="admin-filter-select"
                style={{ minWidth: 240 }}
              >
                {events.map(event => (
                  <option key={event.id} value={event.id}>{event.title}</option>
                ))}
              </select>

              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="admin-filter-select"
              >
                {STATUS_FILTERS.map(item => (
                  <option key={item} value={item}>
                    {item === 'PENDING'  ? (locale === 'ru' ? 'Ожидают' : 'Pending')  :
                     item === 'ACTIVE'   ? (locale === 'ru' ? 'Активные' : 'Active')  :
                     item === 'REJECTED' ? (locale === 'ru' ? 'Отклонённые' : 'Rejected') :
                                          (locale === 'ru' ? 'Удалённые' : 'Removed')}
                  </option>
                ))}
              </select>

              {selectedEventId && (
                <Link href={`/${locale}/admin/events/${selectedEventId}/edit`} className="btn-admin-secondary">
                  {t('common.edit')} {locale === 'ru' ? 'событие' : 'event'}
                </Link>
              )}
            </div>

            {/* Volunteers list */}
            {loadingVolunteers ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => <div key={i} className="admin-skeleton" style={{ height: 72 }} />)}
              </div>
            ) : volunteers.length === 0 ? (
              <EmptyState
                title={
                  locale === 'ru'
                    ? `Нет волонтёров со статусом "${status}"`
                    : `No ${status.toLowerCase()} volunteers`
                }
                description={
                  locale === 'ru'
                    ? `Заявки волонтёров со статусом "${status}" для этого события отсутствуют.`
                    : `No volunteer requests with status "${status}" for this event.`
                }
              />
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{locale === 'ru' ? 'Волонтёр' : 'Volunteer'}</th>
                      <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                      <th>{locale === 'ru' ? 'Заметки' : 'Notes'}</th>
                      <th style={{ textAlign: 'right' }}>{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volunteers.map((membership: any) => (
                      <tr key={membership.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: 'var(--color-primary)', color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: '0.8rem', flexShrink: 0, overflow: 'hidden',
                            }}>
                              {membership.user?.avatarUrl
                                ? <img src={membership.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : membership.user?.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{membership.user?.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{membership.user?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={membership.status} />
                        </td>
                        <td style={{ maxWidth: 240 }}>
                          {membership.notes
                            ? <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{membership.notes}</span>
                            : <span style={{ color: 'var(--color-text-faint)', fontSize: '0.82rem' }}>—</span>}
                        </td>
                        <td>
                          {membership.status === 'PENDING' && (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => updateStatus(membership.id, 'ACTIVE')}
                                disabled={actionId === membership.id}
                                className="btn-admin-primary"
                              >
                                {locale === 'ru' ? 'Принять' : 'Approve'}
                              </button>
                              <button
                                onClick={() => updateStatus(membership.id, 'REJECTED')}
                                disabled={actionId === membership.id}
                                className="btn-admin-danger"
                              >
                                {locale === 'ru' ? 'Отклонить' : 'Reject'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
