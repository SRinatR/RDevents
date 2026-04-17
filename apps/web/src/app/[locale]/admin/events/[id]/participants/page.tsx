'use client';

import { useState, useEffect, useCallback } from 'react';
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
  answers: Record<string, string>;
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
  'PENDING': { ru: 'На рассмотрении', en: 'Pending' },
  'ACTIVE': { ru: 'Подтверждён', en: 'Active' },
  'RESERVE': { ru: 'В резерве', en: 'Reserve' },
  'REJECTED': { ru: 'Отклонён', en: 'Rejected' },
  'CANCELLED': { ru: 'Отменён', en: 'Cancelled' },
  'REMOVED': { ru: 'Удалён', en: 'Removed' },
};

export default function EventParticipantsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'RESERVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoadingData(true);
    setError('');
    try {
      const [eventRes, participantsRes] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminApi.listEventMembers(eventId),
      ]);
      setEvent(eventRes.data[0]);
      setParticipants(
        (participantsRes.members ?? [])
          .filter((member: any) => member.role === 'PARTICIPANT')
          .map((member: any) => ({
            id: member.id,
            role: member.role,
            status: member.status,
            userId: member.userId,
            teamId: null,
            answers: {},
            createdAt: member.assignedAt,
            updatedAt: member.updatedAt ?? member.assignedAt,
            user: member.user
              ? {
                  id: member.user.id,
                  name: member.user.name,
                  email: member.user.email,
                  phone: null,
                  city: member.user.city ?? null,
                  telegram: null,
                  birthDate: null,
                }
              : undefined,
            team: undefined,
          }))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoadingData(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (user && isAdmin) loadData();
  }, [user, isAdmin, loadData]);

  const filteredParticipants = participants.filter(p => {
    const matchesFilter = filter === 'ALL' || p.status === filter;
    const matchesSearch = !searchQuery || 
      p.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: participants.length,
    pending: participants.filter(p => p.status === 'PENDING').length,
    active: participants.filter(p => p.status === 'ACTIVE').length,
    reserve: participants.filter(p => p.status === 'RESERVE').length,
  };

  const handleUpdateStatus = async (participantId: string, newStatus: string) => {
    setActionLoading(participantId);
    setError('');
    setSuccess('');
    try {
      await adminApi.updateParticipantStatus(eventId, participantId, { status: newStatus });
      setSuccess(`Participant status updated to ${newStatus}`);
      setSelectedParticipant(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update participant');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject' | 'reserve') => {
    const pendingIds = participants.filter(p => p.status === 'PENDING').map(p => p.id);
    if (pendingIds.length === 0) return;
    
    const newStatus = action === 'approve' ? 'ACTIVE' : action === 'reject' ? 'REJECTED' : 'RESERVE';
    setActionLoading('bulk');
    setError('');
    setSuccess('');
    
    try {
      await Promise.all(pendingIds.map(id => adminApi.updateParticipantStatus(eventId, id, { status: newStatus })));
      setSuccess(`All pending applications ${action}ed`);
      loadData();
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

  if (loading || !user || !isAdmin) return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
    </div>
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 0 60px' }}>
      <div className="container" style={{ maxWidth: 1200 }}>
        <div style={{ marginBottom: 32 }}>
          <a href={`/${locale}/admin/events`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.9rem', marginBottom: 12 }}>
            ← {t('common.back')}
          </a>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900, letterSpacing: 0 }}>
            {locale === 'ru' ? 'Участники события' : 'Event Participants'}
          </h1>
          {event && (
            <p style={{ margin: '8px 0 0', color: 'var(--color-text-muted)' }}>
              {event.title}
            </p>
          )}
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-lg)', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.9rem', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-lg)', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '0.9rem', marginBottom: 20 }}>
            ✅ {success}
          </div>
        )}

        {loadingData ? (
          <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
        ) : (
          <>
            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 28 }}>
              <div style={{ padding: 18, borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>{locale === 'ru' ? 'Всего' : 'Total'}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{stats.total}</div>
              </div>
              <div style={{ padding: 18, borderRadius: 'var(--radius-xl)', border: '1px solid #f59e0b33', background: '#fffbeb' }}>
                <div style={{ fontSize: '0.85rem', color: '#92400e', marginBottom: 4 }}>{locale === 'ru' ? 'На рассмотрении' : 'Pending'}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#d97706' }}>{stats.pending}</div>
              </div>
              <div style={{ padding: 18, borderRadius: 'var(--radius-xl)', border: '1px solid #22c55e33', background: '#f0fdf4' }}>
                <div style={{ fontSize: '0.85rem', color: '#166534', marginBottom: 4 }}>{locale === 'ru' ? 'Подтверждены' : 'Active'}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#16a34a' }}>{stats.active}</div>
              </div>
              <div style={{ padding: 18, borderRadius: 'var(--radius-xl)', border: '1px solid #3b82f633', background: '#eff6ff' }}>
                <div style={{ fontSize: '0.85rem', color: '#1e40af', marginBottom: 4 }}>{locale === 'ru' ? 'В резерве' : 'Reserve'}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#2563eb' }}>{stats.reserve}</div>
              </div>
            </div>

            {/* Filters and search */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['ALL', 'PENDING', 'ACTIVE', 'RESERVE'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-lg)',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      background: filter === f ? 'var(--color-primary)' : 'var(--color-bg-subtle)',
                      color: filter === f ? '#fff' : 'var(--color-text-secondary)',
                    }}
                  >
                    {f === 'ALL' ? (locale === 'ru' ? 'Все' : 'All') : getStatusLabel(f)}
                  </button>
                ))}
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={locale === 'ru' ? 'Поиск по имени или email...' : 'Search by name or email...'}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.9rem', minWidth: 220 }}
              />
            </div>

            {/* Bulk actions */}
            {stats.pending > 0 && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleBulkAction('approve')}
                  disabled={actionLoading === 'bulk'}
                  style={{ padding: '8px 16px', borderRadius: 'var(--radius-lg)', background: '#22c55e', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  {locale === 'ru' ? `Подтвердить все (${stats.pending})` : `Approve all (${stats.pending})`}
                </button>
                <button
                  onClick={() => handleBulkAction('reserve')}
                  disabled={actionLoading === 'bulk'}
                  style={{ padding: '8px 16px', borderRadius: 'var(--radius-lg)', background: '#3b82f6', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  {locale === 'ru' ? `В резерв (${stats.pending})` : `Move to reserve (${stats.pending})`}
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  disabled={actionLoading === 'bulk'}
                  style={{ padding: '8px 16px', borderRadius: 'var(--radius-lg)', background: '#ef4444', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  {locale === 'ru' ? `Отклонить все (${stats.pending})` : `Reject all (${stats.pending})`}
                </button>
              </div>
            )}

            {/* Participants table */}
            {filteredParticipants.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                {locale === 'ru' ? 'Участники не найдены' : 'No participants found'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredParticipants.map(participant => (
                  <div
                    key={participant.id}
                    style={{
                      display: 'flex',
                      gap: 16,
                      padding: 16,
                      borderRadius: 'var(--radius-xl)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>
                        {participant.user?.name ?? (locale === 'ru' ? 'Без имени' : 'Unnamed')}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {participant.user?.email}
                      </div>
                      {participant.team && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', marginTop: 4 }}>
                          {locale === 'ru' ? 'Команда:' : 'Team:'} {participant.team.name}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {participant.user?.phone && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>📱 {participant.user.phone}</span>
                      )}
                      {participant.user?.city && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>📍 {participant.user.city}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          background: participant.status === 'ACTIVE' ? '#dcfce7' : participant.status === 'PENDING' ? '#fef3c7' : participant.status === 'RESERVE' ? '#dbeafe' : '#fee2e2',
                          color: participant.status === 'ACTIVE' ? '#16a34a' : participant.status === 'PENDING' ? '#d97706' : participant.status === 'RESERVE' ? '#2563eb' : '#dc2626',
                        }}
                      >
                        {getStatusLabel(participant.status)}
                      </span>

                      {participant.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleUpdateStatus(participant.id, 'ACTIVE')}
                            disabled={actionLoading === participant.id}
                            style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: '0.8rem', border: 'none', cursor: 'pointer' }}
                          >
                            {locale === 'ru' ? 'Принять' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(participant.id, 'RESERVE')}
                            disabled={actionLoading === participant.id}
                            style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: '0.8rem', border: 'none', cursor: 'pointer' }}
                          >
                            {locale === 'ru' ? 'Резерв' : 'Reserve'}
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(participant.id, 'REJECTED')}
                            disabled={actionLoading === participant.id}
                            style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: '0.8rem', border: 'none', cursor: 'pointer' }}
                          >
                            {locale === 'ru' ? 'Отклонить' : 'Reject'}
                          </button>
                        </div>
                      )}

                      {(participant.status === 'ACTIVE' || participant.status === 'RESERVE') && (
                        <button
                          onClick={() => handleUpdateStatus(participant.id, 'REMOVED')}
                          disabled={actionLoading === participant.id}
                          style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)', fontWeight: 700, fontSize: '0.8rem', border: '1px solid var(--color-border)', cursor: 'pointer' }}
                        >
                          {locale === 'ru' ? 'Удалить' : 'Remove'}
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedParticipant(selectedParticipant?.id === participant.id ? null : participant)}
                        style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)', fontWeight: 700, fontSize: '0.8rem', border: '1px solid var(--color-border)', cursor: 'pointer' }}
                      >
                        {selectedParticipant?.id === participant.id ? (locale === 'ru' ? 'Скрыть' : 'Hide') : (locale === 'ru' ? 'Анкета' : 'Form')}
                      </button>
                    </div>

                    {selectedParticipant?.id === participant.id && (
                      <div style={{ width: '100%', marginTop: 12, padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-subtle)' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 10 }}>{locale === 'ru' ? 'Ответы на анкету' : 'Form answers'}</div>
                        {Object.keys(participant.answers ?? {}).length === 0 ? (
                          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{locale === 'ru' ? 'Нет ответов' : 'No answers'}</div>
                        ) : (
                          <div style={{ display: 'grid', gap: 8 }}>
                            {Object.entries(participant.answers ?? {}).map(([key, value]) => (
                              <div key={key} style={{ fontSize: '0.85rem' }}>
                                <span style={{ fontWeight: 700 }}>{key}:</span> {String(value)}
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
    </div>
  );
}
