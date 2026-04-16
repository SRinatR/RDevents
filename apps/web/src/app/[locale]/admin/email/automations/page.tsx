'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, Panel, StatusBadge, TableShell } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

export default function AdminEmailAutomationsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [automations, setAutomations] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin || !isPlatformAdmin) return;

    adminEmailApi.listAutomations({})
      .then((res: { data: any[] }) => setAutomations(res.data))
      .catch(() => setAutomations([]))
      .finally(() => setLoadingData(false));
  }, [user, isAdmin, isPlatformAdmin]);

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
        actions={
          <button className="btn btn-primary btn-sm">
            {locale === 'ru' ? 'Создать автоматизацию' : 'Create automation'}
          </button>
        }
      />

      <Panel variant="elevated" className="admin-command-panel">
        {loadingData ? (
          <LoadingLines rows={6} />
        ) : automations.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет автоматизаций' : 'No automations'}
            description={locale === 'ru' ? 'Создайте email автоматизацию для автоматической коммуникации.' : 'Create an email automation for automated communication.'}
            actions={
              <button className="btn btn-secondary btn-sm">
                {locale === 'ru' ? 'Создать автоматизацию' : 'Create automation'}
              </button>
            }
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Название' : 'Name'}</th>
                  <th>{locale === 'ru' ? 'Триггер' : 'Trigger'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{locale === 'ru' ? 'Последний запуск' : 'Last run'}</th>
                  <th>{locale === 'ru' ? 'Следующий запуск' : 'Next run'}</th>
                  <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {automations.map((auto) => (
                  <tr key={auto.id}>
                    <td><strong>{auto.name}</strong></td>
                    <td className="signal-muted">{auto.trigger}</td>
                    <td><StatusBadge tone={toneByStatus[auto.status] ?? 'neutral'}>{auto.status}</StatusBadge></td>
                    <td className="signal-muted">{auto.lastRunAt ? new Date(auto.lastRunAt).toLocaleString() : '—'}</td>
                    <td className="signal-muted">{auto.nextRunAt ? new Date(auto.nextRunAt).toLocaleString() : '—'}</td>
                    <td className="right">
                      <div className="signal-row-actions">
                        <button className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Просмотр' : 'View'}</button>
                        <button className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Редактировать' : 'Edit'}</button>
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