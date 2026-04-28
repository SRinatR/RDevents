'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, Panel, StatusBadge } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbar, AdminToolbarSearch, AdminToolbarSelect } from '@/components/admin/AdminToolbar';
import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCell,
  AdminDataTableHeader,
  AdminDataTableRow,
  AdminTableCellMain,
} from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';

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
        <AdminToolbar>
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
        </AdminToolbar>

        {loadingData ? (
          <LoadingLines rows={8} />
        ) : messages.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет сообщений' : 'No messages'}
            description={locale === 'ru' ? 'Сообщений в выбранном диапазоне не найдено.' : 'No messages found in the selected range.'}
          />
        ) : (
          <div className="admin-table-mobile-cards">
            <AdminDataTable minWidth={1100}>
              <AdminDataTableHeader
                columns={[
                  { label: locale === 'ru' ? 'Кому' : 'To', width: '18%' },
                  { label: locale === 'ru' ? 'Статус' : 'Status', width: '11%' },
                  { label: locale === 'ru' ? 'Тема' : 'Subject', width: '20%' },
                  { label: locale === 'ru' ? 'Источник' : 'Source', width: '12%' },
                  { label: locale === 'ru' ? 'Отправлено' : 'Sent', width: '15%' },
                  { label: locale === 'ru' ? 'ID провайдера' : 'Provider ID', width: '12%' },
                  { label: locale === 'ru' ? 'Ошибка' : 'Error', width: '12%' },
                ]}
              />
              <AdminDataTableBody>
                {messages.map((msg) => (
                  <AdminDataTableRow key={msg.id}>
                    <AdminDataTableCell truncate>{msg.to}</AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone={toneByStatus[msg.status] ?? 'neutral'}>{msg.status}</StatusBadge></AdminDataTableCell>
                    <AdminDataTableCell><AdminTableCellMain title={msg.subject} subtitle={msg.source} /></AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone="neutral">{msg.source}</StatusBadge></AdminDataTableCell>
                    <AdminDataTableCell className="signal-muted">{new Date(msg.sentAt).toLocaleString()}</AdminDataTableCell>
                    <AdminDataTableCell truncate className="signal-muted">{msg.providerMessageId ?? '-'}</AdminDataTableCell>
                    <AdminDataTableCell truncate className="signal-muted">{msg.errorText ?? '-'}</AdminDataTableCell>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>

            <AdminMobileList>
              {messages.map((msg) => (
                <AdminMobileCard
                  key={msg.id}
                  title={msg.to}
                  subtitle={msg.subject}
                  badge={<StatusBadge tone={toneByStatus[msg.status] ?? 'neutral'}>{msg.status}</StatusBadge>}
                  meta={[
                    { label: locale === 'ru' ? 'Источник' : 'Source', value: msg.source },
                    { label: locale === 'ru' ? 'Отправлено' : 'Sent', value: new Date(msg.sentAt).toLocaleString() },
                    { label: locale === 'ru' ? 'Provider ID' : 'Provider ID', value: msg.providerMessageId ?? '-' },
                    { label: locale === 'ru' ? 'Ошибка' : 'Error', value: msg.errorText ?? '-' },
                  ]}
                />
              ))}
            </AdminMobileList>
          </div>
        )}
      </Panel>
    </div>
  );
}
