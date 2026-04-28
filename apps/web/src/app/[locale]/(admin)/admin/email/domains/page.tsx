'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminDataTable, AdminDataTableBody, AdminDataTableCell, AdminDataTableHeader, AdminDataTableRow, AdminTableCellMain } from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbar, AdminToolbarSearch } from '@/components/admin/AdminToolbar';
import { EmptyState, LoadingLines, Notice, Panel, StatusBadge } from '@/components/ui/signal-primitives';

const toneByVerification: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  verified: 'success',
  pending: 'warning',
  failed: 'danger',
};

export default function AdminEmailDomainsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [domains, setDomains] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin || !isPlatformAdmin) return;

    setLoadingData(true);
    setError(null);
    adminEmailApi.listDomains(search.trim() ? { search: search.trim() } : {})
      .then((res: { data: any[] }) => setDomains(res.data))
      .catch((e) => {
        console.error('Load email domains failed:', e);
        setDomains([]);
        setError(locale === 'ru' ? 'Не удалось загрузить домены.' : 'Failed to load domains.');
      })
      .finally(() => setLoadingData(false));
  }, [user, isAdmin, isPlatformAdmin, locale, search]);

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

  const boolBadge = (value: boolean) => (
    <StatusBadge tone={value ? 'success' : 'warning'}>{value ? 'OK' : '-'}</StatusBadge>
  );

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={t('admin.domains') ?? 'Domains'}
        subtitle={locale === 'ru' ? 'Состояние sending домена из env-конфигурации' : 'Sending domain status from env configuration'}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Panel variant="elevated" className="admin-command-panel">
        <AdminToolbar>
          <AdminToolbarSearch
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по домену...' : 'Search by domain...'}
          />
        </AdminToolbar>

        {loadingData ? (
          <LoadingLines rows={6} />
        ) : domains.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Домен не настроен' : 'Domain is not configured'}
            description={locale === 'ru' ? 'Укажите RESEND_FROM_EMAIL, чтобы API увидел sending домен.' : 'Set RESEND_FROM_EMAIL so the API can detect the sending domain.'}
          />
        ) : (
          <div className="admin-table-mobile-cards">
            <AdminDataTable minWidth={900}>
              <AdminDataTableHeader
                columns={[
                  { label: locale === 'ru' ? 'Домен' : 'Domain', width: '26%' },
                  { label: locale === 'ru' ? 'Провайдер' : 'Provider', width: '16%' },
                  { label: locale === 'ru' ? 'Верификация' : 'Verification', width: '16%' },
                  { label: 'SPF', width: '10%' },
                  { label: 'DKIM', width: '10%' },
                  { label: 'DMARC', width: '10%' },
                  { label: locale === 'ru' ? 'По умолчанию' : 'Default', width: '12%' },
                ]}
              />
              <AdminDataTableBody>
                {domains.map((d) => (
                  <AdminDataTableRow key={d.id}>
                    <AdminDataTableCell><AdminTableCellMain title={d.domain} subtitle={d.provider} /></AdminDataTableCell>
                    <AdminDataTableCell className="signal-muted">{d.provider}</AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone={toneByVerification[d.verificationStatus] ?? 'neutral'}>{d.verificationStatus}</StatusBadge></AdminDataTableCell>
                    <AdminDataTableCell>{boolBadge(Boolean(d.spf))}</AdminDataTableCell>
                    <AdminDataTableCell>{boolBadge(Boolean(d.dkim))}</AdminDataTableCell>
                    <AdminDataTableCell>{boolBadge(Boolean(d.dmarc))}</AdminDataTableCell>
                    <AdminDataTableCell>{boolBadge(Boolean(d.isDefault))}</AdminDataTableCell>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>

            <AdminMobileList>
              {domains.map((d) => (
                <AdminMobileCard
                  key={d.id}
                  title={d.domain}
                  subtitle={d.provider}
                  badge={<StatusBadge tone={toneByVerification[d.verificationStatus] ?? 'neutral'}>{d.verificationStatus}</StatusBadge>}
                  meta={[
                    { label: 'SPF', value: boolBadge(Boolean(d.spf)) },
                    { label: 'DKIM', value: boolBadge(Boolean(d.dkim)) },
                    { label: 'DMARC', value: boolBadge(Boolean(d.dmarc)) },
                    { label: locale === 'ru' ? 'По умолчанию' : 'Default', value: boolBadge(Boolean(d.isDefault)) },
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
