'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Notice, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbarSelect } from '@/components/admin/AdminToolbar';

type EmailBroadcastRow = {
  id: string;
  title: string;
  type: string;
  audienceKind: string;
  subject: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  createdByUserId: string | null;
  totalMatched: number;
  totalEligible: number;
  totalSkipped: number;
  totalRecipients: number;
  queuedCount: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  failedCount: number;
  bouncedCount: number;
  complainedCount: number;
  unsubscribedCount: number;
  errorText: string | null;
};

const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  sent: 'success',
  partial: 'warning',
  sending: 'info',
  scheduled: 'info',
  draft: 'neutral',
  failed: 'danger',
  queued: 'info',
  cancelled: 'neutral',
};

const broadcastStatusLabelRu: Record<string, string> = {
  draft: 'Черновик',
  scheduled: 'Запланирована',
  queued: 'В очереди',
  sending: 'Отправляется',
  sent: 'Отправлена',
  partial: 'Частично отправлена',
  failed: 'Ошибка',
  cancelled: 'Отменена',
};

const typeLabels: Record<string, { ru: string; en: string }> = {
  marketing: { ru: 'Маркетинг', en: 'Marketing' },
  event_announcement: { ru: 'Анонс', en: 'Event' },
  event_reminder: { ru: 'Напоминание', en: 'Reminder' },
  system_notification: { ru: 'Системное', en: 'System' },
  admin_test: { ru: 'Тест', en: 'Test' },
  transactional: { ru: 'Транзакционное', en: 'Transactional' },
};

const audienceLabels: Record<string, { ru: string; en: string }> = {
  mailing_consent: { ru: 'Согласие', en: 'Consent' },
  verified_users: { ru: 'Подтверждённые', en: 'Verified' },
  active_users: { ru: 'Активные', en: 'Active' },
  platform_admins: { ru: 'Админы', en: 'Admins' },
};

function getLabel(record: Record<string, string>, key: string, locale: string) {
  const val = record[key];
  if (!val) return '-';
  const map = (record as any)[`${key}Labels`] as Record<string, { ru: string; en: string }>;
  if (map?.[val]) return map[val][locale === 'ru' ? 'ru' : 'en'];
  return val;
}

type Filters = {
  status: string;
  type: string;
  audienceKind: string;
  search: string;
};

