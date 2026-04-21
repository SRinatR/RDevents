'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, Panel, TableShell } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

export default function AdminEmailBroadcastsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin || !isPlatformAdmin) return;

    adminEmailApi.listBroadcasts({})
      .then((res) => setBroadcasts(res.data))
      .catch(() => setBroadcasts([]))
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
          description={locale === 'ru' ? 'Управление рассылками доступно только платформенным администраторам.' : 'Broadcast management is only available to platform administrators.'}
        />
      </div>
    );
  }

  const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    sent: 'success',
    scheduled: 'info',
    draft: 'warning',
    failed: 'danger',
  };

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={t('admin.broadcasts') ?? 'Broadcasts'}
        subtitle={locale === 'ru' ? 'Массовые email рассылки' : 'Mass email broadcasts'}
        actions={
          <button className="btn btn-primary btn-sm">
            {locale === 'ru' ? 'Создать рассылку' : 'Create broadcast'}
          </button>
        }
      />

      <Panel variant="elevated" className="admin-command-panel">
        {loadingData ? (
          <LoadingLines rows={6} />
        ) : broadcasts.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет рассылок' : 'No broadcasts'}
            description={locale === 'ru' ? 'Создайте массовую email рассылку для вашей аудитории.' : 'Create a mass email broadcast for your audience.'}
            actions={
              <button className="btn btn-secondary btn-sm">
                {locale === 'ru' ? 'Создать рассылку' : 'Create broadcast'}
              </button>
            }
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Название' : 'Title'}</th>
                  <th>{locale === 'ru' ? 'Аудитория' : 'Audience'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{locale === 'ru' ? 'Запланировано' : 'Scheduled'}</th>
                  <th>{locale === 'ru' ? 'Отправлено' : 'Sent'}</th>
                  <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((bc) => (
                  <tr key={bc.id}>
                    <td><strong>{bc.title}</strong></td>
                    <td className="signal-muted">{bc.audience}</td>
                    <td></td>
                    <td className="signal-muted">{bc.scheduledAt ? new Date(bc.scheduledAt).toLocaleString() : '—'}</td>
                    <td>{bc.sentCount ?? 0}</td>
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