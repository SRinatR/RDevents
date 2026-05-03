'use client';

import { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, MetricCard, Notice, PageHeader, Panel, StatusBadge } from '@/components/ui/signal-primitives';

function statusLabel(value: string | null | undefined, locale: string) {
  const labels: Record<string, { ru: string; en: string }> = {
    connected: { ru: 'Подключён', en: 'Connected' },
    not_configured: { ru: 'Не настроен', en: 'Not configured' },
    verified: { ru: 'Подтверждён', en: 'Verified' },
    pending: { ru: 'Ожидает', en: 'Pending' },
    failed: { ru: 'Ошибка', en: 'Failed' },
    active: { ru: 'Активен', en: 'Active' },
    inactive: { ru: 'Неактивен', en: 'Inactive' },
    unknown: { ru: 'Неизвестно', en: 'Unknown' },
  };
  const key = String(value ?? 'unknown');
  return labels[key]?.[locale === 'ru' ? 'ru' : 'en'] ?? key;
}

export default function AdminEmailPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [overview, setOverview] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  const loadOverview = useCallback(async () => {
    if (!user || !isAdmin || !isPlatformAdmin) return;

    setLoadingData(true);
    setError(null);

    try {
      const data = await adminEmailApi.getOverview();
      setOverview(data);
    } catch (e) {
      console.error('Load email overview failed:', e);
      setOverview(null);
      setError(locale === 'ru' ? 'Не удалось загрузить состояние email-сервиса.' : 'Failed to load email service state.');
    } finally {
      setLoadingData(false);
    }
  }, [isAdmin, isPlatformAdmin, locale, user]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

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
        actions={(
          <div className="signal-row-actions">
            <Link className="btn btn-primary btn-sm" href={`/${locale}/admin/email/broadcasts/new`}>
              {locale === 'ru' ? 'Создать рассылку' : 'Create broadcast'}
            </Link>
            <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/email/direct`}>
              {locale === 'ru' ? 'Прямое письмо' : 'Direct email'}
            </Link>
            <button className="btn btn-secondary btn-sm" onClick={() => void loadOverview()} disabled={loadingData}>{locale === 'ru' ? 'Обновить' : 'Refresh'}</button>
          </div>
        )}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {/* Warnings */}
      {!loadingData && overview && (
        <>
          {overview.providerStatus !== 'connected' && (
            <Notice tone="danger">
              {locale === 'ru'
                ? 'Email-провайдер не настроен. Рассылки не будут отправляться.'
                : 'Email provider is not configured. Broadcasts will not be sent.'}
            </Notice>
          )}
          {overview.provider === 'log-only' && (
            <Notice tone="warning">
              {locale === 'ru'
                ? 'Включён локальный log-only режим: письма сохраняются в истории, но не отправляются наружу.'
                : 'Local log-only mode is enabled: emails are stored in history but not delivered externally.'}
            </Notice>
          )}
          {overview.providerStatus === 'connected' && overview.sendingDomainStatus !== 'verified' && (
            <Notice tone="warning">
              {locale === 'ru'
                ? 'Sending domain не подтверждён. Возможны проблемы с доставкой.'
                : 'Sending domain is not verified. There may be delivery issues.'}
            </Notice>
          )}
          {overview.providerStatus === 'connected' && overview.webhookStatus !== 'active' && (
            <Notice tone="warning">
              {locale === 'ru'
                ? 'Webhook не активен. Аналитика delivered/opened/clicked/bounced может не обновляться.'
                : 'Webhook is not active. Analytics for delivered/opened/clicked/bounced may not update.'}
            </Notice>
          )}
        </>
      )}

      {/* KPI cards */}
      {loadingData ? (
        <div className="signal-kpi-grid"><LoadingLines rows={6} /></div>
      ) : overview ? (
        <>
          <div className="signal-kpi-grid">
            <MetricCard
              tone={overview.providerStatus === 'connected' ? 'success' : 'warning'}
              label={locale === 'ru' ? 'Статус провайдера' : 'Provider status'}
              value={overview.provider === 'log-only' ? 'Log-only' : statusLabel(overview.providerStatus, locale)}
            />
            <MetricCard
              tone={overview.sendingDomainStatus === 'verified' ? 'success' : 'warning'}
              label={locale === 'ru' ? 'Sending домен' : 'Sending domain'}
              value={statusLabel(overview.sendingDomainStatus, locale)}
            />
            <MetricCard
              tone={overview.webhookStatus === 'active' ? 'success' : 'neutral'}
              label={locale === 'ru' ? 'Webhook статус' : 'Webhook status'}
              value={statusLabel(overview.webhookStatus, locale)}
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
        <Link href={`/${locale}/admin/email/direct`} className="signal-chip-link">{locale === 'ru' ? 'Прямое письмо' : 'Direct email'}</Link>
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
              <StatusBadge tone={overview.providerStatus === 'connected' ? 'success' : 'warning'}>{overview.provider ?? statusLabel(overview.providerStatus, locale)}</StatusBadge>
            </div>
            <div className="signal-ranked-item">
              <span>{locale === 'ru' ? 'Отправляющий домен' : 'Sending domain'}</span>
              <span className="signal-muted">{overview.sendingDomain ?? '-'}</span>
            </div>
            <div className="signal-ranked-item">
              <span>{locale === 'ru' ? 'Вебхук endpoint' : 'Webhook endpoint'}</span>
              <span className="signal-muted signal-overflow-ellipsis">{overview.webhookEndpoint ?? '-'}</span>
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
                <StatusBadge tone={event.status === 'failed' || event.status === 'bounced' || event.status === 'complained' ? 'danger' : 'neutral'}>{event.status}</StatusBadge>
                <span className="signal-muted">{new Date(event.timestamp).toLocaleString()}</span>
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
