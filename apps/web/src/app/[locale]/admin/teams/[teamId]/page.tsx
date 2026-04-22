'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, PageHeader, Panel, SectionHeader, StatusBadge, TableShell } from '@/components/ui/signal-primitives';

interface TeamMember {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
  approvedAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
}

interface TeamInvitation {
  id: string;
  inviteeEmail: string;
  status: string;
}

interface TeamChangeRequest {
  id: string;
  status: string;
  createdAt: string;
  proposedName: string | null;
  proposedDescription: string | null;
  requestedByUser: { id: string; name: string | null } | null;
}

interface TeamDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  joinCode: string;
  maxSize: number | null;
  createdAt: string;
  updatedAt: string;
  event: { id: string; title: string; slug: string };
  captainUser: { id: string; name: string | null; email: string | null; avatarUrl: string | null };
  members: TeamMember[];
  invitations: TeamInvitation[];
  changeRequests: TeamChangeRequest[];
}

const MEMBER_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  APPROVED: 'success',
  REMOVED: 'danger',
  LEFT: 'neutral',
};

const TEAM_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  DRAFT: 'neutral',
  PENDING: 'warning',
  CHANGES_PENDING: 'info',
  ACTIVE: 'success',
  SUBMITTED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  ARCHIVED: 'neutral',
};

