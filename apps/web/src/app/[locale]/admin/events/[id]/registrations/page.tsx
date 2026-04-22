'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, MetricCard, Notice, Panel, SectionHeader, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, formatAdminDateTime, memberStatusTone, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

const STATUS_FILTERS = ['ALL', 'PENDING', 'ACTIVE', 'RESERVE', 'REJECTED', 'CANCELLED', 'REMOVED'] as const;

export default function EventRegistrationsPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
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
      const [eventResult, membersResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminApi.listEventMembers(eventId),
      ]);
      setEvent(eventResult.data[0] ?? null);
      setMembers((membersResult.members ?? []).filter((member: any) => member.role === 'PARTICIPANT'));
    } catch (err: any) {
      setError(err.message || 'Failed to load registrations');
      setMembers([]);
    } finally {
      setLoadingData(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  const requiredEventFields = useMemo(() => {
    const value = (event as any)?.requiredEventFields;
    return Array.isArray(value) ? value.map(String) : [];
  }, [event]);

  const filteredMembers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return members.filter((member) => {
      const statusMatches = statusFilter === 'ALL' || member.status === statusFilter;
      const searchMatches = !normalized
        || member.user?.name?.toLowerCase().includes(normalized)
        || member.user?.email?.toLowerCase().includes(normalized)
        || Object.values(member.answers ?? {}).some((value) => String(value).toLowerCase().includes(normalized));
      return statusMatches && searchMatches;
    });
  }, [members, statusFilter, search]);

  const completenessMemo = useMemo(() => {
    if (requiredEventFields.length === 0) return () => 100;
    return (member: any) => {
      const answers = member.answers ?? {};
      const filled = requiredEventFields.filter((field) => {
        const value = answers[field];
        return value !== undefined && value !== null && String(value).trim() !== '';
      }).length;
      return Math.round((filled / requiredEventFields.length) * 100);
    };
  }, [requiredEventFields]);

  const stats = useMemo(() => ({
    total: members.length,
    pending: members.filter((member) => member.status === 'PENDING').length,
    complete: members.filter((member) => completenessMemo(member) === 100).length,
    incomplete: members.filter((member) => completenessMemo(member) < 100).length,
  }), [members, completenessMemo]);

  const updateStatus = async (memberId: string, nextStatus: 'ACTIVE' | 'RESERVE' | 'REJECTED' | 'REMOVED') => {
    if (!eventId) return;
    setActionId(memberId);
    setError('');
    setSuccess('');

    try {
      await adminApi.updateParticipantStatus(eventId, memberId, { status: nextStatus });
      setSuccess(locale === 'ru' ? 'Заявка обновлена.' : 'Registration updated.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update registration');
    } finally {
      setActionId(null);
    }
  };

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Регистрации' : 'Registrations'}
        subtitle={locale === 'ru' ? 'Заявки, анкеты и полнота required fields' : 'Applications, answers, and required field completeness'}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : (
        <>
          <div className="signal-kpi-grid">
            <MetricCard tone="info" label={locale === 'ru' ? 'Всего заявок' : 'Total applications'} value={stats.total} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'На модерации' : 'Pending'} value={stats.pending} />
            <MetricCard tone="success" label={locale === 'ru' ? 'Полные анкеты' : 'Complete forms'} value={stats.complete} />
            <MetricCard tone="danger" label={locale === 'ru' ? 'Есть пропуски' : 'Incomplete'} value={stats.incomplete} />
          </div>

          <Panel variant="elevated" className="admin-command-panel admin-data-panel">
            <SectionHeader title={locale === 'ru' ? 'Журнал регистраций' : 'Registration journal'} subtitle={locale === 'ru' ? 'Все заявки выбранного события с ответами анкеты' : 'All selected-event applications with form answers'} />

            <ToolbarRow>
              <FieldInput
                value={search}
                onChange={(inputEvent) => setSearch(inputEvent.target.value)}
                placeholder={locale === 'ru' ? 'Поиск по участнику или ответам' : 'Search participant or answers'}
                className="admin-filter-search"
              />
              <FieldSelect value={statusFilter} onChange={(selectEvent) => setStatusFilter(selectEvent.target.value as (typeof STATUS_FILTERS)[number])} className="admin-filter-select">
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>{status === 'ALL' ? (locale === 'ru' ? 'Все статусы' : 'All statuses') : status}</option>
                ))}
              </FieldSelect>
              
            </ToolbarRow>

            {filteredMembers.length === 0 ? (
              <EmptyState
                title={locale === 'ru' ? 'Регистрации не найдены' : 'No registrations found'}
                description={locale === 'ru' ? 'Измените фильтры или дождитесь новых заявок.' : 'Adjust filters or wait for new applications.'}
              />
            ) : (
              <TableShell>
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>{locale === 'ru' ? 'Заявитель' : 'Applicant'}</th>
                      <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                      <th>{locale === 'ru' ? 'Анкета' : 'Form'}</th>
                      <th>{locale === 'ru' ? 'Дата' : 'Date'}</th>
                      <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => {
                      const percent = completeness(member);
                      return (
                        <Fragment key={member.id}>
                          <tr>
                            <td>
                              <strong>{member.user?.name ?? member.user?.email ?? '—'}</strong>
                              <div className="signal-muted">{member.user?.email}</div>
                            </td>
                            <td>
                              <StatusBadge tone={memberStatusTone(member.status)}>
                                {member.status}
                              </StatusBadge>
                            </td>
                            <td>
                              <StatusBadge tone={percent === 100 ? 'success' : 'warning'}>
                                {percent === 100 ? '100%' : `${percent}%`}
                              </StatusBadge>
                            </td>
                            <td className="signal-muted">{formatAdminDateTime(member.assignedAt, locale)}</td>
                            <td className="right">
                              <div className="signal-row-actions">
                                {member.status === 'PENDING' ? (
                                  <>
                                    <button type="button" className="btn btn-primary btn-sm" disabled={actionId === member.id} onClick={() => updateStatus(member.id, 'ACTIVE')}>{locale === 'ru' ? 'Принять' : 'Approve'}</button>
                                    <button type="button" className="btn btn-secondary btn-sm" disabled={actionId === member.id} onClick={() => updateStatus(member.id, 'RESERVE')}>{locale === 'ru' ? 'Резерв' : 'Reserve'}</button>
                                    <button type="button" className="btn btn-danger btn-sm" disabled={actionId === member.id} onClick={() => updateStatus(member.id, 'REJECTED')}>{locale === 'ru' ? 'Отклонить' : 'Reject'}</button>
                                  </>
                                ) : member.status === 'ACTIVE' || member.status === 'RESERVE' || member.status === 'REJECTED' || member.status === 'PENDING' ? (
                                  <button type="button" className="btn btn-ghost btn-sm" disabled={actionId === member.id} onClick={() => updateStatus(member.id, 'REMOVED')}>{locale === 'ru' ? 'Удалить' : 'Remove'}</button>
                                ) : null}
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpandedId(expandedId === member.id ? null : member.id)}>
                                  {expandedId === member.id ? (locale === 'ru' ? 'Скрыть' : 'Hide') : (locale === 'ru' ? 'Ответы' : 'Answers')}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedId === member.id ? (
                            <tr className="admin-expanded-row">
                              <td colSpan={5}>
                                {Object.keys(member.answers ?? {}).length === 0 ? (
                                  <span className="signal-muted">{locale === 'ru' ? 'Ответов анкеты нет.' : 'No form answers.'}</span>
                                ) : (
                                  <div className="admin-answer-grid">
                                    {Object.entries(member.answers ?? {}).map(([key, value]) => (
                                      <div key={key}>
                                        <small>{key}</small>
                                        <strong>{String(value)}</strong>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
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
