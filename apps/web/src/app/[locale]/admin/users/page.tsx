'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, MetricCard, PageHeader, Panel, SectionHeader, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import styles from './page.module.css';

interface UsersStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersWithAnyEventMembership: number;
  usersWithoutEventMembership: number;
  totalParticipantMemberships: number;
  totalActiveParticipantMemberships: number;
  totalVolunteerMemberships: number;
  totalEventAdminMemberships: number;
  totalTeams: number;
  totalActiveTeams: number;
}

interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  avatarUrl: string | null;
  city: string | null;
  registeredAt: string;
  lastLoginAt: string | null;
  accounts: { id: string; provider: string; linkedAt: string | null }[];
  counts: {
    eventMembershipsTotal: number;
    participantMembershipsTotal: number;
    volunteerMembershipsTotal: number;
    eventAdminMembershipsTotal: number;
    activeParticipantMembershipsTotal: number;
    teamsTotal: number;
  };
}

interface EventOption {
  id: string;
  title: string;
}

export default function AdminUsersPage() {
  const { user, loading, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';

  const [stats, setStats] = useState<UsersStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [usersLoading, setUsersLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [hasEventMembershipFilter, setHasEventMembershipFilter] = useState('');
  const [eventIdFilter, setEventIdFilter] = useState('');
  const [includeInactiveFilter, setIncludeInactiveFilter] = useState(false);

  const [events, setEvents] = useState<EventOption[]>([]);
  const [limit] = useState(50);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!loading && (!user || !isPlatformAdmin)) router.push(`/${locale}`);
  }, [user, loading, isPlatformAdmin, router, locale]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await adminApi.getUserStats();
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const response = await adminApi.listEvents({ limit: 100 });
      setEvents(response.data.map((e: any) => ({ id: e.id, title: e.title })));
    } catch {
      setEvents([]);
    }
  }, []);

  const loadUsers = useCallback(async (pageNum: number) => {
    setUsersLoading(true);
    try {
      const params: Parameters<typeof adminApi.listUsers>[0] = {
        page: pageNum,
        limit,
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        hasEventMembership: hasEventMembershipFilter || undefined,
        eventId: eventIdFilter || undefined,
        includeInactive: includeInactiveFilter,
      };
      const response = await adminApi.listUsers(params);
      setUsers(response.data.filter((entry: UserListItem) => entry.role !== 'SUPER_ADMIN'));
      setTotal(response.meta.total);
      setTotalPages(response.meta.pages);
      setPage(pageNum);
    } catch {
      setUsers([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setUsersLoading(false);
    }
  }, [debouncedSearch, roleFilter, hasEventMembershipFilter, eventIdFilter, includeInactiveFilter, limit]);

  useEffect(() => {
    if (user && isPlatformAdmin) {
      void loadStats();
      void loadEvents();
    }
  }, [user, isPlatformAdmin, loadStats, loadEvents]);

  useEffect(() => {
    if (user && isPlatformAdmin) {
      void loadUsers(1);
    }
  }, [user, isPlatformAdmin, loadUsers]);

  const handlePageChange = (newPage: number) => {
    void loadUsers(newPage);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      const { user: updated } = await adminApi.updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((currentUser) => currentUser.id === userId ? { ...currentUser, role: updated.role } : currentUser));
    } catch {
      alert(isRu ? 'Не удалось обновить роль' : 'Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRowClick = (userId: string) => {
    router.push(`/${locale}/admin/users/${userId}`);
  };

  const toneByRole: Record<string, 'info' | 'warning' | 'neutral'> = {
    SUPER_ADMIN: 'warning',
    PLATFORM_ADMIN: 'info',
    USER: 'neutral',
  };

  const providerLabel: Record<string, string> = {
    google: 'Google',
    yandex: 'Yandex',
    telegram: 'Telegram',
    email: 'Email',
  };

  if (loading || !user || !isPlatformAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={isRu ? 'Пользователи' : 'Users'}
        subtitle={`${total} ${isRu ? 'всего' : 'total'}`}
      />

      <Panel variant="elevated" className={styles.statsCardsPanel}>
        <div className={styles.statsCardsGrid}>
          {statsLoading ? (
            <div className={styles.statsCardSkeleton} />
          ) : stats ? (
            <>
              <MetricCard
                label={isRu ? 'Всего пользователей' : 'Total users'}
                value={stats.totalUsers}
                tone="neutral"
              />
              <MetricCard
                label={isRu ? 'Активные аккаунты' : 'Active accounts'}
                value={stats.activeUsers}
                tone="success"
              />
              <MetricCard
                label={isRu ? 'Без участия в событиях' : 'Without event participation'}
                value={stats.usersWithoutEventMembership}
                tone="warning"
              />
              <MetricCard
                label={isRu ? 'С участием в событиях' : 'With event participation'}
                value={stats.usersWithAnyEventMembership}
                tone="info"
              />
              <MetricCard
                label={isRu ? 'Активные участники' : 'Active participants'}
                value={stats.totalActiveParticipantMemberships}
                tone="info"
              />
              <MetricCard
                label={isRu ? 'Команды' : 'Teams'}
                value={stats.totalTeams}
                tone="neutral"
              />
            </>
          ) : (
            <div className="signal-muted">{isRu ? 'Не удалось загрузить статистику' : 'Failed to load stats'}</div>
          )}
        </div>
      </Panel>

      <Panel variant="elevated" className="admin-command-panel">
        <SectionHeader
          title={isRu ? 'Управление пользователями' : 'User Management'}
          subtitle={isRu ? 'Все зарегистрированные пользователи системы' : 'All registered users in the system'}
        />
        <ToolbarRow>
          <FieldInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isRu ? 'Поиск...' : 'Search...'}
            className="admin-filter-search"
          />
          <FieldSelect value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="admin-filter-select">
            <option value="">{isRu ? 'Все роли' : 'All roles'}</option>
            <option value="USER">User</option>
            <option value="PLATFORM_ADMIN">Platform Admin</option>
          </FieldSelect>
          <FieldSelect value={hasEventMembershipFilter} onChange={(e) => setHasEventMembershipFilter(e.target.value)} className="admin-filter-select">
            <option value="">{isRu ? 'Все участники' : 'All users'}</option>
            <option value="YES">{isRu ? 'Участвовали' : 'Has events'}</option>
            <option value="NO">{isRu ? 'Не участвовали' : 'No events'}</option>
          </FieldSelect>
          {events.length > 0 && (
            <FieldSelect value={eventIdFilter} onChange={(e) => setEventIdFilter(e.target.value)} className="admin-filter-select">
              <option value="">{isRu ? 'Все события' : 'All events'}</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </FieldSelect>
          )}
          <label className={styles.adminCheckboxLabel}>
            <input
              type="checkbox"
              checked={includeInactiveFilter}
              onChange={(e) => setIncludeInactiveFilter(e.target.checked)}
            />
            <span>{isRu ? 'Включить неактивные' : 'Include inactive'}</span>
          </label>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadUsers(1)}
          >
            {isRu ? 'Применить' : 'Apply'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              adminApi.exportUsers({
                search: debouncedSearch || undefined,
                role: roleFilter || undefined,
                hasEventMembership: hasEventMembershipFilter || undefined,
                eventId: eventIdFilter || undefined,
                includeInactive: includeInactiveFilter,
                format: 'csv',
              });
            }}
          >
            {isRu ? 'Выгрузить полный CSV' : 'Export full CSV'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              adminApi.exportUsers({
                search: debouncedSearch || undefined,
                role: roleFilter || undefined,
                hasEventMembership: hasEventMembershipFilter || undefined,
                eventId: eventIdFilter || undefined,
                includeInactive: includeInactiveFilter,
                format: 'json',
              });
            }}
          >
            {isRu ? 'Выгрузить JSON' : 'Export JSON'}
          </button>
        </ToolbarRow>

        {usersLoading ? (
          <LoadingLines rows={6} />
        ) : users.length === 0 ? (
          <EmptyState
            title={isRu ? 'Пользователи не найдены' : 'No users found'}
            description={isRu ? 'Скорректируйте фильтры или дождитесь новых регистраций.' : 'Adjust filters or wait for incoming registrations.'}
          />
        ) : (
          <>
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>{isRu ? 'Пользователь' : 'User'}</th>
                    <th>Email</th>
                    <th>{isRu ? 'Системная роль' : 'System role'}</th>
                    <th>{isRu ? 'Город' : 'City'}</th>
                    <th>{isRu ? 'Зарегистрирован' : 'Registered'}</th>
                    <th>{isRu ? 'Последний вход' : 'Last login'}</th>
                    <th>{isRu ? 'Участий в событиях' : 'Event participations'}</th>
                    <th>{isRu ? 'Команд' : 'Teams'}</th>
                    <th>{isRu ? 'Аккаунты провайдеров' : 'Provider accounts'}</th>
                    <th>{isRu ? 'Действия' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter((entry) => entry.role !== 'SUPER_ADMIN').map((entry) => (
                    <tr key={entry.id} onClick={() => handleRowClick(entry.id)} className={styles.clickableRow}>
                      <td>
                        <div className="admin-user-cell">
                          <Avatar>
                            {entry.avatarUrl
                              ? <AvatarImage src={entry.avatarUrl} alt="" />
                              : <AvatarFallback>{(entry.name || entry.email || '?').charAt(0).toUpperCase()}</AvatarFallback>}
                          </Avatar>
                          <div>
                            <strong>{entry.name || '—'}</strong>
                          </div>
                        </div>
                      </td>
                      <td className="signal-muted">{entry.email}</td>
                      <td><StatusBadge tone={toneByRole[entry.role] ?? 'neutral'}>{entry.role}</StatusBadge></td>
                      <td>{entry.city || '—'}</td>
                      <td className="signal-muted">{entry.registeredAt ? new Date(entry.registeredAt).toLocaleDateString() : '—'}</td>
                      <td className="signal-muted">{entry.lastLoginAt ? new Date(entry.lastLoginAt).toLocaleDateString() : '—'}</td>
                      <td>{entry.counts.eventMembershipsTotal}</td>
                      <td>{entry.counts.teamsTotal}</td>
                      <td>
                        <div className={styles.providerBadges}>
                          {entry.accounts?.map((account) => (
                            <span key={account.id} className={styles.providerBadge}>
                              {providerLabel[account.provider] ?? account.provider}
                            </span>
                          ))}
                          {(!entry.accounts || entry.accounts.length === 0) && '—'}
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="signal-row-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleRowClick(entry.id)}
                          >
                            {isRu ? 'Профиль' : 'Profile'}
                          </button>
                          {user.role === 'SUPER_ADMIN' && entry.role !== 'SUPER_ADMIN' && (
                            <FieldSelect
                              value={entry.role}
                              onChange={(e) => void handleRoleChange(entry.id, e.target.value)}
                              disabled={updatingId === entry.id || entry.id === user.id}
                              className="admin-role-select"
                            >
                              <option value="USER">User</option>
                              <option value="PLATFORM_ADMIN">Platform Admin</option>
                            </FieldSelect>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>

            {totalPages > 1 && (
              <div className="admin-pagination">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void handlePageChange(page - 1)}
                  disabled={page <= 1}
                >
                  {isRu ? 'Назад' : 'Previous'}
                </button>
                <span className="signal-muted">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  {isRu ? 'Вперёд' : 'Next'}
                </button>
              </div>
            )}
          </>
        )}
      </Panel>

      <div className="signal-notice signal-notice--warning" style={{ marginTop: '16px' }}>
        {isRu
          ? 'Изменение роли применяется немедленно. С этой страницы можно назначать только USER и PLATFORM_ADMIN. Нельзя изменить собственную роль.'
          : 'Role changes are applied immediately. Only USER and PLATFORM_ADMIN are assignable from this page. You cannot change your own role.'}
      </div>
    </div>
  );
}
