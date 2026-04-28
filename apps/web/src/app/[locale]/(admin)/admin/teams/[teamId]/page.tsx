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

const teamStatuses = ['DRAFT', 'ACTIVE', 'PENDING', 'CHANGES_PENDING', 'SUBMITTED', 'REJECTED', 'ARCHIVED'];
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
    await runTeamMutation(
      () => adminApi.updateTeam(team.id, {
        name: editForm.name,
        description: editForm.description || null,
        status: editForm.status,
        maxSize: editForm.maxSize,
        captainUserId: editForm.captainUserId || undefined,
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
      }),
      isRu ? 'Участник добавлен' : 'Member added',
    );
    setMemberForm((current) => ({ ...current, emailOrId: '' }));
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

    await runTeamMutation(
      () => adminApi.transferTeamCaptain(team.id, member.userId),
      isRu ? 'Капитан переназначен' : 'Captain transferred',
    );
  };

  const handleRemoveMember = async (member: any) => {
    if (!confirm(isRu ? 'Убрать участника из команды?' : 'Remove member from team?')) return;

    await runTeamMutation(
      () => adminApi.removeTeamMember(team.id, member.userId),
      isRu ? 'Участник убран из команды' : 'Member removed',
    );
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
        actions={<StatusBadge tone={toneByStatus(team.status)}>{formatTeamStatus(team.status, locale)}</StatusBadge>}
      />

      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <div className="admin-team-detail-grid">
        <Panel variant="elevated">
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

        <Panel variant="elevated">
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
            <button type="button" className="btn btn-primary btn-sm" disabled={saving || !memberForm.emailOrId.trim()} onClick={() => void handleAddMember()}>
              {isRu ? 'Добавить' : 'Add'}
            </button>
          </div>
        </Panel>
      </div>

      <Panel variant="elevated">
        <SectionHeader title={isRu ? 'Участники команды' : 'Team members'} />
        <TableShell>
          <table className="signal-table">
            <thead>
              <tr>
                <th>{isRu ? 'Пользователь' : 'User'}</th>
                <th>Email</th>
                <th>{isRu ? 'Роль' : 'Role'}</th>
                <th>{isRu ? 'Статус' : 'Status'}</th>
                <th>{isRu ? 'Вступил' : 'Joined'}</th>
                <th className="right">{isRu ? 'Действия' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {(team.members || []).map((member: any) => (
                <tr key={member.id}>
                  <td>
                    <strong>{member.user?.name || '—'}</strong>
                    <div className="signal-muted">{member.userId}</div>
                  </td>
                  <td>{member.user?.email || '—'}</td>
                  <td><StatusBadge tone={member.role === 'CAPTAIN' ? 'info' : 'neutral'}>{member.role}</StatusBadge></td>
                  <td>
                    <FieldSelect
                      value={member.status}
                      onChange={(event) => void handleMemberStatus(member, event.target.value as TeamMemberStatus)}
                      disabled={saving}
                    >
                      {memberStatuses.map((status) => <option key={status} value={status}>{formatMemberStatus(status, locale)}</option>)}
                    </FieldSelect>
                  </td>
                  <td>{member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '—'}</td>
                  <td className="right">
                    <div className="signal-row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => router.push(`/${locale}/admin/users/${member.userId}?eventId=${team.eventId}`)}
                      >
                        {isRu ? 'Профиль' : 'Profile'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={saving || member.userId === team.captainUserId}
                        onClick={() => void handleTransferCaptain(member)}
                      >
                        {isRu ? 'Капитан' : 'Captain'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={saving}
                        onClick={() => void handleRemoveMember(member)}
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
        <Panel variant="elevated">
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

        <Panel variant="elevated">
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
    </div>
  );
}

function toneByStatus(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'PENDING' || status === 'SUBMITTED') return 'warning';
  if (status === 'CHANGES_PENDING') return 'info';
  return 'neutral';
}

function formatTeamStatus(status: string, locale: string) {
  const ru: Record<string, string> = {
    DRAFT: 'Черновик',
    PENDING: 'На проверке',
    CHANGES_PENDING: 'Изменения на проверке',
    SUBMITTED: 'Отправлена',
    ACTIVE: 'Активна',
    REJECTED: 'Отклонена',
    ARCHIVED: 'Архив',
  };
  const en: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING: 'Pending',
    CHANGES_PENDING: 'Changes pending',
    SUBMITTED: 'Submitted',
    ACTIVE: 'Active',
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
