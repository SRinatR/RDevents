'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi, adminExportsApi, type ExportDownloadFormat } from '@/lib/api';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, MetricCard, Notice, Panel, SectionHeader, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
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
  };
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [exportFilters, setExportFilters] = useState({ includeRejected: true, includeCancelled: true, includeRemoved: false });
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
      setParticipants((membersResult.members ?? []).filter((member: ParticipantMember) => member.role === 'PARTICIPANT' && member.status === 'ACTIVE'));
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
        || participant.user?.email?.toLowerCase().includes(normalized)
        || participant.user?.city?.toLowerCase().includes(normalized);
      return searchMatches;
    });
  }, [participants, search]);

  const stats = useMemo(() => ({
    total: participants.length,
    active: participants.length,
  }), [participants]);

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
            <MetricCard tone="info" label={locale === 'ru' ? 'Всего в ростере' : 'Roster total'} value={stats.total} />
          </div>

          <Panel variant="elevated" className="admin-command-panel admin-data-panel">
            <SectionHeader title={locale === 'ru' ? 'Список участников' : 'Participant list'} subtitle={locale === 'ru' ? 'Ростер подтверждённых участников выбранного события' : 'Roster of approved participants for the selected event'} />

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
                      <th>{locale === 'ru' ? 'Участник' : 'Participant'}</th>
                      <th>{locale === 'ru' ? 'Город' : 'City'}</th>
                      <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                      <th>{locale === 'ru' ? 'Дата' : 'Date'}</th>
                      <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((participant) => (
                      <Fragment key={participant.id}>
                        <tr>
                          <td>
                            <strong>{participant.user?.name ?? participant.user?.email ?? '—'}</strong>
                            <div className="signal-muted">{participant.user?.email}</div>
                          </td>
                          <td>{participant.user?.city ?? '—'}</td>
                          <td>{locale === 'ru' ? 'Подтверждён' : 'Approved'}</td>
                          <td className="signal-muted">{formatAdminDateTime(participant.assignedAt, locale)}</td>
                          <td className="right">
                            <div className="signal-row-actions">
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpandedId(expandedId === participant.id ? null : participant.id)}>
                                {expandedId === participant.id ? (locale === 'ru' ? 'Скрыть' : 'Hide') : (locale === 'ru' ? 'Анкета' : 'Form')}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedId === participant.id ? (
                          <tr key={`${participant.id}-answers`} className="admin-expanded-row">
                            <td colSpan={5}>
                              {participant.answers && Object.keys(participant.answers).length > 0 ? (
                                <div className="admin-answer-grid">
                                  {Object.entries(participant.answers).map(([key, value]) => (
                                    <div key={key}>
                                      <small>{key}</small>
                                      <strong>{String(value)}</strong>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="signal-muted">{locale === 'ru' ? 'Ответов анкеты пока нет.' : 'No form answers yet.'}</span>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
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