export default function TeamDetailPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const locale = useRouteLocale();

  const teamId = params?.teamId as string;

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push(`/${locale}/admin/teams`);
    }
  }, [user, loading, isAdmin, router, locale]);

  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    setLoadingData(true);
    setError('');

    try {
      const result = await adminApi.getTeam(teamId);
      setTeam(result.data);
    } catch {
      setError(locale === 'ru' ? 'Не удалось загрузить данные команды' : 'Failed to load team data');
    } finally {
      setLoadingData(false);
    }
  }, [teamId, locale]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const handleArchive = async () => {
    if (!team) return;
    const message = locale === 'ru'
      ? 'Архивировать команду? Она исчезнет из списка по умолчанию, но состав и история сохранятся.'
      : 'Archive this team? It will disappear from the default list, but members and history will remain.';
    if (!confirm(message)) return;

    setRemoving(true);
    try {
      await adminApi.archiveTeam(team.id);
      router.push(`/${locale}/admin/teams`);
    } catch {
      alert(locale === 'ru' ? 'Не удалось архивировать команду' : 'Failed to archive team');
    } finally {
      setRemoving(false);
    }
  };

  const formatStatus = (status: string) => {
    const ru: Record<string, string> = {
      DRAFT: 'Черновик',
      PENDING: 'На проверке',
      CHANGES_PENDING: 'Изменения на проверке',
      ACTIVE: 'Активна',
      SUBMITTED: 'Отправлена',
      APPROVED: 'Одобрена',
      REJECTED: 'Отклонена',
      ARCHIVED: 'Архив',
    };
    const en: Record<string, string> = {
      DRAFT: 'Draft',
      PENDING: 'Pending',
      CHANGES_PENDING: 'Changes pending',
      ACTIVE: 'Active',
      SUBMITTED: 'Submitted',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      ARCHIVED: 'Archived',
    };
    return (locale === 'ru' ? ru : en)[status] ?? status;
  };

  const formatMemberStatus = (status: string) => {
    const ru: Record<string, string> = {
      ACTIVE: 'Активен',
      PENDING: 'Ожидает',
      APPROVED: 'Одобрен',
      REMOVED: 'Удалён',
      LEFT: 'Покинул',
    };
    const en: Record<string, string> = {
      ACTIVE: 'Active',
      PENDING: 'Pending',
      APPROVED: 'Approved',
      REMOVED: 'Removed',
      LEFT: 'Left',
    };
    return (locale === 'ru' ? ru : en)[status] ?? status;
  };

  const formatInvitationStatus = (status: string) => {
    const ru: Record<string, string> = {
      PENDING_ACCOUNT: 'Ожидание регистрации',
      PENDING_RESPONSE: 'Ожидание ответа',
      ACCEPTED: 'Принято',
      DECLINED: 'Отклонено',
      CANCELLED: 'Отменено',
      EXPIRED: 'Истекло',
      REMOVED: 'Удалено',
    };
    const en: Record<string, string> = {
      PENDING_ACCOUNT: 'Awaiting registration',
      PENDING_RESPONSE: 'Awaiting response',
      ACCEPTED: 'Accepted',
      DECLINED: 'Declined',
      CANCELLED: 'Cancelled',
      EXPIRED: 'Expired',
      REMOVED: 'Removed',
    };
    return (locale === 'ru' ? ru : en)[status] ?? status;
  };

  if (loading || loadingData) {
    return (
      <div className="signal-page-shell admin-control-page">
        <PageHeader title={locale === 'ru' ? 'Загрузка...' : 'Loading...'} />
        <LoadingLines rows={8} />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="signal-page-shell admin-control-page">
        <PageHeader title={locale === 'ru' ? 'Команда не найдена' : 'Team not found'} />
        <EmptyState
          title={error || (locale === 'ru' ? 'Команда не найдена' : 'Team not found')}
          description={locale === 'ru' ? 'Попробуйте вернуться к списку команд.' : 'Try returning to the teams list.'}
        />
        <div className="signal-mt-4">
          <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/${locale}/admin/teams`)}>
            ← {locale === 'ru' ? 'Назад к списку' : 'Back to teams'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={team.name}
        subtitle={team.event.title}
        actions={
          team.status !== 'ARCHIVED' && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => void handleArchive()}
              disabled={removing}
            >
              {removing
                ? '...'
                : (locale === 'ru' ? 'Архивировать' : 'Archive')}
            </button>
          )
        }
      />

      <div className="admin-team-detail-grid">
        <Panel variant="elevated">
          <SectionHeader
            title={locale === 'ru' ? 'Информация о команде' : 'Team information'}
          />
          <div className="admin-team-meta-grid">
            <div className="admin-team-meta-tile">
              <span>{locale === 'ru' ? 'Событие' : 'Event'}</span>
              <strong>{team.event.title}</strong>
            </div>
            <div className="admin-team-meta-tile">
              <span>{locale === 'ru' ? 'Статус' : 'Status'}</span>
              <StatusBadge tone={TEAM_STATUS_TONE[team.status] ?? 'neutral'}>
                {formatStatus(team.status)}
              </StatusBadge>
            </div>
            <div className="admin-team-meta-tile">
              <span>{locale === 'ru' ? 'Капитан' : 'Captain'}</span>
              <div className="admin-user-chip">
                {team.captainUser.avatarUrl && (
                  <img src={team.captainUser.avatarUrl} alt="" className="admin-user-avatar" />
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => router.push(`/${locale}/admin/users/${team.captainUser.id}?eventId=${team.event.id}`)}
                >
                  {team.captainUser.name ?? team.captainUser.email ?? '—'}
                </button>
              </div>
            </div>
            <div className="admin-team-meta-tile">
              <span>{locale === 'ru' ? 'Код присоединения' : 'Join code'}</span>
              <strong className="signal-mono">{team.joinCode}</strong>
            </div>
            {team.maxSize && (
              <div className="admin-team-meta-tile">
                <span>{locale === 'ru' ? 'Макс. размер' : 'Max size'}</span>
                <strong>{team.maxSize}</strong>
              </div>
            )}
            <div className="admin-team-meta-tile">
              <span>{locale === 'ru' ? 'Создана' : 'Created'}</span>
              <strong>{new Date(team.createdAt).toLocaleDateString()}</strong>
            </div>
            {team.description && (
              <div className="admin-team-meta-tile admin-team-meta-tile--full">
                <span>{locale === 'ru' ? 'Описание' : 'Description'}</span>
                <p>{team.description}</p>
              </div>
            )}
          </div>
        </Panel>

        <Panel variant="elevated">
          <SectionHeader
            title={locale === 'ru' ? 'Участники' : 'Members'}
            subtitle={`${team.members.filter((m) => m.status === 'ACTIVE').length} / ${team.maxSize ?? '—'}`}
          />
          {team.members.length === 0 ? (
            <EmptyState
              title={locale === 'ru' ? 'Нет участников' : 'No members'}
              description={locale === 'ru' ? 'Участники появятся после вступления.' : 'Members will appear after joining.'}
            />
          ) : (
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>{locale === 'ru' ? 'Участник' : 'Member'}</th>
                    <th>{locale === 'ru' ? 'Роль' : 'Role'}</th>
                    <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                    <th>{locale === 'ru' ? 'Присоединился' : 'Joined'}</th>
                  </tr>
                </thead>
                <tbody>
                  {team.members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="admin-user-chip">
                          {member.user.avatarUrl && (
                            <img src={member.user.avatarUrl} alt="" className="admin-user-avatar" />
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => router.push(`/${locale}/admin/users/${member.user.id}?eventId=${team.event.id}`)}
                          >
                            {member.user.name ?? member.user.email ?? '—'}
                          </button>
                        </div>
                      </td>
                      <td>
                        <StatusBadge tone={member.role === 'CAPTAIN' ? 'warning' : 'info'}>
                          {member.role}
                        </StatusBadge>
                      </td>
                      <td>
                        <StatusBadge tone={MEMBER_STATUS_TONE[member.status] ?? 'neutral'}>
                          {formatMemberStatus(member.status)}
                        </StatusBadge>
                      </td>
                      <td className="signal-muted">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </Panel>

        {team.invitations.length > 0 && (
          <Panel variant="elevated">
            <SectionHeader
              title={locale === 'ru' ? 'Приглашения' : 'Invitations'}
              subtitle={`${team.invitations.filter((i) => ['PENDING_ACCOUNT', 'PENDING_RESPONSE'].includes(i.status)).length} ${locale === 'ru' ? 'открытых' : 'open'}`}
            />
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {team.invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.inviteeEmail}</td>
                      <td>
                        <StatusBadge tone={['PENDING_ACCOUNT', 'PENDING_RESPONSE'].includes(inv.status) ? 'warning' : 'neutral'}>
                          {formatInvitationStatus(inv.status)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </Panel>
        )}

        {team.changeRequests.length > 0 && (
          <Panel variant="elevated">
            <SectionHeader
              title={locale === 'ru' ? 'Запросы на изменения' : 'Change requests'}
            />
            <div className="admin-change-requests">
              {team.changeRequests.map((req) => (
                <div key={req.id} className="admin-change-request-card">
                  <div className="admin-change-request-header">
                    <StatusBadge tone="warning">{formatStatus(req.status)}</StatusBadge>
                    <span className="signal-muted">
                      {locale === 'ru' ? 'Запрошено' : 'Requested'}: {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {req.requestedByUser && (
                    <p className="signal-muted">
                      {locale === 'ru' ? 'Инициатор' : 'Requested by'}: {req.requestedByUser.name ?? '—'}
                    </p>
                  )}
                  {req.proposedName && req.proposedName !== team.name && (
                    <div className="admin-change-field">
                      <span>{locale === 'ru' ? 'Новое название' : 'Proposed name'}:</span>
                      <strong>{req.proposedName}</strong>
                    </div>
                  )}
                  {req.proposedDescription && req.proposedDescription !== team.description && (
                    <div className="admin-change-field">
                      <span>{locale === 'ru' ? 'Новое описание' : 'Proposed description'}:</span>
                      <p>{req.proposedDescription}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
