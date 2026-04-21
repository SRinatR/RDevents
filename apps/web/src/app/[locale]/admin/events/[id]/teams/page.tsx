'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import {
  EmptyState,
  FieldInput,
  FieldSelect,
  LoadingLines,
  MetricCard,
  Notice,
  Panel,
  SectionHeader,
  TableShell,
  ToolbarRow,
} from '@/components/ui/signal-primitives';
import {
  EventNotFound,
  EventWorkspaceHeader,
  formatAdminDateTime,
  memberStatusTone,
  type AdminEventRecord,
} from '@/components/admin/AdminEventWorkspace';

const TEAM_STATUS_FILTERS = ['ALL', 'DRAFT', 'ACTIVE', 'PENDING', 'CHANGES_PENDING', 'REJECTED', 'ARCHIVED'] as const;

export default function EventTeamsPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof TEAM_STATUS_FILTERS)[number]>('ALL');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
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
      const [eventResult, teamsResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminApi.listEventTeams(eventId),
      ]);
      setEvent(eventResult.data[0] ?? null);
      setTeams(teamsResult.teams ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load teams');
      setTeams([]);
    } finally {
      setLoadingData(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  const filteredTeams = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return teams.filter((team) => {
      const status = team.status ?? 'ACTIVE';
      const statusMatches = statusFilter === 'ALL' || status === statusFilter;
      const searchMatches = !normalized
        || team.name?.toLowerCase().includes(normalized)
        || team.joinCode?.toLowerCase().includes(normalized)
        || team.captainUser?.name?.toLowerCase().includes(normalized)
        || team.captainUser?.email?.toLowerCase().includes(normalized)
        || team.members?.some((member: any) => member.user?.name?.toLowerCase().includes(normalized)
          || member.user?.email?.toLowerCase().includes(normalized));
      return statusMatches && searchMatches;
    });
  }, [teams, search, statusFilter]);

  const stats = useMemo(() => {
    const activeTeams = teams.filter((team) => (team.status ?? 'ACTIVE') === 'ACTIVE').length;
    const activeMembers = teams.reduce((sum, team) => sum + getTeamMemberCount(team, 'ACTIVE'), 0);
    const pendingMembers = teams.reduce((sum, team) => sum + getTeamMemberCount(team, 'PENDING'), 0);
    const pendingTeamChanges = teams.filter((team) => ['PENDING', 'CHANGES_PENDING'].includes(team.status ?? '') || team.changeRequests?.length).length;
    const slots = teams.reduce((sum, team) => sum + Number(team.maxSize ?? 0), 0);
    return { activeTeams, activeMembers, pendingMembers, pendingTeamChanges, slots };
  }, [teams]);

  async function handleTeamMemberAction(teamId: string, memberUserId: string, action: 'approve' | 'reject' | 'remove') {
    if (!eventId) return;
    const nextActionKey = `${teamId}:${memberUserId}:${action}`;
    setActionKey(nextActionKey);
    setError('');
    setSuccess('');

    try {
      if (action === 'approve') await adminApi.approveEventTeamMember(eventId, teamId, memberUserId);
      if (action === 'reject') await adminApi.rejectEventTeamMember(eventId, teamId, memberUserId);
      if (action === 'remove') await adminApi.removeEventTeamMember(eventId, teamId, memberUserId);
      setSuccess(locale === 'ru' ? 'Состав команды обновлён. Уведомление отправлено.' : 'Team roster updated. Notification sent.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update team member');
    } finally {
      setActionKey(null);
    }
  }

  async function handleTeamChangeRequestAction(teamId: string, requestId: string, action: 'approve' | 'reject') {
    if (!eventId) return;
    const nextActionKey = `${teamId}:${requestId}:${action}`;
    setActionKey(nextActionKey);
    setError('');
    setSuccess('');

    try {
      if (action === 'approve') await adminApi.approveTeamChangeRequest(eventId, teamId, requestId);
      if (action === 'reject') await adminApi.rejectTeamChangeRequest(eventId, teamId, requestId);
      setSuccess(action === 'approve'
        ? (locale === 'ru' ? 'Состояние команды утверждено и зафиксировано.' : 'Team state approved and locked.')
        : (locale === 'ru' ? 'Заявка отклонена. Прежнее состояние команды сохранено.' : 'Request rejected. Previous team state kept.'));
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update team request');
    } finally {
      setActionKey(null);
    }
  }

  async function copyJoinCode(code?: string | null) {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setSuccess(locale === 'ru' ? 'Код команды скопирован.' : 'Team code copied.');
    window.setTimeout(() => setSuccess(''), 2500);
  }

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Команды события' : 'Event teams'}
        subtitle={event?.title}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : (
        <>
          <div className="signal-kpi-grid">
            <MetricCard tone="info" label={locale === 'ru' ? 'Всего команд' : 'Total teams'} value={teams.length} />
            <MetricCard tone="success" label={locale === 'ru' ? 'Активные команды' : 'Active teams'} value={stats.activeTeams} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'Ожидают решения' : 'Pending requests'} value={stats.pendingTeamChanges + stats.pendingMembers} />
            <MetricCard tone="neutral" label={locale === 'ru' ? 'Места в командах' : 'Team slots'} value={`${stats.activeMembers}/${stats.slots || '—'}`} />
          </div>

          <Panel variant="elevated" className="admin-command-panel admin-team-settings-panel">
            <SectionHeader
              title={locale === 'ru' ? 'Параметры командного набора' : 'Team registration settings'}
              subtitle={locale === 'ru' ? 'Как участники создают команды и вступают в них' : 'How participants create and join teams'}
            />
            <div className="admin-team-settings-grid">
              <SettingTile label={locale === 'ru' ? 'Формат' : 'Format'} value={(event as any)?.isTeamBased ? (locale === 'ru' ? 'Командный' : 'Team-based') : (locale === 'ru' ? 'Индивидуальный' : 'Individual')} />
              <SettingTile label={locale === 'ru' ? 'Размер команды' : 'Team size'} value={`${(event as any)?.minTeamSize ?? 1}-${(event as any)?.maxTeamSize ?? 1}`} />
              <SettingTile label={locale === 'ru' ? 'Вступление' : 'Join mode'} value={formatTeamJoinMode((event as any)?.teamJoinMode, locale)} />
              <SettingTile label={locale === 'ru' ? 'Одиночное участие' : 'Solo participation'} value={(event as any)?.allowSoloParticipation ? (locale === 'ru' ? 'Разрешено' : 'Allowed') : (locale === 'ru' ? 'Запрещено' : 'Disabled')} />
              <SettingTile label={locale === 'ru' ? 'Одобрение команд' : 'Team approval'} value={(event as any)?.requireAdminApprovalForTeams ? (locale === 'ru' ? 'Требуется' : 'Required') : (locale === 'ru' ? 'Автоматически' : 'Automatic')} />
            </div>
          </Panel>

          <Panel variant="elevated" className="admin-command-panel admin-data-panel">
            <SectionHeader
              title={locale === 'ru' ? 'Состав команд' : 'Team roster'}
              subtitle={locale === 'ru' ? 'Команды, капитаны, коды и заявки на вступление' : 'Teams, captains, codes, and join requests'}
            />

            <ToolbarRow>
              <FieldInput
                value={search}
                onChange={(inputEvent) => setSearch(inputEvent.target.value)}
                placeholder={locale === 'ru' ? 'Поиск по команде, коду, капитану или участнику' : 'Search team, code, captain, or member'}
                className="admin-filter-search"
              />
              <FieldSelect value={statusFilter} onChange={(selectEvent) => setStatusFilter(selectEvent.target.value as (typeof TEAM_STATUS_FILTERS)[number])} className="admin-filter-select">
                {TEAM_STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>{status === 'ALL' ? (locale === 'ru' ? 'Все статусы' : 'All statuses') : status}</option>
                ))}
              </FieldSelect>
              
            </ToolbarRow>

            {filteredTeams.length === 0 ? (
              <EmptyState
                title={locale === 'ru' ? 'Команд нет' : 'No teams'}
                description={locale === 'ru' ? 'Команды появятся после создания участниками.' : 'Teams will appear after participants create them.'}
              />
            ) : (
              <div className="admin-team-board">
                {filteredTeams.map((team) => {
                  const members = Array.isArray(team.members) ? team.members : [];
                  const activeMembers = members.filter((member: any) => member.status === 'ACTIVE');
                  const pendingMembers = members.filter((member: any) => member.status === 'PENDING');
                  const pendingRequest = Array.isArray(team.changeRequests) ? team.changeRequests[0] : null;
                  const isExpanded = expandedTeamId === team.id;

                  return (
                    <article key={team.id} className="admin-team-card">
                      <header className="admin-team-card-head">
                        <div>
                          <div className="admin-team-title-line">
                            <h3>{team.name}</h3>
                            <StatusPill tone={teamStatusTone(team.status)}>{formatTeamStatus(team.status, locale)}</StatusPill>
                          </div>
                          {team.description ? <p>{team.description}</p> : null}
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}>
                          {isExpanded ? (locale === 'ru' ? 'Свернуть' : 'Collapse') : (locale === 'ru' ? 'Состав' : 'Roster')}
                        </button>
                      </header>

                      <div className="admin-team-meta-grid">
                        <TeamMeta label={locale === 'ru' ? 'Капитан' : 'Captain'} value={team.captainUser?.name || team.captainUser?.email || '—'} subvalue={team.captainUser?.email} />
                        <TeamMeta label={locale === 'ru' ? 'Участники' : 'Members'} value={`${activeMembers.length}/${team.maxSize ?? '—'}`} subvalue={pendingMembers.length ? `${pendingMembers.length} pending` : undefined} />
                        <TeamMeta label={locale === 'ru' ? 'Код' : 'Code'} value={team.joinCode || '—'} action={team.joinCode ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyJoinCode(team.joinCode)}>
                            {locale === 'ru' ? 'Копировать' : 'Copy'}
                          </button>
                        ) : null} />
                        <TeamMeta label={locale === 'ru' ? 'Создана' : 'Created'} value={formatAdminDateTime(team.createdAt, locale)} />
                      </div>

                      {pendingRequest ? (
                        <div className="admin-team-change-panel">
                          <div>
                            <strong>{team.status === 'PENDING' ? (locale === 'ru' ? 'Команда готова к утверждению' : 'Team ready for approval') : (locale === 'ru' ? 'Заявка на изменение команды' : 'Team change request')}</strong>
                            <p>
                              {locale === 'ru' ? 'Инициатор' : 'Requested by'}: {pendingRequest.requestedByUser?.name || pendingRequest.requestedByUser?.email || '—'} · {formatAdminDateTime(pendingRequest.createdAt, locale)}
                            </p>
                          </div>
                          <div className="admin-team-change-grid">
                            <TeamMeta label={locale === 'ru' ? 'Текущее название' : 'Current name'} value={team.name} />
                            <TeamMeta label={locale === 'ru' ? 'Новое название' : 'Proposed name'} value={pendingRequest.proposedName || team.name} />
                            <TeamMeta label={locale === 'ru' ? 'Текущий состав' : 'Current roster'} value={activeMembers.map((member: any) => member.user?.name || member.user?.email || member.userId).join(', ') || '—'} />
                            <TeamMeta label={locale === 'ru' ? 'Новый состав' : 'Proposed roster'} value={describeProposedMembers(team, pendingRequest)} />
                          </div>
                          {pendingRequest.proposedDescription && pendingRequest.proposedDescription !== team.description ? (
                            <p className="admin-team-change-note">{pendingRequest.proposedDescription}</p>
                          ) : null}
                          <div className="admin-team-change-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={actionKey === `${team.id}:${pendingRequest.id}:approve`}
                              onClick={() => void handleTeamChangeRequestAction(team.id, pendingRequest.id, 'approve')}
                            >
                              {locale === 'ru' ? 'Утвердить состояние' : 'Approve state'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={actionKey === `${team.id}:${pendingRequest.id}:reject`}
                              onClick={() => void handleTeamChangeRequestAction(team.id, pendingRequest.id, 'reject')}
                            >
                              {locale === 'ru' ? 'Отклонить' : 'Reject'}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {isExpanded ? (
                        <div className="admin-team-members">
                          {members.length === 0 ? (
                            <EmptyState
                              title={locale === 'ru' ? 'Состав пуст' : 'Roster is empty'}
                              description={locale === 'ru' ? 'У команды пока нет участников.' : 'This team has no members yet.'}
                            />
                          ) : (
                            <TableShell>
                              <table className="signal-table">
                                <thead>
                                  <tr>
                                    <th>{locale === 'ru' ? 'Участник' : 'Member'}</th>
                                    <th>{locale === 'ru' ? 'Роль' : 'Role'}</th>
                                    <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                                    <th>{locale === 'ru' ? 'Вступил' : 'Joined'}</th>
                                    <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {members.map((member: any) => (
                                    <Fragment key={member.id}>
                                      <tr>
                                        <td>
                                          <strong>{member.user?.name || member.user?.email || '—'}</strong>
                                          {member.user?.email ? <div className="signal-muted">{member.user.email}</div> : null}
                                        </td>
                                        <td>{member.role}</td>
                                        <td><StatusPill tone={memberStatusTone(member.status)}>{member.status}</StatusPill></td>
                                        <td className="signal-muted">{formatAdminDateTime(member.joinedAt, locale)}</td>
                                        <td className="right">
                                          <div className="signal-row-actions">
                                            {member.status === 'PENDING' ? (
                                              <>
                                                <button
                                                  type="button"
                                                  className="btn btn-primary btn-sm"
                                                  disabled={actionKey === `${team.id}:${member.userId}:approve`}
                                                  onClick={() => void handleTeamMemberAction(team.id, member.userId, 'approve')}
                                                >
                                                  {locale === 'ru' ? 'Принять' : 'Approve'}
                                                </button>
                                                <button
                                                  type="button"
                                                  className="btn btn-danger btn-sm"
                                                  disabled={actionKey === `${team.id}:${member.userId}:reject`}
                                                  onClick={() => void handleTeamMemberAction(team.id, member.userId, 'reject')}
                                                >
                                                  {locale === 'ru' ? 'Отклонить' : 'Reject'}
                                                </button>
                                              </>
                                            ) : null}
                                            {member.status === 'ACTIVE' && member.role !== 'CAPTAIN' ? (
                                              <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                disabled={actionKey === `${team.id}:${member.userId}:remove`}
                                                onClick={() => void handleTeamMemberAction(team.id, member.userId, 'remove')}
                                              >
                                                {locale === 'ru' ? 'Удалить' : 'Remove'}
                                              </button>
                                            ) : null}
                                          </div>
                                        </td>
                                      </tr>
                                    </Fragment>
                                  ))}
                                </tbody>
                              </table>
                            </TableShell>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function SettingTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-team-setting-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TeamMeta({
  label,
  value,
  subvalue,
  action,
}: {
  label: string;
  value: string;
  subvalue?: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-team-meta-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      {subvalue ? <small>{subvalue}</small> : null}
      {action}
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: ReactNode;
}) {
  return <span className={`signal-status-pill tone-${tone}`}>{children}</span>;
}

function getTeamMemberCount(team: any, status: string) {
  if (Array.isArray(team.members)) {
    return team.members.filter((member: any) => member.status === status).length;
  }
  if (status === 'ACTIVE') return Number(team._count?.members ?? 0);
  return 0;
}

function describeProposedMembers(team: any, request: any) {
  const namesByUserId = new Map<string, string>();
  for (const member of team.members ?? []) {
    namesByUserId.set(member.userId, member.user?.name || member.user?.email || member.userId);
  }
  if (request.requestedByUserId && request.requestedByUser) {
    namesByUserId.set(request.requestedByUserId, request.requestedByUser.name || request.requestedByUser.email || request.requestedByUserId);
  }
  const proposed = Array.isArray(request.proposedMemberUserIds) ? request.proposedMemberUserIds : [];
  return proposed.map((userId: string) => namesByUserId.get(userId) ?? userId).join(', ') || '—';
}

function teamStatusTone(status?: string | null): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (!status || status === 'ACTIVE') return 'success';
  if (status === 'DRAFT' || status === 'PENDING' || status === 'CHANGES_PENDING') return 'warning';
  if (status === 'REJECTED') return 'danger';
  if (status === 'ARCHIVED') return 'neutral';
  return 'info';
}

function formatTeamStatus(status: string | null | undefined, locale: string) {
  const ru: Record<string, string> = {
    DRAFT: 'Черновик',
    ACTIVE: 'Утверждена',
    PENDING: 'На утверждении',
    CHANGES_PENDING: 'Изменения на утверждении',
    REJECTED: 'Отклонена',
    ARCHIVED: 'Архив',
  };
  const en: Record<string, string> = {
    DRAFT: 'Draft',
    ACTIVE: 'Approved',
    PENDING: 'Pending approval',
    CHANGES_PENDING: 'Changes pending',
    REJECTED: 'Rejected',
    ARCHIVED: 'Archived',
  };
  return (locale === 'ru' ? ru : en)[status ?? ''] ?? (status ?? '—');
}

function formatTeamJoinMode(value: string | null | undefined, locale: string) {
  if (value === 'BY_CODE') return locale === 'ru' ? 'По коду' : 'By code';
  if (value === 'BY_REQUEST') return locale === 'ru' ? 'По заявке' : 'By request';
  if (value === 'EMAIL_INVITE') return locale === 'ru' ? 'Email-приглашения' : 'Email invites';
  return locale === 'ru' ? 'Открыто' : 'Open';
}
