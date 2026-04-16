'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbarSearch } from '@/components/admin/AdminToolbar';

export default function AdminEmailDomainsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [domains, setDomains] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin || !isPlatformAdmin) return;

    adminEmailApi.listDomains({})
      .then((res: { data: any[] }) => setDomains(res.data))
      .catch(() => setDomains([]))
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
          description={locale === 'ru' ? 'Управление доменами доступно только платформенным администраторам.' : 'Domain management is only available to platform administrators.'}
        />
      </div>
    );
  }

  const filteredDomains = domains.filter((d) => !search || d.domain?.toLowerCase().includes(search.toLowerCase()));

  const toneByVerification: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
    verified: 'success',
    pending: 'warning',
    failed: 'danger',
  };

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={t('admin.domains') ?? 'Domains'}
        subtitle={locale === 'ru' ? 'Управление sending доменами' : 'Sending domain management'}
        actions={
          <button className="btn btn-primary btn-sm">
            {locale === 'ru' ? 'Добавить домен' : 'Add domain'}
          </button>
        }
      />

      <Panel variant="elevated" className="admin-command-panel">
        <ToolbarRow>
          <AdminToolbarSearch
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по домену...' : 'Search by domain...'}
          />
          <StatusBadge tone="info">{filteredDomains.length} {locale === 'ru' ? 'доменов' : 'domains'}</StatusBadge>
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={6} />
        ) : filteredDomains.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет доменов' : 'No domains'}
            description={locale === 'ru' ? 'Добавьте sending домен для отправки email.' : 'Add a sending domain for email delivery.'}
            actions={
              <button className="btn btn-secondary btn-sm">
                {locale === 'ru' ? 'Добавить домен' : 'Add domain'}
              </button>
            }
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Домен' : 'Domain'}</th>
                  <th>{locale === 'ru' ? 'Провайдер' : 'Provider'}</th>
                  <th>{locale === 'ru' ? 'Верификация' : 'Verification'}</th>
                  <th>{locale === 'ru' ? 'SPF' : 'SPF'}</th>
                  <th>{locale === 'ru' ? 'DKIM' : 'DKIM'}</th>
                  <th>{locale === 'ru' ? 'DMARC' : 'DMARC'}</th>
                  <th>{locale === 'ru' ? 'По умолчанию' : 'Default'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDomains.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.domain}</strong></td>
                    <td className="signal-muted">{d.provider}</td>
                    <td><StatusBadge tone={toneByVerification[d.verificationStatus] ?? 'neutral'}>{d.verificationStatus}</StatusBadge></td>
                    <td><StatusBadge tone={d.spf ? 'success' : 'warning'}>{d.spf ? '✓' : '—'}</StatusBadge></td>
                    <td><StatusBadge tone={d.dkim ? 'success' : 'warning'}>{d.dkim ? '✓' : '—'}</StatusBadge></td>
                    <td><StatusBadge tone={d.dmarc ? 'success' : 'warning'}>{d.dmarc ? '✓' : '—'}</StatusBadge></td>
                    <td>{d.isDefault && <StatusBadge tone="info">{locale === 'ru' ? 'Да' : 'Yes'}</StatusBadge>}</td>
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