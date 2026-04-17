'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../../../hooks/useAuth';
import { adminApi } from '../../../../../../lib/api';
import { useRouteParams } from '../../../../../../hooks/useRouteParams';

type Participant = {
  id: string;
  role: string;
  status: string;
  userId: string;
  teamId: string | null;
  answers: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    city: string | null;
    telegram: string | null;
    birthDate: string | null;
  };
  team?: {
    id: string;
    name: string;
    status: string;
  };
};

const STATUS_LABELS: Record<string, { ru: string; en: string }> = {
  PENDING: { ru: 'На рассмотрении', en: 'Pending' },
  ACTIVE: { ru: 'Подтверждён', en: 'Active' },
  RESERVE: { ru: 'В резерве', en: 'Reserve' },
  REJECTED: { ru: 'Отклонён', en: 'Rejected' },
  CANCELLED: { ru: 'Отменён', en: 'Cancelled' },
  REMOVED: { ru: 'Удалён', en: 'Removed' },
};

export default function EventParticipantsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<any | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'RESERVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  const loadData = useCallback(async () => {
    if (!eventId) return;

    setLoadingData(true);
    setError('');

    try {
      const [eventRes, participantsRes] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminApi.listEventParticipants(eventId),
      ]);

      setEvent(eventRes.data[0] ?? null);
      setParticipants(participantsRes.participants ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoadingData(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (user && isAdmin) {
      void loadData();
    }
  }, [user, isAdmin, loadData]);

  const filteredParticipants = participants.filter((p) => {
    const matchesFilter = filter === 'ALL' || p.status === filter;
    const query = searchQuery.toLowerCase();

    const matchesSearch =
      !searchQuery ||
      p.user?.name?.toLowerCase().includes(query) ||
      p.user?.email?.toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: participants.length,
    pending: participants.filter((p) => p.status === 'PENDING').length,
    active: participants.filter((p) => p.status === 'ACTIVE').length,
    reserve: participants.filter((p) => p.status === 'RESERVE').length,
  };

  const handleUpdateStatus = async (participantId: string, newStatus: string) => {
    if (!eventId) return;

    setActionLoading(participantId);
    setError('');
    setSuccess('');

    try {
      await adminApi.updateParticipantStatus(eventId, participantId, { status: newStatus });
      setSuccess(`Participant status updated to ${newStatus}`);
      setSelectedParticipant(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update participant');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject' | 'reserve') => {
    if (!eventId) return;

    const pendingIds = participants.filter((p) => p.status === 'PENDING').map((p) => p.id);
    if (pendingIds.length === 0) return;

    const newStatus =
      action === 'approve' ? 'ACTIVE' : action === 'reject' ? 'REJECTED' : 'RESERVE';

    setActionLoading('bulk');
    setError('');
    setSuccess('');

    try {
      await Promise.all(
        pendingIds.map((id) =>
          adminApi.updateParticipantStatus(eventId, id, { status: newStatus }),
        ),
      );
      setSuccess(`All pending applications ${action}ed`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Bulk action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = STATUS_LABELS[status] ?? { ru: status, en: status };
    return locale === 'ru' ? labels.ru : labels.en;
  };

  const getStatusTone = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
    if (status === 'ACTIVE') return 'success';
    if (status === 'PENDING') return 'warning';
    if (status === 'RESERVE') return 'info';
    return 'danger';
  };

  if (loading || !user || !isAdmin) {
    return <div>{t('common.loading')}</div>;
  }

  return (
    <div>
      <Link href={`/${locale}/admin/events`}>← {t('common.back')}</Link>

      <h1>{locale === 'ru' ? 'Участники события' : 'Event Participants'}</h1>

      {event && <p>{event.title}</p>}

      {error && <div>{error}</div>}
      {success && <div>✅ {success}</div>}

      {loadingData ? (
        <div>{t('common.loading')}</div>
      ) : (
        <>
          <div>
            <div>
              <div>{locale === 'ru' ? 'Всего' : 'Total'}</div>
              <strong>{stats.total}</strong>
            </div>
            <div>
              <div>{locale === 'ru' ? 'На рассмотрении' : 'Pending'}</div>
              <strong>{stats.pending}</strong>
            </div>
            <div>
              <div>{locale === 'ru' ? 'Подтверждены' : 'Active'}</div>
              <strong>{stats.active}</strong>
            </div>
            <div>
              <div>{locale === 'ru' ? 'В резерве' : 'Reserve'}</div>
              <strong>{stats.reserve}</strong>
            </div>
          </div>

          <div>
            {(['ALL', 'PENDING', 'ACTIVE', 'RESERVE'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} type="button">
                {f === 'ALL' ? (locale === 'ru' ? 'Все' : 'All') : getStatusLabel(f)}
              </button>
            ))}

            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                locale === 'ru' ? 'Поиск по имени или email...' : 'Search by name or email...'
              }
            />
          </div>

          {stats.pending > 0 && (
            <div>
              <button
                type="button"
                onClick={() => handleBulkAction('approve')}
                disabled={actionLoading === 'bulk'}
              >
                {locale === 'ru'
                  ? `Подтвердить все (${stats.pending})`
                  : `Approve all (${stats.pending})`}
              </button>

              <button
                type="button"
                onClick={() => handleBulkAction('reserve')}
                disabled={actionLoading === 'bulk'}
              >
                {locale === 'ru'
                  ? `В резерв (${stats.pending})`
                  : `Move to reserve (${stats.pending})`}
              </button>

              <button
                type="button"
                onClick={() => handleBulkAction('reject')}
                disabled={actionLoading === 'bulk'}
              >
                {locale === 'ru'
                  ? `Отклонить все (${stats.pending})`
                  : `Reject all (${stats.pending})`}
              </button>
            </div>
          )}

          {filteredParticipants.length === 0 ? (
            <div>{locale === 'ru' ? 'Участники не найдены' : 'No participants found'}</div>
          ) : (
            <div>
              {filteredParticipants.map((participant) => (
                <div key={participant.id}>
                  <div>
                    <strong>{participant.user?.name ?? (locale === 'ru' ? 'Без имени' : 'Unnamed')}</strong>
                    <div>{participant.user?.email}</div>

                    {participant.team && (
                      <div>
                        {locale === 'ru' ? 'Команда:' : 'Team:'} {participant.team.name}
                      </div>
                    )}

                    {participant.user?.phone && <div>{participant.user.phone}</div>}
                    {participant.user?.city && <div>{participant.user.city}</div>}

                    <div>{getStatusLabel(participant.status)}</div>
                    <div>{getStatusTone(participant.status)}</div>
                  </div>

                  <div>
                    {participant.status === 'PENDING' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(participant.id, 'ACTIVE')}
                          disabled={actionLoading === participant.id}
                        >
                          {locale === 'ru' ? 'Принять' : 'Approve'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(participant.id, 'RESERVE')}
                          disabled={actionLoading === participant.id}
                        >
                          {locale === 'ru' ? 'Резерв' : 'Reserve'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(participant.id, 'REJECTED')}
                          disabled={actionLoading === participant.id}
                        >
                          {locale === 'ru' ? 'Отклонить' : 'Reject'}
                        </button>
                      </>
                    )}

                    {(participant.status === 'ACTIVE' || participant.status === 'RESERVE') && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(participant.id, 'REMOVED')}
                        disabled={actionLoading === participant.id}
                      >
                        {locale === 'ru' ? 'Удалить' : 'Remove'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedParticipant(
                          selectedParticipant?.id === participant.id ? null : participant,
                        )
                      }
                    >
                      {selectedParticipant?.id === participant.id
                        ? locale === 'ru'
                          ? 'Скрыть'
                          : 'Hide'
                        : locale === 'ru'
                          ? 'Анкета'
                          : 'Form'}
                    </button>
                  </div>

                  {selectedParticipant?.id === participant.id && (
                    <div>
                      <h3>{locale === 'ru' ? 'Ответы на анкету' : 'Form answers'}</h3>

                      {Object.keys(participant.answers ?? {}).length === 0 ? (
                        <div>{locale === 'ru' ? 'Нет ответов' : 'No answers'}</div>
                      ) : (
                        <div>
                          {Object.entries(participant.answers ?? {}).map(([key, value]) => (
                            <div key={key}>
                              <strong>{key}:</strong> {String(value)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
