'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import {
  EmptyState,
  FieldInput,
  FieldSelect,
  FieldTextarea,
  LoadingLines,
  Notice,
  PageHeader,
  Panel,
  SectionHeader,
  StatusBadge,
  TableShell,
} from '@/components/ui/signal-primitives';

const teamStatuses = ['DRAFT', 'ACTIVE', 'APPROVED', 'PENDING', 'SUBMITTED', 'CHANGES_PENDING', 'NEEDS_ATTENTION', 'REJECTED', 'ARCHIVED'];
const memberStatuses = ['PENDING', 'ACTIVE', 'REJECTED', 'REMOVED', 'LEFT'] as const;

type TeamMemberStatus = typeof memberStatuses[number];
type TeamRole = 'CAPTAIN' | 'MEMBER';

export default function AdminTeamDetailsPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';
  const params = useParams();
  const teamId = params?.teamId as string;

  const [team, setTeam] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    status: 'ACTIVE',
    maxSize: 5,
    captainUserId: '',
  });
  const [memberForm, setMemberForm] = useState({
    emailOrId: '',
    role: 'MEMBER' as TeamRole,
    status: 'ACTIVE' as TeamMemberStatus,
    reason: '',
  });
  const [replaceForm, setReplaceForm] = useState({
    oldUserId: '',
    newUserRef: '',
    reason: '',
  });
  const [rosterForm, setRosterForm] = useState({
    memberUserIds: '',
    captainUserId: '',
    reason: '',
  });

  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    setLoadingData(true);
    try {
      const res = await adminApi.getTeam(teamId);
      const nextTeam = res.data;
      setTeam(nextTeam);
      setEditForm({
        name: nextTeam.name ?? '',
        description: nextTeam.description ?? '',
        status: nextTeam.status ?? 'ACTIVE',
        maxSize: nextTeam.maxSize ?? 5,
        captainUserId: nextTeam.captainUserId ?? '',
      });
      setRosterForm({
        memberUserIds: (nextTeam.members ?? [])
          .filter((member: any) => ['ACTIVE', 'PENDING'].includes(member.status))
          .map((member: any) => member.userId)
          .join('\n'),
        captainUserId: nextTeam.captainUserId ?? '',
        reason: '',
      });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
      setTeam(null);
    } finally {
      setLoadingData(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push(`/${locale}`);
    }
  }, [loading, user, isAdmin, router, locale]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const runTeamMutation = async (action: () => Promise<{ data: any }>, successText: string) => {
    setSaving(true);
    setNotice('');
    try {
      const res = await action();
      setTeam(res.data);
      setEditForm((current) => ({
        ...current,
        name: res.data.name ?? current.name,
        description: res.data.description ?? '',
        status: res.data.status ?? current.status,
        maxSize: res.data.maxSize ?? current.maxSize,
        captainUserId: res.data.captainUserId ?? current.captainUserId,
      }));
      setNotice(successText);
    } catch (err) {
      setError(err instanceof Error ? err.message : (isRu ? 'Действие не выполнено' : 'Action failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTeam = async () => {
    const reason = window.prompt(isRu ? 'Причина изменения карточки команды (необязательно)' : 'Reason for updating the team card (optional)')?.trim() || undefined;
    await runTeamMutation(
      () => adminApi.updateTeam(team.id, {
        name: editForm.name,
        description: editForm.description || null,
        status: editForm.status,
        maxSize: editForm.maxSize,
        captainUserId: editForm.captainUserId || undefined,
        reason,
      }),
      isRu ? 'Команда обновлена' : 'Team updated',
    );
  };

  const handleAddMember = async () => {
    const value = memberForm.emailOrId.trim();
    if (!value) return;

    await runTeamMutation(
      () => adminApi.addTeamMember(team.id, {
        ...(value.includes('@') ? { email: value } : { userId: value }),
        role: memberForm.role,
        status: memberForm.status,
        reason: memberForm.reason || undefined,
      }),
      isRu ? 'Участник добавлен' : 'Member added',
    );
    setMemberForm((current) => ({ ...current, emailOrId: '', reason: '' }));
  };

  const handleMemberStatus = async (member: any, status: TeamMemberStatus) => {
    await runTeamMutation(
      () => adminApi.updateTeamMember(team.id, member.userId, { status }),
      isRu ? 'Статус участника обновлён' : 'Member status updated',
    );
  };

  const handleTransferCaptain = async (member: any) => {
    if (member.userId === team.captainUserId) return;
    if (!confirm(isRu ? 'Передать капитана этому участнику?' : 'Transfer captain to this member?')) return;
    const reason = window.prompt(isRu ? 'Причина смены капитана' : 'Reason for captain transfer')?.trim() || '';
    if (!reason) return;

    await runTeamMutation(
      () => adminApi.transferTeamCaptain(team.id, member.userId, reason),
      isRu ? 'Капитан переназначен' : 'Captain transferred',
    );
  };

  const handleRemoveMember = async (member: any) => {
    if (!confirm(isRu ? 'Убрать участника из команды?' : 'Remove member from team?')) return;
    const reason = window.prompt(isRu ? 'Причина удаления участника' : 'Reason for member removal')?.trim() || '';
    if (!reason) return;

    await runTeamMutation(
      () => adminApi.removeTeamMember(team.id, member.userId, reason),
      isRu ? 'Участник убран из команды' : 'Member removed',
    );
  };

  const handleReplaceMember = async (member: any) => {
    const nextUserRef = window.prompt(isRu ? 'Новый User ID или email' : 'New user ID or email')?.trim() || '';
    if (!nextUserRef) return;
    const reason = window.prompt(isRu ? 'Причина замены' : 'Reason for replacement')?.trim() || '';
    if (!reason) return;

    await runTeamMutation(
      () => adminApi.replaceTeamMember(team.id, {
        oldUserId: member.userId,
        ...(nextUserRef.includes('@') ? { newUserEmail: nextUserRef } : { newUserId: nextUserRef }),
        reason,
      }),
      isRu ? 'Участник заменён' : 'Member replaced',
    );
  };

  const handleReplaceRoster = async () => {
    const memberUserIds = rosterForm.memberUserIds
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (memberUserIds.length === 0 || !rosterForm.reason.trim()) return;

    await runTeamMutation(
      () => adminApi.replaceTeamRoster(team.id, {
        memberUserIds,
        captainUserId: rosterForm.captainUserId.trim() || undefined,
        name: editForm.name,
        description: editForm.description || null,
        status: editForm.status,
        reason: rosterForm.reason.trim(),
      }),
      isRu ? 'Состав команды полностью заменён' : 'Team roster replaced',
    );
    setRosterForm((current) => ({ ...current, reason: '' }));
  };

  const handleArchiveTeam = async () => {
    if (!confirm(isRu ? 'Архивировать команду?' : 'Archive this team?')) return;

    await runTeamMutation(
      () => adminApi.archiveTeam(team.id),
      isRu ? 'Команда архивирована' : 'Team archived',
    );
  };

  if (loading || !user || !isAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (loadingData) {
    return (
      <div className="signal-page-shell admin-control-page">
        <LoadingLines rows={8} />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="signal-page-shell admin-control-page">
        <EmptyState title={isRu ? 'Команда не найдена' : 'Team not found'} description={error || (isRu ? 'Нет данных' : 'No data')} />
      </div>
    );
  }

  return (
    <div className="signal-page-shell admin-control-page admin-team-detail-page">
      <div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => router.push(`/${locale}/admin/teams`)}
        >
          {isRu ? 'Назад к списку' : 'Back to list'}
        </button>
      </div>

      <PageHeader
        title={team.name}
        subtitle={team.event?.title || (isRu ? 'Команда' : 'Team')}
        actions={<div className="signal-row-actions">
          <StatusBadge tone={toneByStatus(team.status)}>{formatTeamStatus(team.status, locale)}</StatusBadge>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/${locale}/admin/email/broadcasts/new?audienceSource=event_teams&eventId=${team.eventId}&teamId=${team.id}&teamRoles=CAPTAIN,MEMBER`)}>{isRu ? 'Письмо команде' : 'Email team'}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/${locale}/admin/email/broadcasts/new?audienceSource=event_teams&eventId=${team.eventId}&teamId=${team.id}&teamRoles=CAPTAIN`)}>{isRu ? 'Письмо капитану' : 'Email captain'}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => location.hash = '#team-members'}>{isRu ? 'Проверить фото' : 'Check photos'}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => location.hash = '#team-history'}>{isRu ? 'История' : 'Team history'}</button>
        </div>}
      />

      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <div className="admin-team-detail-grid">
        <Panel id="team-card" variant="elevated">
          <SectionHeader
            title={isRu ? 'Карточка команды' : 'Team card'}
            subtitle={isRu ? 'Название, статус, лимит и капитан управляются админом напрямую.' : 'Name, status, capacity and captain are controlled directly by admins.'}
          />
          <div className="admin-team-form-grid">
            <label>
              <span>{isRu ? 'Название' : 'Name'}</span>
              <FieldInput value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
            </label>
            <label>
              <span>{isRu ? 'Статус' : 'Status'}</span>
              <FieldSelect value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>
                {teamStatuses.map((status) => <option key={status} value={status}>{formatTeamStatus(status, locale)}</option>)}
              </FieldSelect>
            </label>
            <label>
              <span>{isRu ? 'Максимум участников' : 'Max members'}</span>
              <FieldInput
                type="number"
                min={1}
                max={200}
                value={editForm.maxSize}
                onChange={(event) => setEditForm({ ...editForm, maxSize: Number(event.target.value) || 1 })}
              />
            </label>
            <label>
              <span>{isRu ? 'ID капитана' : 'Captain ID'}</span>
              <FieldInput value={editForm.captainUserId} onChange={(event) => setEditForm({ ...editForm, captainUserId: event.target.value })} />
            </label>
            <label className="admin-team-form-wide">
              <span>{isRu ? 'Описание' : 'Description'}</span>
              <FieldTextarea value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} />
            </label>
          </div>
          <div className="signal-row-actions admin-team-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={() => void handleSaveTeam()}>
              {saving ? (isRu ? 'Сохраняем...' : 'Saving...') : (isRu ? 'Сохранить' : 'Save')}
            </button>
            {team.status !== 'ARCHIVED' ? (
              <button type="button" className="btn btn-danger btn-sm" disabled={saving} onClick={() => void handleArchiveTeam()}>
                {isRu ? 'Архивировать' : 'Archive'}
              </button>
            ) : null}
          </div>
        </Panel>

        <Panel id="add-member" variant="elevated">
          <SectionHeader title={isRu ? 'Добавить участника' : 'Add member'} />
          <div className="admin-team-member-form">
            <FieldInput
              value={memberForm.emailOrId}
              onChange={(event) => setMemberForm({ ...memberForm, emailOrId: event.target.value })}
              placeholder={isRu ? 'Email или User ID' : 'Email or User ID'}
            />
            <FieldSelect value={memberForm.role} onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value as TeamRole })}>
              <option value="MEMBER">{isRu ? 'Участник' : 'Member'}</option>
              <option value="CAPTAIN">{isRu ? 'Капитан' : 'Captain'}</option>
            </FieldSelect>
            <FieldSelect value={memberForm.status} onChange={(event) => setMemberForm({ ...memberForm, status: event.target.value as TeamMemberStatus })}>
              {memberStatuses.map((status) => <option key={status} value={status}>{formatMemberStatus(status, locale)}</option>)}
            </FieldSelect>
            <FieldInput
              value={memberForm.reason}
              onChange={(event) => setMemberForm({ ...memberForm, reason: event.target.value })}
              placeholder={isRu ? 'Причина' : 'Reason'}
            />
            <button type="button" className="btn btn-primary btn-sm" disabled={saving || !memberForm.emailOrId.trim()} onClick={() => void handleAddMember()}>
              {isRu ? 'Добавить' : 'Add'}
            </button>
          </div>
        </Panel>
      </div>

      <div className="admin-team-detail-grid">
        <Panel id="replace-member" variant="elevated">
          <SectionHeader
            title={isRu ? 'Заменить участника' : 'Replace member'}
            subtitle={isRu ? 'Для direct admin override: старый участник снимается, новый активируется.' : 'Direct admin override removes the old member and activates the new one.'}
          />
          <div className="admin-team-member-form">
            <FieldSelect value={replaceForm.oldUserId} onChange={(event) => setReplaceForm({ ...replaceForm, oldUserId: event.target.value })}>
              <option value="">{isRu ? 'Выберите участника' : 'Select member'}</option>
              {(team.members || [])
                .filter((member: any) => member.role !== 'CAPTAIN' && ['ACTIVE', 'PENDING'].includes(member.status))
                .map((member: any) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user?.name || member.user?.email || member.userId}
                  </option>
                ))}
            </FieldSelect>
            <FieldInput
              value={replaceForm.newUserRef}
              onChange={(event) => setReplaceForm({ ...replaceForm, newUserRef: event.target.value })}
              placeholder={isRu ? 'Новый User ID или email' : 'New user ID or email'}
            />
            <FieldInput
              value={replaceForm.reason}
              onChange={(event) => setReplaceForm({ ...replaceForm, reason: event.target.value })}
              placeholder={isRu ? 'Причина замены' : 'Reason'}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={saving || !replaceForm.oldUserId || !replaceForm.newUserRef.trim() || !replaceForm.reason.trim()}
              onClick={() => void (async () => {
                await runTeamMutation(
                  () => adminApi.replaceTeamMember(team.id, {
                    oldUserId: replaceForm.oldUserId,
                    ...(replaceForm.newUserRef.includes('@') ? { newUserEmail: replaceForm.newUserRef.trim() } : { newUserId: replaceForm.newUserRef.trim() }),
                    reason: replaceForm.reason.trim(),
                  }),
                  isRu ? 'Участник заменён' : 'Member replaced',
                );
                setReplaceForm({ oldUserId: '', newUserRef: '', reason: '' });
              })()}
            >
              {isRu ? 'Заменить' : 'Replace'}
            </button>
          </div>
        </Panel>

        <Panel id="replace-roster" variant="elevated">
          <SectionHeader
            title={isRu ? 'Полностью заменить состав' : 'Replace full roster'}
            subtitle={isRu ? 'Один User ID на строку. Капитан должен входить в список.' : 'Use one user ID per line. The captain must be included in the list.'}
          />
          <div className="signal-stack">
            <FieldTextarea
              rows={6}
              value={rosterForm.memberUserIds}
              onChange={(event) => setRosterForm({ ...rosterForm, memberUserIds: event.target.value })}
              placeholder={isRu ? 'userId-1\\nuserId-2\\nuserId-3' : 'userId-1\\nuserId-2\\nuserId-3'}
            />
            <FieldInput
              value={rosterForm.captainUserId}
              onChange={(event) => setRosterForm({ ...rosterForm, captainUserId: event.target.value })}
              placeholder={isRu ? 'Captain user ID' : 'Captain user ID'}
            />
            <FieldInput
              value={rosterForm.reason}
              onChange={(event) => setRosterForm({ ...rosterForm, reason: event.target.value })}
              placeholder={isRu ? 'Причина полной замены состава' : 'Reason for full roster replacement'}
            />
            <div className="signal-row-actions">
              <button type="button" className="btn btn-danger btn-sm" disabled={saving || !rosterForm.reason.trim()} onClick={() => void handleReplaceRoster()}>
                {isRu ? 'Заменить весь состав' : 'Replace roster'}
              </button>
            </div>
          </div>
        </Panel>
      </div>

      <Panel id="team-members" variant="elevated">
        <SectionHeader title={isRu ? 'Участники команды' : 'Team members'} />
        <TableShell>
          <table className="signal-table">
            <thead>
              <tr>
                <th>{isRu ? 'Фото' : 'Photo'}</th>
                <th>{isRu ? 'Участник' : 'Participant'}</th>
                <th>{isRu ? 'Телефон' : 'Phone'}</th>
                <th>Email</th>
                <th>{isRu ? 'Роль' : 'Role'}</th>
                <th>{isRu ? 'Статус' : 'Status'}</th>
                <th>{isRu ? 'Фото/Профиль' : 'Photo/Profile'}</th>
                <th>{isRu ? 'Вступил' : 'Joined'}</th>
                <th className="right">{isRu ? 'Действия' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {(team.members || []).map((member: any) => (
                <tr key={member.id} onClick={() => router.push(`/${locale}/admin/users/${member.userId}?eventId=${team.eventId}`)} style={{ cursor: 'pointer' }}>
                  <td>{member.user?.avatarUrl ? <span aria-hidden="true" style={{display:'inline-block',width:28,height:28,borderRadius:999,backgroundImage:`url(${member.user.avatarUrl})`,backgroundSize:'cover',backgroundPosition:'center'}} /> : '—'}</td>
                  <td>
                    <strong>{member.user?.name || '—'}</strong>
                    <div className="signal-muted">{member.userId}</div>
                  </td>
                  <td>{member.user?.phone || '—'}</td>
                  <td>{member.user?.email || '—'}</td>
                  <td><StatusBadge tone={member.role === 'CAPTAIN' ? 'info' : 'neutral'}>{member.role}</StatusBadge></td>
                  <td>
                    <FieldSelect
                      value={member.status}
                      onChange={(event) => { event.stopPropagation(); void handleMemberStatus(member, event.target.value as TeamMemberStatus); }}
                      disabled={saving}
                    >
                      {memberStatuses.map((status) => <option key={status} value={status}>{formatMemberStatus(status, locale)}</option>)}
                    </FieldSelect>
                  </td>
                  <td>
                    <StatusBadge tone={member.user?.avatarAsset?.status === 'APPROVED' ? 'success' : 'warning'}>
                      {member.user?.avatarAsset?.status || (member.user?.avatarUrl ? 'UPLOADED' : 'MISSING')}
                    </StatusBadge>
                  </td>
                  <td>{member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '—'}</td>
                  <td className="right">
                    <div className="signal-row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); router.push(`/${locale}/admin/users/${member.userId}?eventId=${team.eventId}`); }}
                      >
                        {isRu ? 'Профиль' : 'Profile'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={saving || member.userId === team.captainUserId}
                        onClick={(e) => { e.stopPropagation(); void handleTransferCaptain(member); }}
                      >
                        {isRu ? 'Капитан' : 'Captain'}
                      </button>
                      {member.userId !== team.captainUserId ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={saving}
                          onClick={(e) => { e.stopPropagation(); void handleReplaceMember(member); }}
                        >
                          {isRu ? 'Заменить' : 'Replace'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={saving}
                        onClick={(e) => { e.stopPropagation(); void handleRemoveMember(member); }}
                      >
                        {isRu ? 'Убрать' : 'Remove'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </Panel>

      <div className="admin-team-detail-grid">
        <Panel id="team-invitations" variant="elevated">
          <SectionHeader title={isRu ? 'Открытые приглашения' : 'Open invitations'} />
          {(team.invitations || []).length === 0 ? (
            <span className="signal-muted">{isRu ? 'Нет открытых приглашений' : 'No open invitations'}</span>
          ) : (
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>{isRu ? 'Статус' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {team.invitations.map((invitation: any) => (
                    <tr key={invitation.id}>
                      <td>{invitation.inviteeEmail}</td>
                      <td>{invitation.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </Panel>

        <Panel id="team-requests" variant="elevated">
          <SectionHeader title={isRu ? 'Открытые запросы изменений' : 'Open change requests'} />
          {(team.changeRequests || []).length === 0 ? (
            <span className="signal-muted">{isRu ? 'Нет открытых запросов' : 'No open requests'}</span>
          ) : (
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{isRu ? 'Статус' : 'Status'}</th>
                    <th>{isRu ? 'Создан' : 'Created'}</th>
                  </tr>
                </thead>
                <tbody>
                  {team.changeRequests.map((request: any) => (
                    <tr key={request.id}>
                      <td>{request.id}</td>
                      <td>{request.status}</td>
                      <td>{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </Panel>
      </div>

      <Panel id="team-history" variant="elevated">
        <SectionHeader title={isRu ? 'История команды' : 'Team history'} subtitle={isRu ? 'Последние admin override, заявки и решения' : 'Latest admin overrides, requests, and decisions'} />
        {(team.history || []).length === 0 ? (
          <EmptyState
            title={isRu ? 'История пуста' : 'No history yet'}
            description={isRu ? 'Действия по этой команде появятся здесь автоматически.' : 'Actions for this team will appear here automatically.'}
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{isRu ? 'Когда' : 'When'}</th>
                  <th>{isRu ? 'Действие' : 'Action'}</th>
                  <th>{isRu ? 'Actor' : 'Actor'}</th>
                  <th>{isRu ? 'Target' : 'Target'}</th>
                  <th>{isRu ? 'Причина' : 'Reason'}</th>
                </tr>
              </thead>
            <tbody>
                {(team.history || []).map((entry: any) => (
                  <tr key={entry.id}>
                    <td>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}</td>
                    <td>
                      <strong>{formatHistoryAction(entry.action, locale)}</strong>
                      {(entry.beforeJson || entry.afterJson) ? (
                        <details className="signal-stack" style={{ marginTop: 8 }}>
                          <summary>{isRu ? 'Посмотреть before / after' : 'View before / after'}</summary>
                          <div className="admin-team-history-diff">
                            <HistorySnapshotCard
                              locale={locale}
                              title={isRu ? 'До' : 'Before'}
                              snapshot={entry.beforeJson}
                            />
                            <HistorySnapshotCard
                              locale={locale}
                              title={isRu ? 'После' : 'After'}
                              snapshot={entry.afterJson}
                            />
                          </div>
                        </details>
                      ) : null}
                    </td>
                    <td>{entry.actorUser?.name || entry.actorUser?.email || entry.actorUserId || '—'}</td>
                    <td>{entry.targetUser?.name || entry.targetUser?.email || entry.targetUserId || '—'}</td>
                    <td>{entry.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}

function toneByStatus(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'ACTIVE' || status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'PENDING' || status === 'SUBMITTED') return 'warning';
  if (status === 'CHANGES_PENDING' || status === 'NEEDS_ATTENTION') return 'info';
  return 'neutral';
}

function formatTeamStatus(status: string, locale: string) {
  const ru: Record<string, string> = {
    DRAFT: 'Черновик',
    PENDING: 'На проверке',
    CHANGES_PENDING: 'Изменения на проверке',
    SUBMITTED: 'Отправлена',
    ACTIVE: 'Активна',
    APPROVED: 'Утверждена',
    NEEDS_ATTENTION: 'Требует внимания',
    REJECTED: 'Отклонена',
    ARCHIVED: 'Архив',
  };
  const en: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING: 'Pending',
    CHANGES_PENDING: 'Changes pending',
    SUBMITTED: 'Submitted',
    ACTIVE: 'Active',
    APPROVED: 'Approved',
    NEEDS_ATTENTION: 'Needs attention',
    REJECTED: 'Rejected',
    ARCHIVED: 'Archived',
  };
  return (locale === 'ru' ? ru : en)[status] ?? status;
}

function formatMemberStatus(status: string, locale: string) {
  const ru: Record<string, string> = {
    PENDING: 'Ожидает',
    ACTIVE: 'Активен',
    REJECTED: 'Отклонён',
    REMOVED: 'Убран',
    LEFT: 'Вышел',
  };
  const en: Record<string, string> = {
    PENDING: 'Pending',
    ACTIVE: 'Active',
    REJECTED: 'Rejected',
    REMOVED: 'Removed',
    LEFT: 'Left',
  };
  return (locale === 'ru' ? ru : en)[status] ?? status;
}

function formatHistoryAction(action: string, locale: string) {
  const ru: Record<string, string> = {
    TEAM_CREATED: 'Команда создана',
    TEAM_SUBMITTED: 'Состав отправлен на утверждение',
    TEAM_APPROVED: 'Команда утверждена',
    TEAM_REJECTED: 'Команда отклонена',
    CHANGE_REQUEST_CREATED: 'Создан запрос на изменение',
    CHANGE_REQUEST_INVITEE_ACCEPTED: 'Приглашённый участник принял замену',
    CHANGE_REQUEST_INVITEE_DECLINED: 'Приглашённый участник отклонил замену',
    CHANGE_REQUEST_SUBMITTED: 'Запрос изменений отправлен админу',
    CHANGE_REQUEST_APPROVED: 'Запрос изменений утверждён',
    CHANGE_REQUEST_REJECTED: 'Запрос изменений отклонён',
    CHANGE_REQUEST_CANCELLED: 'Запрос изменений отменён',
    MEMBER_ADDED: 'Участник добавлен',
    MEMBER_REMOVED: 'Участник удалён',
    MEMBER_REPLACED: 'Участник заменён',
    MEMBER_WITHDRAWAL_REQUESTED: 'Запрошен выход участника',
    CAPTAIN_TRANSFERRED: 'Капитан сменён',
    TEAM_DETAILS_UPDATED: 'Карточка команды обновлена',
    ADMIN_TEAM_RENAMED: 'Админ изменил название',
    ADMIN_TEAM_DESCRIPTION_UPDATED: 'Админ изменил описание',
    ADMIN_MEMBER_ADDED: 'Админ добавил участника',
    ADMIN_MEMBER_REMOVED: 'Админ удалил участника',
    ADMIN_MEMBER_REPLACED: 'Админ заменил участника',
    ADMIN_CAPTAIN_CHANGED: 'Админ сменил капитана',
    ADMIN_ROSTER_REPLACED: 'Админ полностью заменил состав',
    ADMIN_TEAM_APPROVED: 'Админ утвердил команду',
    ADMIN_TEAM_REJECTED: 'Админ отклонил команду',
    ADMIN_OVERRIDE_EVENT_PARTICIPANT_CREATED: 'Админ активировал участие в событии',
    ADMIN_OPEN_REQUEST_CANCELLED: 'Админ отменил открытую заявку',
  };
  const en: Record<string, string> = {
    TEAM_CREATED: 'Team created',
    TEAM_SUBMITTED: 'Roster submitted for approval',
    TEAM_APPROVED: 'Team approved',
    TEAM_REJECTED: 'Team rejected',
    CHANGE_REQUEST_CREATED: 'Change request created',
    CHANGE_REQUEST_INVITEE_ACCEPTED: 'Replacement invite accepted',
    CHANGE_REQUEST_INVITEE_DECLINED: 'Replacement invite declined',
    CHANGE_REQUEST_SUBMITTED: 'Change request submitted',
    CHANGE_REQUEST_APPROVED: 'Change request approved',
    CHANGE_REQUEST_REJECTED: 'Change request rejected',
    CHANGE_REQUEST_CANCELLED: 'Change request cancelled',
    MEMBER_ADDED: 'Member added',
    MEMBER_REMOVED: 'Member removed',
    MEMBER_REPLACED: 'Member replaced',
    MEMBER_WITHDRAWAL_REQUESTED: 'Withdrawal requested',
    CAPTAIN_TRANSFERRED: 'Captain transferred',
    TEAM_DETAILS_UPDATED: 'Team details updated',
    ADMIN_TEAM_RENAMED: 'Admin renamed the team',
    ADMIN_TEAM_DESCRIPTION_UPDATED: 'Admin updated the description',
    ADMIN_MEMBER_ADDED: 'Admin added a member',
    ADMIN_MEMBER_REMOVED: 'Admin removed a member',
    ADMIN_MEMBER_REPLACED: 'Admin replaced a member',
    ADMIN_CAPTAIN_CHANGED: 'Admin changed the captain',
    ADMIN_ROSTER_REPLACED: 'Admin replaced the full roster',
    ADMIN_TEAM_APPROVED: 'Admin approved the team',
    ADMIN_TEAM_REJECTED: 'Admin rejected the team',
    ADMIN_OVERRIDE_EVENT_PARTICIPANT_CREATED: 'Admin activated event participation',
    ADMIN_OPEN_REQUEST_CANCELLED: 'Admin cancelled an open request',
  };
  return (locale === 'ru' ? ru : en)[action] ?? action;
}

function HistorySnapshotCard({
  locale,
  title,
  snapshot,
}: {
  locale: string;
  title: string;
  snapshot: any;
}) {
  const isRu = locale === 'ru';
  if (!snapshot || typeof snapshot !== 'object') {
    return (
      <div className="admin-team-history-card">
        <strong>{title}</strong>
        <span className="signal-muted">{isRu ? 'Нет данных' : 'No data'}</span>
      </div>
    );
  }

  const members = Array.isArray(snapshot.members) ? snapshot.members : [];
  const memberNames = members.map((member: any) => member.user?.name || member.user?.email || member.userId).join(', ') || '—';
  const captain = members.find((member: any) => member.userId === snapshot.captainUserId);
  const captainLabel = captain?.user?.name || captain?.user?.email || snapshot.captainUserId || '—';

  return (
    <div className="admin-team-history-card">
      <strong>{title}</strong>
      <div className="signal-stack">
        <span><strong>{isRu ? 'Название:' : 'Name:'}</strong> {snapshot.name || '—'}</span>
        <span><strong>{isRu ? 'Статус:' : 'Status:'}</strong> {snapshot.status || '—'}</span>
        <span><strong>{isRu ? 'Капитан:' : 'Captain:'}</strong> {captainLabel}</span>
        <span><strong>{isRu ? 'Участники:' : 'Members:'}</strong> {memberNames}</span>
      </div>
    </div>
  );
}
