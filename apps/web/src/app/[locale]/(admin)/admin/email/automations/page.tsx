'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminDataTable, AdminDataTableBody, AdminDataTableCell, AdminDataTableHeader, AdminDataTableRow, AdminTableActions, AdminTableCellMain } from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EmptyState, LoadingLines, Notice, Panel, StatusBadge } from '@/components/ui/signal-primitives';

export default function AdminEmailAutomationsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [automations, setAutomations] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin || !isPlatformAdmin) return;

    setLoadingData(true);
    setError(null);
    adminEmailApi.listAutomations({})
      .then((res: { data: any[] }) => setAutomations(res.data))
      .catch((e) => {
        console.error('Load email automations failed:', e);
        setAutomations([]);
        setError(locale === 'ru' ? 'Не удалось загрузить автоматизации.' : 'Failed to load automations.');
      })
      .finally(() => setLoadingData(false));
  }, [user, isAdmin, isPlatformAdmin, locale]);

  if (loading || !user || !isAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="signal-page-shell admin-control-page">
        <EmptyState
          title={locale === 'ru' ? 'Доступ запрещён' : 'Access denied'}
          description={locale === 'ru' ? 'Управление автоматизациями доступно только платформенным администраторам.' : 'Automation management is only available to platform administrators.'}
        />
      </div>
    );
  }

  const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    active: 'success',
    paused: 'warning',
    draft: 'neutral',
  };

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={t('admin.automations') ?? 'Automations'}
        subtitle={locale === 'ru' ? 'Email автоматизации и триггеры' : 'Email automations and triggers'}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Panel variant="elevated" className="admin-command-panel">
        {loadingData ? (
          <LoadingLines rows={6} />
        ) : automations.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет автоматизаций' : 'No automations'}
            description={locale === 'ru' ? 'Автоматизации пока не включены: сейчас рабочий контур покрывает шаблоны, рассылки, журнал и webhooks.' : 'Automations are not enabled yet: the working email loop currently covers templates, broadcasts, logs, and webhooks.'}
          />
        ) : (
          <div className="admin-table-mobile-cards">
            <AdminDataTable minWidth={960}>
              <AdminDataTableHeader
                columns={[
                  { label: locale === 'ru' ? 'Название' : 'Name', width: '24%' },
                  { label: locale === 'ru' ? 'Триггер' : 'Trigger', width: '16%' },
                  { label: locale === 'ru' ? 'Статус' : 'Status', width: '14%' },
                  { label: locale === 'ru' ? 'Последний запуск' : 'Last run', width: '18%' },
                  { label: locale === 'ru' ? 'Следующий запуск' : 'Next run', width: '18%' },
                  { label: locale === 'ru' ? 'Действия' : 'Actions', align: 'right', width: '10%' },
                ]}
              />
              <AdminDataTableBody>
                {automations.map((auto) => (
                  <AdminDataTableRow key={auto.id}>
                    <AdminDataTableCell><AdminTableCellMain title={auto.name} subtitle={auto.trigger} /></AdminDataTableCell>
                    <AdminDataTableCell className="signal-muted">{auto.trigger}</AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone={toneByStatus[auto.status] ?? 'neutral'}>{auto.status}</StatusBadge></AdminDataTableCell>
                    <AdminDataTableCell className="signal-muted">{auto.lastRunAt ? new Date(auto.lastRunAt).toLocaleString() : '—'}</AdminDataTableCell>
                    <AdminDataTableCell className="signal-muted">{auto.nextRunAt ? new Date(auto.nextRunAt).toLocaleString() : '—'}</AdminDataTableCell>
                    <AdminDataTableCell align="right">
                      <AdminTableActions>
                        <button className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Просмотр' : 'View'}</button>
                        <button className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Редактировать' : 'Edit'}</button>
                      </AdminTableActions>
                    </AdminDataTableCell>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>

            <AdminMobileList>
              {automations.map((auto) => (
                <AdminMobileCard
                  key={auto.id}
                  title={auto.name}
                  subtitle={auto.trigger}
                  badge={<StatusBadge tone={toneByStatus[auto.status] ?? 'neutral'}>{auto.status}</StatusBadge>}
                  meta={[
                    { label: locale === 'ru' ? 'Последний запуск' : 'Last run', value: auto.lastRunAt ? new Date(auto.lastRunAt).toLocaleString() : '—' },
                    { label: locale === 'ru' ? 'Следующий запуск' : 'Next run', value: auto.nextRunAt ? new Date(auto.nextRunAt).toLocaleString() : '—' },
                  ]}
                  actions={
                    <AdminTableActions>
                      <button className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Просмотр' : 'View'}</button>
                      <button className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Редактировать' : 'Edit'}</button>
                    </AdminTableActions>
                  }
                />
              ))}
            </AdminMobileList>
          </div>
        )}
      </Panel>
    </div>
  );
}
