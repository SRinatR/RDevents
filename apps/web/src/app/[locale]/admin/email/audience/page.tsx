'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, MetricCard, Notice, PageHeader, Panel, StatusBadge, TableShell } from '@/components/ui/signal-primitives';

export default function AdminEmailAudiencePage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [audience, setAudience] = useState<any>(null);
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
    adminEmailApi.getAudience()
      .then(setAudience)
      .catch((e) => {
        console.error('Load email audience failed:', e);
        setAudience(null);
        setError(locale === 'ru' ? 'Не удалось загрузить аудиторию.' : 'Failed to load audience.');
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
          description={locale === 'ru' ? 'Управление аудиторией доступно только платформенным администраторам.' : 'Audience management is only available to platform administrators.'}
        />
      </div>
    );
  }

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={t('admin.audience') ?? 'Audience'}
        subtitle={locale === 'ru' ? 'Контакты и сегменты' : 'Contacts and segments'}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {/* KPI cards */}
      {loadingData ? (
        <div className="signal-kpi-grid"><LoadingLines rows={4} /></div>
      ) : audience ? (
        <div className="signal-kpi-grid">
          <MetricCard tone="info" label={locale === 'ru' ? 'Всего контактов' : 'Total contacts'} value={audience.totalContacts ?? 0} />
          <MetricCard tone="success" label={locale === 'ru' ? 'Подтверждённых' : 'Verified'} value={audience.verifiedContacts ?? 0} />
          <MetricCard tone="danger" label={locale === 'ru' ? 'Отписавшихся' : 'Unsubscribed'} value={audience.unsubscribed ?? 0} />
          <MetricCard tone="neutral" label={locale === 'ru' ? 'Сегментов' : 'Segments'} value={audience.segmentsCount ?? 0} />
        </div>
      ) : (
        <EmptyState
          title={locale === 'ru' ? 'Нет данных' : 'No data'}
          description={locale === 'ru' ? 'Данные аудитории будут загружены.' : 'Audience data will be loaded.'}
        />
      )}

      {/* Segments table */}
      <Panel variant="elevated" className="admin-command-panel">
        <div className="signal-section-header">
          <div>
            <h2>{locale === 'ru' ? 'Сегменты' : 'Segments'}</h2>
            <p className="signal-muted">{locale === 'ru' ? 'Группы контактов по критериям' : 'Contact groups by criteria'}</p>
          </div>
        </div>

        {loadingData ? (
          <LoadingLines rows={5} />
        ) : audience?.segments?.length ? (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Название сегмента' : 'Segment name'}</th>
                  <th>{locale === 'ru' ? 'Размер' : 'Size'}</th>
                  <th>{locale === 'ru' ? 'Источник' : 'Source'}</th>
                  <th>{locale === 'ru' ? 'Обновлено' : 'Updated'}</th>
                </tr>
              </thead>
              <tbody>
                {audience.segments.map((seg: any) => (
                  <tr key={seg.id}>
                    <td><strong>{seg.name}</strong></td>
                    <td><StatusBadge tone="info">{seg.size.toLocaleString()}</StatusBadge></td>
                    <td className="signal-muted">{seg.source}</td>
                    <td className="signal-muted">{new Date(seg.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        ) : (
          <EmptyState
            title={locale === 'ru' ? 'Нет сегментов' : 'No segments'}
            description={locale === 'ru' ? 'Сегменты будут созданы после настройки автоматизаций.' : 'Segments will be created after automation setup.'}
          />
        )}
      </Panel>
    </div>
  );
}
