'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import {
  EmptyState,
  LoadingLines,
  PageHeader,
  Panel,
  SectionHeader,
  StatusBadge,
  TableShell,
} from '@/components/ui/signal-primitives';

export default function AdminTeamDetailsPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const params = useParams();
  const teamId = params?.teamId as string;

  const [team, setTeam] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push(`/${locale}`);
    }
  }, [loading, user, isAdmin, router, locale]);

  useEffect(() => {
    if (!teamId) return;
    setLoadingData(true);
    adminApi.getTeam(teamId)
      .then((res) => {
        setTeam(res.data);
        setError('');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load team');
        setTeam(null);
      })
      .finally(() => setLoadingData(false));
  }, [teamId]);

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
        <EmptyState title="Команда не найдена" description={error || 'Нет данных'} />
      </div>
    );
  }

  return (
    <div className="signal-page-shell admin-control-page">
      <div style={{ marginBottom: '16px' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => router.push(`/${locale}/admin/teams`)}
        >
          ← Назад к списку
        </button>
      </div>

      <PageHeader title={team.name} subtitle={team.event?.title || 'Команда'} />

      <Panel variant="elevated">
        <SectionHeader title="Основная информация" />
        <div className="signal-stack">
          <div><strong>Статус:</strong> <StatusBadge tone="info">{team.status}</StatusBadge></div>
          <div><strong>Мероприятие:</strong> {team.event?.title || '—'}</div>
          <div><strong>Капитан:</strong> {team.captainUser?.name || '—'} ({team.captainUser?.email || '—'})</div>
          <div><strong>Создана:</strong> {team.createdAt ? new Date(team.createdAt).toLocaleDateString() : '—'}</div>
        </div>
      </Panel>

      <Panel variant="elevated">
        <SectionHeader title="Участники команды" />
        <TableShell>
          <table className="signal-table">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Дата вступления</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {(team.members || []).map((member: any) => (
                <tr key={member.id}>
                  <td>{member.user?.name || '—'}</td>
                  <td>{member.user?.email || '—'}</td>
                  <td>{member.role}</td>
                  <td>{member.status}</td>
                  <td>{member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => router.push(`/${locale}/admin/users/${member.userId}?eventId=${team.eventId}`)}
                    >
                      Профиль
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </Panel>

      <Panel variant="elevated">
        <SectionHeader title="Открытые приглашения" />
        {(team.invitations || []).length === 0 ? (
          <span className="signal-muted">Нет открытых приглашений</span>
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Статус</th>
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
        <SectionHeader title="Открытые change requests" />
        {(team.changeRequests || []).length === 0 ? (
          <span className="signal-muted">Нет открытых запросов</span>
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Статус</th>
                  <th>Создан</th>
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

      {team.status !== 'ARCHIVED' && (
        <Panel variant="elevated">
          <SectionHeader title="Действия" />
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={async () => {
              await adminApi.archiveTeam(team.id);
              router.push(`/${locale}/admin/teams`);
            }}
          >
            Архивировать команду
          </button>
        </Panel>
      )}
    </div>
  );
}