'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCell,
  AdminDataTableHeader,
  AdminDataTableRow,
} from '@/components/admin/AdminDataTable';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EmptyState, LoadingLines, MetricCard, Notice, Panel, SectionHeader, StatusBadge } from '@/components/ui/signal-primitives';

interface UsersAnalytics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersWithEvents: number;
  usersWithoutEvents: number;
  participationsActive: number;
  volunteersActive: number;
  teamsCount: number;
  teamsActive: number;
}

interface PlatformAnalytics {
  totalUsers: number;
  totalEvents: number;
  totalRegistrations: number;
  volunteersPending: number;
  totalEventViews: number;
  conversionViewToRegistration: number;
  registrationsByProvider: Record<string, number>;
  loginsByProvider: Record<string, number>;
  topViewedEvents: Array<{ eventId: string; slug: string; title: string; category: string; registrationsCount: number; viewCount: number }>;
  topRegisteredEvents: Array<{ eventId: string; slug: string; title: string; category: string; registrationCount: number }>;
}

export default function AdminAnalyticsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [usersAnalytics, setUsersAnalytics] = useState<UsersAnalytics | null>(null);
  const [platformAnalytics, setPlatformAnalytics] = useState<PlatformAnalytics | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    let active = true;

    async function loadStats() {
      setStatsLoading(true);
      try {
        const [usersData, platformData] = await Promise.all([
          adminApi.getUsersAnalytics(),
          adminApi.getAnalytics(),
        ]);
        if (active) {
          setUsersAnalytics(usersData as UsersAnalytics);
          setPlatformAnalytics(platformData as PlatformAnalytics);
        }
      } catch {
        if (active) {
          setUsersAnalytics(null);
          setPlatformAnalytics(null);
        }
      } finally {
        if (active) setStatsLoading(false);
      }
    }

    loadStats();
    return () => {
      active = false;
    };
  }, [user, isAdmin]);

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={t('admin.analytics')}
        subtitle={locale === 'ru' ? 'Обзор производительности платформы' : 'Platform performance overview'}
      />

      {isPlatformAdmin && usersAnalytics && (
        <>
          <Panel variant="elevated" className="admin-command-panel admin-data-panel">
            <SectionHeader
              title={locale === 'ru' ? 'Аналитика по пользователям' : 'Users Analytics'}
              subtitle={locale === 'ru' ? 'Сводка по пользователям, участиям и командам' : 'Summary of users, participations and teams'}
            />
            <div className="signal-kpi-grid">
              <MetricCard tone="info" label={locale === 'ru' ? 'Всего пользователей' : 'Total users'} value={usersAnalytics.totalUsers} />
              <MetricCard tone="success" label={locale === 'ru' ? 'Активных' : 'Active'} value={usersAnalytics.activeUsers} />
              <MetricCard tone="neutral" label={locale === 'ru' ? 'Отключённых' : 'Disabled'} value={usersAnalytics.inactiveUsers} />
              <MetricCard tone="warning" label={locale === 'ru' ? 'Участвовали' : 'With events'} value={usersAnalytics.usersWithEvents} />
              <MetricCard tone="neutral" label={locale === 'ru' ? 'Не участвовали' : 'No events'} value={usersAnalytics.usersWithoutEvents} />
            </div>
          </Panel>

          <Panel variant="elevated" className="admin-command-panel admin-data-panel">
            <SectionHeader
              title={locale === 'ru' ? 'Аналитика по событиям и командам' : 'Events & Teams Analytics'}
              subtitle={locale === 'ru' ? 'Сводка по участиям, волонтёрам и командам' : 'Summary of participations, volunteers and teams'}
            />
            <div className="signal-kpi-grid">
              <MetricCard tone="success" label={locale === 'ru' ? 'Активных участников' : 'Active participants'} value={usersAnalytics.participationsActive} />
              <MetricCard tone="info" label={locale === 'ru' ? 'Активных волонтёров' : 'Active volunteers'} value={usersAnalytics.volunteersActive} />
              <MetricCard tone="neutral" label={locale === 'ru' ? 'Всего команд' : 'Total teams'} value={usersAnalytics.teamsCount} />
              <MetricCard tone="success" label={locale === 'ru' ? 'Активных команд' : 'Active teams'} value={usersAnalytics.teamsActive} />
            </div>
          </Panel>

          <div className="signal-two-col admin-dashboard-grid">
            <Panel variant="elevated" className="admin-command-panel admin-data-panel">
              <SectionHeader title={locale === 'ru' ? 'Статусы пользователей' : 'User Status Breakdown'} subtitle={locale === 'ru' ? 'Распределение по статусам' : 'Status distribution'} />
              <AdminDataTable minWidth={420}>
                <AdminDataTableHeader
                  columns={[
                    { label: locale === 'ru' ? 'Метрика' : 'Metric', width: '68%' },
                    { label: locale === 'ru' ? 'Значение' : 'Value', width: '32%' },
                  ]}
                />
                <AdminDataTableBody>
                  <AdminDataTableRow>
                    <AdminDataTableCell>{locale === 'ru' ? 'Активные пользователи' : 'Active users'}</AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone="success">{usersAnalytics.activeUsers}</StatusBadge></AdminDataTableCell>
                  </AdminDataTableRow>
                  <AdminDataTableRow>
                    <AdminDataTableCell>{locale === 'ru' ? 'Неактивные пользователи' : 'Inactive users'}</AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone="neutral">{usersAnalytics.inactiveUsers}</StatusBadge></AdminDataTableCell>
                  </AdminDataTableRow>
                  <AdminDataTableRow>
                    <AdminDataTableCell>{locale === 'ru' ? 'Пользователи с событиями' : 'Users with events'}</AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone="info">{usersAnalytics.usersWithEvents}</StatusBadge></AdminDataTableCell>
                  </AdminDataTableRow>
                  <AdminDataTableRow>
                    <AdminDataTableCell>{locale === 'ru' ? 'Пользователи без событий' : 'Users without events'}</AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone="warning">{usersAnalytics.usersWithoutEvents}</StatusBadge></AdminDataTableCell>
                  </AdminDataTableRow>
                </AdminDataTableBody>
              </AdminDataTable>
            </Panel>

            <Panel variant="elevated" className="admin-command-panel admin-data-panel">
              <SectionHeader title={locale === 'ru' ? 'События и команды' : 'Events & Teams Breakdown'} subtitle={locale === 'ru' ? 'Операционная сводка' : 'Operational summary'} />
              <AdminDataTable minWidth={420}>
                <AdminDataTableHeader
                  columns={[
                    { label: locale === 'ru' ? 'Метрика' : 'Metric', width: '68%' },
                    { label: locale === 'ru' ? 'Значение' : 'Value', width: '32%' },
                  ]}
                />
                <AdminDataTableBody>
                  <AdminDataTableRow>
                    <AdminDataTableCell>{locale === 'ru' ? 'Активные участия' : 'Active participations'}</AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone="success">{usersAnalytics.participationsActive}</StatusBadge></AdminDataTableCell>
                  </AdminDataTableRow>
                  <AdminDataTableRow>
                    <AdminDataTableCell>{locale === 'ru' ? 'Активные волонтёры' : 'Active volunteers'}</AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone="info">{usersAnalytics.volunteersActive}</StatusBadge></AdminDataTableCell>
                  </AdminDataTableRow>
                  <AdminDataTableRow>
                    <AdminDataTableCell>{locale === 'ru' ? 'Всего команд' : 'Total teams'}</AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone="neutral">{usersAnalytics.teamsCount}</StatusBadge></AdminDataTableCell>
                  </AdminDataTableRow>
                  <AdminDataTableRow>
                    <AdminDataTableCell>{locale === 'ru' ? 'Активных команд' : 'Active teams'}</AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone="success">{usersAnalytics.teamsActive}</StatusBadge></AdminDataTableCell>
                  </AdminDataTableRow>
                </AdminDataTableBody>
              </AdminDataTable>
            </Panel>
          </div>
        </>
      )}

      {statsLoading ? (
        <LoadingLines rows={5} />
      ) : platformAnalytics ? (
        <Panel variant="elevated" className="admin-command-panel admin-data-panel">
          <SectionHeader title={locale === 'ru' ? 'Общая аналитика платформы' : 'Platform-wide Analytics'} subtitle={locale === 'ru' ? 'Ключевые показатели' : 'Key indicators'} />
          <div className="signal-kpi-grid">
            <MetricCard tone="info" label={locale === 'ru' ? 'Всего событий' : 'Total events'} value={platformAnalytics.totalEvents ?? 0} />
            <MetricCard tone="success" label={locale === 'ru' ? 'Всего регистраций' : 'Total registrations'} value={platformAnalytics.totalRegistrations ?? 0} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'Волонтёры ждут' : 'Volunteers pending'} value={platformAnalytics.volunteersPending ?? 0} />
            <MetricCard tone="neutral" label={locale === 'ru' ? 'Просмотры событий' : 'Event views'} value={platformAnalytics.totalEventViews ?? 0} />
            <MetricCard tone="info" label={locale === 'ru' ? 'Конверсия' : 'Conversion'} value={platformAnalytics.conversionViewToRegistration ? `${(platformAnalytics.conversionViewToRegistration * 100).toFixed(2)}%` : '—'} />
          </div>
        </Panel>
      ) : (
        <EmptyState title={t('common.noData')} description={locale === 'ru' ? 'Данные аналитики появятся после накопления активности.' : 'Analytics widgets appear after activity is accumulated.'} />
      )}

      <Notice tone="info">
        {locale === 'ru' ? 'Аналитика обновляется в реальном времени.' : 'Analytics are updated in real-time.'}
      </Notice>
    </div>
  );
}