export default function AdminEmailBroadcastsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [broadcasts, setBroadcasts] = useState<EmailBroadcastRow[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    type: 'all',
    audienceKind: 'all',
    search: '',
  });

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    setError(null);

    try {
      const params: Record<string, string | number> = { page: 1, limit: 50 };
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.type !== 'all') params.type = filters.type;
      if (filters.audienceKind !== 'all') params.audienceKind = filters.audienceKind;
      if (filters.search.trim()) params.search = filters.search.trim();

      const result = await adminEmailApi.listBroadcasts(params);
      setBroadcasts(result.data ?? []);
      setMeta(result.meta ?? null);
    } catch {
      setBroadcasts([]);
      setMeta(null);
      setError(locale === 'ru' ? 'Не удалось загрузить рассылки.' : 'Failed to load broadcasts.');
    } finally {
      setLoadingData(false);
    }
  }, [filters, locale]);

  useEffect(() => {
    if (!user || !isAdmin || !isPlatformAdmin) return;
    void loadData();
  }, [user, isAdmin, isPlatformAdmin, loadData]);

  const sendBroadcast = async (broadcastId: string) => {
    setActionId(broadcastId);
    setError(null);
    setNotice(null);

    try {
      const response = await adminEmailApi.sendBroadcast(broadcastId);
      if (response.data.status === 'failed') {
        setError(response.data.errorText || (locale === 'ru' ? 'Рассылка не была отправлена.' : 'Broadcast was not sent.'));
      } else {
        setNotice(locale === 'ru'
          ? `Рассылка обработана: ${response.data.sentCount ?? 0}/${response.data.totalRecipients ?? 0}`
          : `Broadcast processed: ${response.data.sentCount ?? 0}/${response.data.totalRecipients ?? 0}`);
      }
      await loadData();
    } catch {
      setError(locale === 'ru' ? 'Не удалось отправить рассылку.' : 'Failed to send broadcast.');
    } finally {
      setActionId(null);
    }
  };

  const cancelBroadcast = async (broadcastId: string) => {
    setActionId(broadcastId);
    setError(null);
    setNotice(null);

    try {
      await adminEmailApi.cancelBroadcast(broadcastId);
      setNotice(locale === 'ru' ? 'Рассылка отменена.' : 'Broadcast cancelled.');
      await loadData();
    } catch {
      setError(locale === 'ru' ? 'Не удалось отменить рассылку.' : 'Failed to cancel broadcast.');
    } finally {
      setActionId(null);
    }
  };

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

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={t('admin.broadcasts') ?? 'Broadcasts'}
        subtitle={locale === 'ru' ? 'Массовые email рассылки по управляемым сегментам' : 'Mass email broadcasts for controlled segments'}
        actions={<Link className="btn btn-primary btn-sm" href={`/${locale}/admin/email/broadcasts/new`}>{locale === 'ru' ? 'Создать рассылку' : 'Create broadcast'}</Link>}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <Panel variant="elevated" className="admin-command-panel">
        <ToolbarRow>
          <AdminToolbarSelect value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="all">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
            <option value="draft">{locale === 'ru' ? 'Черновики' : 'Drafts'}</option>
            <option value="scheduled">{locale === 'ru' ? 'Запланированные' : 'Scheduled'}</option>
            <option value="queued">{locale === 'ru' ? 'В очереди' : 'Queued'}</option>
            <option value="sending">{locale === 'ru' ? 'Отправляются' : 'Sending'}</option>
            <option value="sent">{locale === 'ru' ? 'Отправленные' : 'Sent'}</option>
            <option value="partial">{locale === 'ru' ? 'Частично' : 'Partial'}</option>
            <option value="failed">{locale === 'ru' ? 'Ошибки' : 'Failed'}</option>
            <option value="cancelled">{locale === 'ru' ? 'Отменённые' : 'Cancelled'}</option>
          </AdminToolbarSelect>

          <AdminToolbarSelect value={filters.type} onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}>
            <option value="all">{locale === 'ru' ? 'Все типы' : 'All types'}</option>
            <option value="marketing">{locale === 'ru' ? 'Маркетинг' : 'Marketing'}</option>
            <option value="event_announcement">{locale === 'ru' ? 'Анонс события' : 'Event announcement'}</option>
            <option value="event_reminder">{locale === 'ru' ? 'Напоминание' : 'Event reminder'}</option>
            <option value="system_notification">{locale === 'ru' ? 'Системное' : 'System'}</option>
            <option value="admin_test">{locale === 'ru' ? 'Тест' : 'Test'}</option>
            <option value="transactional">{locale === 'ru' ? 'Транзакционное' : 'Transactional'}</option>
          </AdminToolbarSelect>

          <AdminToolbarSelect value={filters.audienceKind} onChange={(e) => setFilters(f => ({ ...f, audienceKind: e.target.value }))}>
            <option value="all">{locale === 'ru' ? 'Все аудитории' : 'All audiences'}</option>
            <option value="mailing_consent">{locale === 'ru' ? 'Согласие' : 'Consent'}</option>
            <option value="verified_users">{locale === 'ru' ? 'Подтверждённые' : 'Verified'}</option>
            <option value="active_users">{locale === 'ru' ? 'Активные' : 'Active'}</option>
            <option value="platform_admins">{locale === 'ru' ? 'Админы' : 'Admins'}</option>
          </AdminToolbarSelect>

          <FieldInput
            placeholder={locale === 'ru' ? 'Поиск...' : 'Search...'}
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            style={{ marginLeft: 'auto', minWidth: '200px' }}
          />
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={6} />
        ) : broadcasts.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет рассылок' : 'No broadcasts'}
            description={locale === 'ru' ? 'Создайте рассылку, выберите аудиторию и отправьте её.' : 'Create a broadcast, choose an audience, and send it.'}
            actions={<Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/email/broadcasts/new`}>{locale === 'ru' ? 'Создать рассылку' : 'Create broadcast'}</Link>}
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Название' : 'Title'}</th>
                  <th>{locale === 'ru' ? 'Тип' : 'Type'}</th>
                  <th>{locale === 'ru' ? 'Аудитория' : 'Audience'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{locale === 'ru' ? 'Matched/Eligible/Skipped' : 'Matched/Eligible/Skipped'}</th>
                  <th>{locale === 'ru' ? 'Sent/Delivered/Opened/Clicked/Failed' : 'Sent/Delivered/Opened/Clicked/Failed'}</th>
                  <th>{locale === 'ru' ? 'Запланировано' : 'Scheduled'}</th>
                  <th>{locale === 'ru' ? 'Создано' : 'Created'}</th>
                  <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((bc) => (
                  <tr key={bc.id}>
                    <td>
                      <strong>{bc.title}</strong>
                      <div className="signal-muted signal-overflow-ellipsis" style={{ maxWidth: '200px' }}>{bc.subject}</div>
                    </td>
                    <td>
                      <span className="signal-status-pill tone-neutral" style={{ fontSize: '0.75rem' }}>
                        {typeLabels[bc.type]?.[locale === 'ru' ? 'ru' : 'en'] ?? bc.type}
                      </span>
                    </td>
                    <td className="signal-muted" style={{ fontSize: '0.8125rem' }}>
                      {audienceLabels[bc.audienceKind]?.[locale === 'ru' ? 'ru' : 'en'] ?? bc.audienceKind}
                    </td>
                    <td>
                      <StatusBadge tone={toneByStatus[bc.status] ?? 'neutral'}>
                        {locale === 'ru' ? (broadcastStatusLabelRu[bc.status] ?? bc.status) : bc.status}
                      </StatusBadge>
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      <span className="signal-muted">{bc.totalMatched}</span> /{' '}
                      <span className="signal-success-text">{bc.totalEligible}</span> /{' '}
                      <span className="signal-warning-text">{bc.totalSkipped}</span>
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      <span>{bc.sentCount}</span> /{' '}
                      <span className="signal-success-text">{bc.deliveredCount}</span> /{' '}
                      <span className="signal-info-text">{bc.openedCount}</span> /{' '}
                      <span>{bc.clickedCount}</span> /{' '}
                      <span className="signal-danger-text">{bc.failedCount}</span>
                    </td>
                    <td className="signal-muted" style={{ fontSize: '0.8125rem' }}>
                      {bc.scheduledAt ? new Date(bc.scheduledAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') : '-'}
                    </td>
                    <td className="signal-muted" style={{ fontSize: '0.8125rem' }}>
                      {new Date(bc.createdAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                    </td>
                    <td className="right">
                      <div className="signal-row-actions">
                        {['draft', 'failed', 'partial', 'cancelled'].includes(bc.status) ? (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={actionId === bc.id}
                            onClick={() => void sendBroadcast(bc.id)}
                          >
                            {actionId === bc.id ? '...' : locale === 'ru' ? 'Отправить' : 'Send'}
                          </button>
                        ) : null}
                        {['scheduled', 'queued', 'sending'].includes(bc.status) ? (
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={actionId === bc.id}
                            onClick={() => void cancelBroadcast(bc.id)}
                          >
                            {actionId === bc.id ? '...' : locale === 'ru' ? 'Отменить' : 'Cancel'}
                          </button>
                        ) : null}
                        <Link className="btn btn-ghost btn-sm" href={`/${locale}/admin/email/broadcasts/${bc.id}`}>
                          {locale === 'ru' ? 'Открыть' : 'Open'}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}

        {meta && meta.pages > 1 && (
          <div className="signal-toolbar-row" style={{ marginTop: '1rem', justifyContent: 'center' }}>
            <span className="signal-muted" style={{ fontSize: '0.8125rem' }}>
              {locale === 'ru' ? 'Страница' : 'Page'} {meta.page} {locale === 'ru' ? 'из' : 'of'} {meta.pages} ({meta.total} {locale === 'ru' ? 'рассылок' : 'broadcasts'})
            </span>
          </div>
        )}
      </Panel>
    </div>
  );
}
