'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, MetricCard, PageHeader, Panel, StatusBadge } from '@/components/ui/signal-primitives';

export default function AdminEmailPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [overview, setOverview] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    adminEmailApi.getOverview()
      .then(setOverview)
      .catch(() => setOverview(null))
      .finally(() => setLoadingData(false));
  }, [user, isAdmin]);

  if (loading || !user || !isAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="signal-page-shell admin-control-page">
        <EmptyState
          title={locale === 'ru' ? 'Доступ запрещён' : 'Access denied'}
          description={locale === 'ru' ? 'Управление email доступно только платформенным администраторам.' : 'Email management is only available to platform administrators.'}
        />
      </div>
    );
  }

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={t('admin.email') ?? 'Email'}
        subtitle={locale === 'ru' ? 'Центр управления коммуникациями' : 'Communication control center'}
      />

      {/* KPI cards */}
      {loadingData ? (
        <div className="signal-kpi-grid"><LoadingLines rows={6} /></div>
      ) : overview ? (
        <>
          <div className="signal-kpi-grid">
            <MetricCard
              tone={overview.providerStatus === 'connected' ? 'success' : 'warning'}
              label={locale === 'ru' ? 'Статус провайдера' : 'Provider status'}
              value={overview.providerStatus ?? 'unknown'}
            />
            <MetricCard
              tone={overview.sendingDomainStatus === 'verified' ? 'success' : 'warning'}
              label={locale === 'ru' ? 'Sending домен' : 'Sending domain'}
              value={overview.sendingDomainStatus ?? 'unknown'}
            />
            <MetricCard
              tone={overview.webhookStatus === 'active' ? 'success' : 'neutral'}
              label={locale === 'ru' ? 'Webhook статус' : 'Webhook status'}
              value={overview.webhookStatus ?? 'inactive'}
            />
            <MetricCard tone="info" label={locale === 'ru' ? 'Отправлено 24ч' : 'Sent 24h'} value={overview.sent24h ?? 0} />
            <MetricCard tone="success" label={locale === 'ru' ? 'Доставлено 24ч' : 'Delivered 24h'} value={overview.delivered24h ?? 0} />
            <MetricCard tone="danger" label={locale === 'ru' ? 'Ошибки/отказы 24ч' : 'Failed/bounced 24h'} value={overview.failed24h ?? 0} />
          </div>

          <div className="signal-kpi-grid">
            <MetricCard tone="neutral" label={locale === 'ru' ? 'Шаблонов' : 'Templates'} value={overview.templatesCount ?? 0} />
            <MetricCard tone="neutral" label={locale === 'ru' ? 'Автоматизаций' : 'Automations'} value={overview.automationsCount ?? 0} />
          </div>
        </>
      ) : (
        <EmptyState
          title={locale === 'ru' ? 'Нет данных' : 'No data'}
          description={locale === 'ru' ? 'Данные email будут загружены после подключения провайдера.' : 'Email data will be loaded after provider connection.'}
        />
      )}

      {/* Quick links */}
      <div className="admin-quick-links-row">
        <Link href={`/${locale}/admin/email/messages`} className="signal-chip-link">{locale === 'ru' ? 'Сообщения' : 'Messages'}</Link>
        <Link href={`/${locale}/admin/email/templates`} className="signal-chip-link">{locale === 'ru' ? 'Шаблоны' : 'Templates'}</Link>
        <Link href={`/${locale}/admin/email/broadcasts`} className="signal-chip-link">{locale === 'ru' ? 'Рассылки' : 'Broadcasts'}</Link>
        <Link href={`/${locale}/admin/email/automations`} className="signal-chip-link">{locale === 'ru' ? 'Автоматизации' : 'Automations'}</Link>
        <Link href={`/${locale}/admin/email/audience`} className="signal-chip-link">{locale === 'ru' ? 'Аудитория' : 'Audience'}</Link>
        <Link href={`/${locale}/admin/email/domains`} className="signal-chip-link">{locale === 'ru' ? 'Домены' : 'Domains'}</Link>
        <Link href={`/${locale}/admin/email/webhooks`} className="signal-chip-link">{locale === 'ru' ? 'Webhooks' : 'Webhooks'}</Link>
      </div>

      {/* Provider configuration status */}
      <Panel variant="elevated" className="admin-command-panel">
        <div className="signal-section-header">
          <div>
            <h2>{locale === 'ru' ? 'Конфигурация провайдера' : 'Provider configuration'}</h2>
            <p className="signal-muted">{locale === 'ru' ? 'Текущее состояние интеграции email' : 'Current email integration state'}</p>
          </div>
        </div>
        {loadingData ? (
          <LoadingLines rows={4} />
        ) : overview ? (
          <div className="signal-stack">
            <div className="signal-ranked-item">
              <span>{locale === 'ru' ? 'Провайдер' : 'Provider'}</span>
              <StatusBadge tone="info">{overview.provider ?? 'Not configured'}</StatusBadge>
            </div>
            <div className="signal-ranked-item">
              <span>{locale === 'ru' ? 'Отправляющий домен' : 'Sending domain'}</span>
              <StatusBadge tone={overview.sendingDomainStatus === 'verified' ? 'success' : 'warning'}>
                {overview.sendingDomain ?? 'Not configured'}
              </StatusBadge>
            </div>
            <div className="signal-ranked-item">
              <span>{locale === 'ru' ? 'Вебхук endpoint' : 'Webhook endpoint'}</span>
              <StatusBadge tone={overview.webhookStatus === 'active' ? 'success' : 'neutral'}>
                {overview.webhookEndpoint ?? 'Not configured'}
              </StatusBadge>
            </div>
          </div>
        ) : (
          <p className="signal-muted">{locale === 'ru' ? 'Подключите email провайдер в настройках.' : 'Connect an email provider in settings.'}</p>
        )}
      </Panel>

      {/* Recent activity */}
      <Panel variant="subtle" className="admin-command-panel">
        <div className="signal-section-header">
          <div>
            <h2>{locale === 'ru' ? 'Недавняя активность' : 'Recent activity'}</h2>
            <p className="signal-muted">{locale === 'ru' ? 'Последние события email' : 'Latest email events'}</p>
          </div>
        </div>
        {loadingData ? (
          <LoadingLines rows={5} />
        ) : overview?.recentActivity?.length ? (
          <div className="signal-ranked-list">
            {overview.recentActivity.map((event: any, index: number) => (
              <div className="signal-ranked-item" key={index}>
                <span className="signal-rank">{index + 1}</span>
                <span className="signal-overflow-ellipsis">{event.type}</span>
                <StatusBadge tone={event.status === 'delivered' ? 'success' : event.status === 'failed' ? 'danger' : 'neutral'}>
                  {event.status}
                </StatusBadge>
              </div>
            ))}
          </div>
        ) : (
          <p className="signal-muted">{locale === 'ru' ? 'Журнал событий будет заполняться по мере работы системы.' : 'Event log will populate as the system operates.'}</p>
        )}
      </Panel>
    </div>
  );
}
