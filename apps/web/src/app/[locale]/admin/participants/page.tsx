'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, PageHeader, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

export default function AdminParticipantsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [participants, setParticipants] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    adminApi.listEvents({ limit: 100 })
      .then(async (eventsResult) => {
        const allParticipants: any[] = [];
        for (const event of eventsResult.data) {
          try {
            const participantsData = await adminApi.listEventParticipants(event.id);
            allParticipants.push(...participantsData.participants.map((p: any) => ({
              ...p,
              eventTitle: event.title,
              eventId: event.id,
            })));
          } catch {
            // skip
          }
        }
        setParticipants(allParticipants);
      })
      .catch(() => setParticipants([]))
      .finally(() => setLoadingData(false));
  }, [user, isAdmin]);

  if (loading || !user || !isAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  const filteredParticipants = participants.filter((p) => {
    const searchPass = !search || 
      p.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.user?.email?.toLowerCase().includes(search.toLowerCase());
    const eventPass = eventFilter === 'ALL' || p.eventId === eventFilter;
    const rolePass = roleFilter === 'ALL' || p.role === roleFilter;
    const statusPass = statusFilter === 'ALL' || p.status === statusFilter;
    return searchPass && eventPass && rolePass && statusPass;
  });

  const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    ACTIVE: 'success',
    PENDING: 'warning',
    REJECTED: 'danger',
    REMOVED: 'neutral',
  };

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={t('admin.participants') ?? 'Participants'}
        subtitle={locale === 'ru' ? 'Все участия и регистрации' : 'All participations and registrations'}
      />

      <Panel variant="elevated" className="admin-command-panel">
        <ToolbarRow>
          <FieldInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по имени или email...' : 'Search by name or email...'}
            className="admin-filter-search"
          />
          <FieldSelect value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="admin-filter-select">
            <option value="ALL">{locale === 'ru' ? 'Все роли' : 'All roles'}</option>
            <option value="PARTICIPANT">{locale === 'ru' ? 'Участник' : 'Participant'}</option>
            <option value="VOLUNTEER">{locale === 'ru' ? 'Волонтёр' : 'Volunteer'}</option>
          </FieldSelect>
          <FieldSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-filter-select">
            <option value="ALL">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
            <option value="ACTIVE">{locale === 'ru' ? 'Активные' : 'Active'}</option>
            <option value="PENDING">{locale === 'ru' ? 'В ожидании' : 'Pending'}</option>
            <option value="REJECTED">{locale === 'ru' ? 'Отклонённые' : 'Rejected'}</option>
            <option value="REMOVED">{locale === 'ru' ? 'Удалённые' : 'Removed'}</option>
          </FieldSelect>
          <StatusBadge tone="info">{filteredParticipants.length} {locale === 'ru' ? 'записей' : 'records'}</StatusBadge>
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={8} />
        ) : filteredParticipants.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет участников' : 'No participants'}
            description={locale === 'ru' ? 'Участники появятся после регистраций на события.' : 'Participants will appear after event registrations.'}
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Пользователь' : 'User'}</th>
                  <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                  <th>{locale === 'ru' ? 'Роль' : 'Role'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{locale === 'ru' ? 'Зарегистрирован' : 'Registered'}</th>
                  <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.user?.name ?? '—'}</strong>
                      <div className="signal-muted">{p.user?.email}</div>
                    </td>
                    <td className="signal-overflow-ellipsis">{p.eventTitle}</td>
                    <td><StatusBadge tone="info">{p.role}</StatusBadge></td>
                    <td><StatusBadge tone={toneByStatus[p.status] ?? 'neutral'}>{p.status}</StatusBadge></td>
                    <td className="signal-muted">{new Date(p.assignedAt).toLocaleDateString()}</td>
                    <td className="right">
                      <div className="signal-row-actions">
                        <button className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Просмотр' : 'View'}</button>
                      </div>
                    </td>
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