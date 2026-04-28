'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminDataTable, AdminDataTableBody, AdminDataTableCell, AdminDataTableHeader, AdminDataTableRow } from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EmptyState, LoadingLines, MetricCard, Notice, Panel, StatusBadge } from '@/components/ui/signal-primitives';

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
      <AdminPageHeader
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
          <div className="admin-table-mobile-cards">
            <AdminDataTable minWidth={760}>
              <AdminDataTableHeader
                columns={[
                  { label: locale === 'ru' ? 'Название сегмента' : 'Segment name', width: '38%' },
                  { label: locale === 'ru' ? 'Размер' : 'Size', width: '18%' },
                  { label: locale === 'ru' ? 'Источник' : 'Source', width: '22%' },
                  { label: locale === 'ru' ? 'Обновлено' : 'Updated', width: '22%' },
                ]}
              />
              <AdminDataTableBody>
                {audience.segments.map((seg: any) => (
                  <AdminDataTableRow key={seg.id}>
                    <AdminDataTableCell><strong>{seg.name}</strong></AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone="info">{seg.size.toLocaleString()}</StatusBadge></AdminDataTableCell>
                    <AdminDataTableCell className="signal-muted">{seg.source}</AdminDataTableCell>
                    <AdminDataTableCell className="signal-muted">{new Date(seg.updatedAt).toLocaleDateString()}</AdminDataTableCell>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>

            <AdminMobileList>
              {audience.segments.map((seg: any) => (
                <AdminMobileCard
                  key={seg.id}
                  title={seg.name}
                  badge={<StatusBadge tone="info">{seg.size.toLocaleString()}</StatusBadge>}
                  meta={[
                    { label: locale === 'ru' ? 'Источник' : 'Source', value: seg.source },
                    { label: locale === 'ru' ? 'Обновлено' : 'Updated', value: new Date(seg.updatedAt).toLocaleDateString() },
                  ]}
                />
              ))}
            </AdminMobileList>
          </div>
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
