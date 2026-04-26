'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbarSearch } from '@/components/admin/AdminToolbar';

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
        <ToolbarRow>
          <AdminToolbarSearch
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по домену...' : 'Search by domain...'}
          />
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={6} />
        ) : domains.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Домен не настроен' : 'Domain is not configured'}
            description={locale === 'ru' ? 'Укажите RESEND_FROM_EMAIL, чтобы API увидел sending домен.' : 'Set RESEND_FROM_EMAIL so the API can detect the sending domain.'}
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Домен' : 'Domain'}</th>
                  <th>{locale === 'ru' ? 'Провайдер' : 'Provider'}</th>
                  <th>{locale === 'ru' ? 'Верификация' : 'Verification'}</th>
                  <th>SPF</th>
                  <th>DKIM</th>
                  <th>DMARC</th>
                  <th>{locale === 'ru' ? 'По умолчанию' : 'Default'}</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.domain}</strong></td>
                    <td className="signal-muted">{d.provider}</td>
                    <td><StatusBadge tone={toneByVerification[d.verificationStatus] ?? 'neutral'}>{d.verificationStatus}</StatusBadge></td>
                    <td>{boolBadge(Boolean(d.spf))}</td>
                    <td>{boolBadge(Boolean(d.dkim))}</td>
                    <td>{boolBadge(Boolean(d.dmarc))}</td>
                    <td>{boolBadge(Boolean(d.isDefault))}</td>
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
