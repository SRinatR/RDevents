'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbarSearch, AdminToolbarSelect } from '@/components/admin/AdminToolbar';

type EmailMessageRow = {
  id: string;
  to: string;
  subject: string;
  status: string;
  source: string;
  sentAt: string;
  createdAt?: string;
  errorText?: string | null;
  providerMessageId: string | null;
};

const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  delivered: 'success',
  opened: 'success',
  clicked: 'success',
  sent: 'info',
  pending: 'warning',
  failed: 'danger',
  bounced: 'danger',
  complained: 'danger',
};

export default function AdminEmailMessagesPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [messages, setMessages] = useState<EmailMessageRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  const loadMessages = useCallback(async () => {
    setLoadingData(true);
    setError(null);

    try {
      const params: Record<string, string> = {
        timeRange,
        status: statusFilter,
        source: sourceFilter,
      };
      if (search.trim()) params.search = search.trim();

      const res = await adminEmailApi.listMessages(params);
      setMessages(res.data);
    } catch (e) {
      console.error('Load email messages failed:', e);
      setMessages([]);
      setError(locale === 'ru' ? 'Не удалось загрузить журнал сообщений.' : 'Failed to load email message log.');
    } finally {
      setLoadingData(false);
    }
  }, [locale, search, sourceFilter, statusFilter, timeRange]);

  useEffect(() => {
    if (!user || !isAdmin || !isPlatformAdmin) return;
    void loadMessages();
  }, [user, isAdmin, isPlatformAdmin, loadMessages]);

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
      <AdminPageHeader
        title={t('admin.messages') ?? 'Messages'}
        subtitle={locale === 'ru' ? 'Журнал реальных email сообщений и статусов доставки' : 'Real email message and delivery status log'}
        actions={<button className="btn btn-secondary btn-sm" onClick={() => void loadMessages()} disabled={loadingData}>{locale === 'ru' ? 'Обновить' : 'Refresh'}</button>}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Panel variant="elevated" className="admin-command-panel">
        <ToolbarRow>
          <AdminToolbarSearch
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === 'ru' ? 'Получатель, тема или provider id...' : 'Recipient, subject, or provider id...'}
          />
          <AdminToolbarSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
            <option value="pending">{locale === 'ru' ? 'В ожидании' : 'Pending'}</option>
            <option value="sent">{locale === 'ru' ? 'Отправлено' : 'Sent'}</option>
            <option value="delivered">{locale === 'ru' ? 'Доставлено' : 'Delivered'}</option>
            <option value="opened">{locale === 'ru' ? 'Открыто' : 'Opened'}</option>
            <option value="clicked">{locale === 'ru' ? 'Клик' : 'Clicked'}</option>
            <option value="failed">{locale === 'ru' ? 'Ошибка' : 'Failed'}</option>
            <option value="bounced">{locale === 'ru' ? 'Отказ' : 'Bounced'}</option>
            <option value="complained">{locale === 'ru' ? 'Жалоба' : 'Complained'}</option>
          </AdminToolbarSelect>
          <AdminToolbarSelect value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="ALL">{locale === 'ru' ? 'Все источники' : 'All sources'}</option>
            <option value="verification">{locale === 'ru' ? 'Верификация' : 'Verification'}</option>
            <option value="password_reset">{locale === 'ru' ? 'Сброс пароля' : 'Password reset'}</option>
            <option value="invitation">{locale === 'ru' ? 'Приглашение' : 'Invitation'}</option>
            <option value="notification">{locale === 'ru' ? 'Уведомление' : 'Notification'}</option>
            <option value="broadcast">{locale === 'ru' ? 'Рассылка' : 'Broadcast'}</option>
            <option value="system">{locale === 'ru' ? 'Система' : 'System'}</option>
          </AdminToolbarSelect>
          <AdminToolbarSelect value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="1h">{locale === 'ru' ? '1 час' : '1 hour'}</option>
            <option value="24h">{locale === 'ru' ? '24 часа' : '24 hours'}</option>
            <option value="7d">{locale === 'ru' ? '7 дней' : '7 days'}</option>
            <option value="30d">{locale === 'ru' ? '30 дней' : '30 days'}</option>
          </AdminToolbarSelect>
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={8} />
        ) : messages.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет сообщений' : 'No messages'}
            description={locale === 'ru' ? 'Сообщений в выбранном диапазоне не найдено.' : 'No messages found in the selected range.'}
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Кому' : 'To'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{locale === 'ru' ? 'Тема' : 'Subject'}</th>
                  <th>{locale === 'ru' ? 'Источник' : 'Source'}</th>
                  <th>{locale === 'ru' ? 'Отправлено' : 'Sent'}</th>
                  <th>{locale === 'ru' ? 'ID провайдера' : 'Provider ID'}</th>
                  <th>{locale === 'ru' ? 'Ошибка' : 'Error'}</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => (
                  <tr key={msg.id}>
                    <td className="signal-overflow-ellipsis">{msg.to}</td>
                    <td><StatusBadge tone={toneByStatus[msg.status] ?? 'neutral'}>{msg.status}</StatusBadge></td>
                    <td className="signal-overflow-ellipsis">{msg.subject}</td>
                    <td><StatusBadge tone="neutral">{msg.source}</StatusBadge></td>
                    <td className="signal-muted">{new Date(msg.sentAt).toLocaleString()}</td>
                    <td className="signal-muted signal-overflow-ellipsis">{msg.providerMessageId ?? '-'}</td>
                    <td className="signal-muted signal-overflow-ellipsis">{msg.errorText ?? '-'}</td>
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
