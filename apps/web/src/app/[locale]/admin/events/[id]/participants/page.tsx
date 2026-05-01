'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi, adminExportsApi, type ExportDownloadFormat } from '@/lib/api';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, MetricCard, Notice, Panel, SectionHeader, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, formatAdminDateTime, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

type ParticipantMember = {
  id: string;
  role: string;
  status: string;
  answers?: Record<string, unknown> | null;
  assignedAt?: string;
  updatedAt?: string;
  notes?: string | null;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    city?: string | null;
    avatarUrl?: string | null;
    phone?: string | null;
    telegram?: string | null;
    fullNameCyrillic?: string | null;
    fullNameLatin?: string | null;
  };
  teamMembership?: {
    role: string;
    status: string;
    team: {
      id: string;
      name: string;
      status: string;
    };
  } | null;
};

export default function EventParticipantsPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [participants, setParticipants] = useState<ParticipantMember[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const exportFilters = useMemo(() => ({ includeRejected: true, includeCancelled: true, includeRemoved: false }), []);
  const [exportFormat, setExportFormat] = useState<ExportDownloadFormat>('xlsx');

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
      setParticipants((membersResult.members ?? []).filter((member: ParticipantMember) => member.role === 'PARTICIPANT'));
    } catch (err: any) {
      setError(err.message || 'Failed to load participants');
      setParticipants([]);
    } finally {
      setLoadingData(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  const filteredParticipants = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return participants.filter((participant) => {
      const searchMatches = !normalized
        || participant.user?.name?.toLowerCase().includes(normalized)
        || participant.user?.fullNameCyrillic?.toLowerCase().includes(normalized)
        || participant.user?.fullNameLatin?.toLowerCase().includes(normalized)
        || participant.user?.email?.toLowerCase().includes(normalized)
        || participant.user?.city?.toLowerCase().includes(normalized)
        || participant.teamMembership?.team.name.toLowerCase().includes(normalized);
      return searchMatches;
    });
  }, [participants, search]);

  const stats = useMemo(() => ({
    total: participants.length,
    active: participants.filter((participant) => participant.status === 'ACTIVE').length,
    pending: participants.filter((participant) => participant.status === 'PENDING').length,
    inTeams: participants.filter((participant) => participant.teamMembership).length,
  }), [participants]);
  const isTeamBased = Boolean((event as any)?.isTeamBased) || participants.some((participant) => participant.teamMembership);

  function openParticipantProfile(participant: ParticipantMember) {
    if (!eventId || !participant.user?.id) return;
    router.push(`/${locale}/admin/users/${participant.user.id}?eventId=${eventId}`);
  }

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Участники события' : 'Event participants'}
        subtitle={event?.title}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : (
        <>
          <div className="signal-kpi-grid">
            <MetricCard tone="success" label={locale === 'ru' ? 'Подтверждены' : 'Approved'} value={stats.active} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'На рассмотрении' : 'Pending'} value={stats.pending} />
            <MetricCard tone="info" label={locale === 'ru' ? 'В командах' : 'In teams'} value={stats.inTeams} />
            <MetricCard tone="neutral" label={locale === 'ru' ? 'Всего участников' : 'Participants total'} value={stats.total} />
          </div>

          <Panel variant="elevated" className="admin-command-panel admin-data-panel">
            <SectionHeader title={locale === 'ru' ? 'Участники этого мероприятия' : 'Participants for this event'} subtitle={locale === 'ru' ? 'Клик по строке открывает полный профиль участника в контексте мероприятия' : 'Click a row to open the full participant profile in this event context'} />

            <ToolbarRow>
              <FieldInput
                value={search}
                onChange={(inputEvent) => setSearch(inputEvent.target.value)}
                placeholder={locale === 'ru' ? 'Поиск по имени, email или городу' : 'Search by name, email, or city'}
                className="admin-filter-search"
              />
              <div className="export-actions">
                <FieldSelect
                  value={exportFormat}
                  onChange={(inputEvent) => setExportFormat(inputEvent.target.value as ExportDownloadFormat)}
                  className="admin-filter-select"
                  aria-label={locale === 'ru' ? 'Формат выгрузки' : 'Export format'}
                >
                  <option value="xlsx">XLSX</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </FieldSelect>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (!eventId) return;
                    adminExportsApi.downloadParticipants(eventId, exportFormat, exportFilters);
                  }}
                >
                  {locale === 'ru' ? 'Выгрузить участников' : 'Export participants'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    if (!eventId) return;
                    adminExportsApi.downloadAvatarBundle(eventId);
                  }}
                >
                  {locale === 'ru' ? 'Скачать фото ZIP' : 'Download photos ZIP'}
                </button>
              </div>
            </ToolbarRow>

            {filteredParticipants.length === 0 ? (
              <EmptyState
                title={locale === 'ru' ? 'Участники не найдены' : 'No participants found'}
                description={locale === 'ru' ? 'Ростер обновится после одобрения заявок.' : 'Roster updates after applications are approved.'}
              />
            ) : (
              <TableShell>
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>{locale === 'ru' ? 'Фото' : 'Photo'}</th>
                      <th>{locale === 'ru' ? 'Участник' : 'Participant'}</th>
                      {isTeamBased ? <th>{locale === 'ru' ? 'Команда' : 'Team'}</th> : null}
                      {isTeamBased ? <th>{locale === 'ru' ? 'Статус в команде' : 'Team status'}</th> : null}
                      <th>{locale === 'ru' ? 'Участие' : 'Participation'}</th>
                      <th>{locale === 'ru' ? 'Город' : 'City'}</th>
                      <th>{locale === 'ru' ? 'Контакты' : 'Contacts'}</th>
                      <th>{locale === 'ru' ? 'Дата' : 'Date'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((participant) => {
                      const displayName = participant.user?.fullNameCyrillic || participant.user?.fullNameLatin || participant.user?.name || participant.user?.email || '—';
                      const initials = displayName.slice(0, 2).toUpperCase();
                      return (
                        <tr
                          key={participant.id}
                          className="admin-clickable-row"
                          tabIndex={0}
                          onClick={() => openParticipantProfile(participant)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openParticipantProfile(participant);
                            }
                          }}
                        >
                          <td>
                            <span className="signal-avatar">
                              {participant.user?.avatarUrl ? <Image src={participant.user.avatarUrl} alt="" width={32} height={32} /> : initials}
                            </span>
                          </td>
                          <td>
                            <strong>{displayName}</strong>
                            <div className="signal-muted">{participant.user?.email}</div>
                          </td>
                          {isTeamBased ? (
                            <td>
                              <strong>{participant.teamMembership?.team.name ?? '—'}</strong>
                              {participant.teamMembership?.team.status ? <div className="signal-muted">{participant.teamMembership.team.status}</div> : null}
                            </td>
                          ) : null}
                          {isTeamBased ? (
                            <td>
                              {participant.teamMembership ? (
                                <div className="signal-row-actions">
                                  <StatusBadge tone={participant.teamMembership.role === 'CAPTAIN' ? 'warning' : 'info'}>{participant.teamMembership.role}</StatusBadge>
                                  <StatusBadge tone={statusTone(participant.teamMembership.status)}>{participant.teamMembership.status}</StatusBadge>
                                </div>
                              ) : '—'}
                            </td>
                          ) : null}
                          <td><StatusBadge tone={statusTone(participant.status)}>{participant.status}</StatusBadge></td>
                          <td>{participant.user?.city ?? '—'}</td>
                          <td>
                            <div>{participant.user?.phone ?? '—'}</div>
                            {participant.user?.telegram ? <div className="signal-muted">{participant.user.telegram}</div> : null}
                          </td>
                          <td className="signal-muted">{formatAdminDateTime(participant.assignedAt, locale)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableShell>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'ACTIVE' || status === 'APPROVED') return 'success';
  if (status === 'PENDING' || status === 'SUBMITTED' || status === 'CHANGES_PENDING') return 'warning';
  if (status === 'RESERVE') return 'info';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger';
  return 'neutral';
}
