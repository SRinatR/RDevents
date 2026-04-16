'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, PageHeader, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

export default function AdminEmailTemplatesPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin || !isPlatformAdmin) return;

    adminEmailApi.listTemplates({})
      .then((res) => setTemplates(res.data))
      .catch(() => setTemplates([]))
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
          description={locale === 'ru' ? 'Управление шаблонами доступно только платформенным администраторам.' : 'Template management is only available to platform administrators.'}
        />
      </div>
    );
  }

  const filteredTemplates = templates.filter((tmpl) => {
    const searchPass = !search || 
      tmpl.name?.toLowerCase().includes(search.toLowerCase()) ||
      tmpl.key?.toLowerCase().includes(search.toLowerCase());
    const statusPass = statusFilter === 'ALL' || tmpl.status === statusFilter;
    return searchPass && statusPass;
  });

  const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    active: 'success',
    draft: 'warning',
    archived: 'neutral',
  };

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={t('admin.templates') ?? 'Templates'}
        subtitle={locale === 'ru' ? 'Управление email шаблонами' : 'Email template management'}
        actions={
          <button className="btn btn-primary btn-sm">
            {locale === 'ru' ? 'Создать шаблон' : 'Create template'}
          </button>
        }
      />

      <Panel variant="elevated" className="admin-command-panel">
        <ToolbarRow>
          <FieldInput 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder={locale === 'ru' ? 'Поиск по названию или ключу...' : 'Search by name or key...'} 
            className="admin-filter-search"
          />
          <FieldSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-filter-select">
            <option value="ALL">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
            <option value="active">{locale === 'ru' ? 'Активные' : 'Active'}</option>
            <option value="draft">{locale === 'ru' ? 'Черновики' : 'Drafts'}</option>
            <option value="archived">{locale === 'ru' ? 'Архивные' : 'Archived'}</option>
          </FieldSelect>
          <StatusBadge tone="info">{filteredTemplates.length} {locale === 'ru' ? 'шаблонов' : 'templates'}</StatusBadge>
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={6} />
        ) : filteredTemplates.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет шаблонов' : 'No templates'}
            description={locale === 'ru' ? 'Создайте первый email шаблон для вашей коммуникации.' : 'Create your first email template for communications.'}
            actions={
              <button className="btn btn-secondary btn-sm">
                {locale === 'ru' ? 'Создать шаблон' : 'Create template'}
              </button>
            }
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Название' : 'Name'}</th>
                  <th>{locale === 'ru' ? 'Ключ' : 'Key'}</th>
                  <th>{locale === 'ru' ? 'Тема' : 'Subject'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{locale === 'ru' ? 'Обновлено' : 'Updated'}</th>
                  <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((tmpl) => (
                  <tr key={tmpl.id}>
                    <td><strong>{tmpl.name}</strong></td>
                    <td className="signal-muted signal-overflow-ellipsis">{tmpl.key}</td>
                    <td className="signal-overflow-ellipsis">{tmpl.subject}</td>
                    <td><StatusBadge tone={toneByStatus[tmpl.status] ?? 'neutral'}>{tmpl.status}</StatusBadge></td>
                    <td className="signal-muted">{new Date(tmpl.updatedAt).toLocaleDateString()}</td>
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