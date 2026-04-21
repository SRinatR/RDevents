'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldSelect, LoadingLines, Panel, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbarSearch, AdminToolbarSelect } from '@/components/admin/AdminToolbar';

export default function AdminEmailMessagesPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [messages, setMessages] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin || !isPlatformAdmin) return;

    adminEmailApi.listMessages({ timeRange })
      .then((res) => setMessages(res.data))
      .catch(() => setMessages([]))
      .finally(() => setLoadingData(false));
  }, [user, isAdmin, isPlatformAdmin, timeRange]);

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

  const filteredMessages = messages.filter((msg) => {
    const searchPass = !search ||
      msg.to?.toLowerCase().includes(search.toLowerCase()) ||
      msg.subject?.toLowerCase().includes(search.toLowerCase());
    const statusPass = statusFilter === 'ALL' || msg.status === statusFilter;
    const sourcePass = sourceFilter === 'ALL' || msg.source === sourceFilter;
    return searchPass && statusPass && sourcePass;
  });

  const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    delivered: 'success',
    sent: 'info',
    pending: 'warning',
    failed: 'danger',
    bounced: 'danger',
  };

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={t('admin.messages') ?? 'Messages'}
        subtitle={locale === 'ru' ? 'Журнал всех email сообщений' : 'Email message log'}
      />

      <Panel variant="elevated" className="admin-command-panel">
        <ToolbarRow>
          <AdminToolbarSearch
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по получателю или теме...' : 'Search by recipient or subject...'}
          />
          <AdminToolbarSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
            <option value="delivered">{locale === 'ru' ? 'Доставлено' : 'Delivered'}</option>
            <option value="sent">{locale === 'ru' ? 'Отправлено' : 'Sent'}</option>
            <option value="pending">{locale === 'ru' ? 'В ожидании' : 'Pending'}</option>
            <option value="failed">{locale === 'ru' ? 'Ошибка' : 'Failed'}</option>
            <option value="bounced">{locale === 'ru' ? 'Отказ' : 'Bounced'}</option>
          </AdminToolbarSelect>
          <AdminToolbarSelect value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="ALL">{locale === 'ru' ? 'Все источники' : 'All sources'}</option>
            <option value="verification">{locale === 'ru' ? 'Верификация' : 'Verification'}</option>
            <option value="invitation">{locale === 'ru' ? 'Приглашение' : 'Invitation'}</option>
            <option value="notification">{locale === 'ru' ? 'Уведомление' : 'Notification'}</option>
            <option value="broadcast">{locale === 'ru' ? 'Рассылка' : 'Broadcast'}</option>
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
        ) : filteredMessages.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет сообщений' : 'No messages'}
            description={locale === 'ru' ? 'Сообщений в выбранном диапазоне не найдено.' : 'No messages found in selected range.'}
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
                </tr>
              </thead>
              <tbody>
                {filteredMessages.map((msg) => (
                  <tr key={msg.id}>
                    <td className="signal-overflow-ellipsis">{msg.to}</td>
                    <td></td>
                    <td className="signal-overflow-ellipsis">{msg.subject}</td>
                    <td>{msg.source}</td>
                    <td className="signal-muted">{new Date(msg.sentAt).toLocaleString()}</td>
                    <td className="signal-muted signal-overflow-ellipsis">{msg.providerMessageId ?? '—'}</td>
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
