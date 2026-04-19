'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Notice, PageHeader, Panel, SectionHeader, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

type ApplicationRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userCity?: string | null;
  eventId: string;
  eventTitle: string;
  status: string;
  assignedAt: string;
  answers?: Record<string, unknown> | null;
  firstNameCyrillic?: string | null;
  lastNameCyrillic?: string | null;
  middleNameCyrillic?: string | null;
  firstNameLatin?: string | null;
  lastNameLatin?: string | null;
  middleNameLatin?: string | null;
  fullNameCyrillic?: string | null;
  fullNameLatin?: string | null;
};

const STATUS_FILTERS = ['ALL', 'PENDING', 'ACTIVE', 'RESERVE', 'REJECTED', 'CANCELLED'] as const;

export default function AdminApplicationsPage() {
  const { user, loading, isAdmin } = useAuth();
  const locale = useRouteLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; title: string }>>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [stickyIds, setStickyIds] = useState<Record<string, boolean>>({});

  const search = searchParams.get('search') ?? '';
  const eventFilter = searchParams.get('eventId') ?? 'ALL';
  const statusFilter = searchParams.get('status') ?? 'ALL';

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [loading, user, isAdmin, router, locale]);

  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === 'ALL') params.delete(key);
    else params.set(key, value);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const fetchEvents = useCallback(async () => {
    try {
      const result = await adminApi.listEvents({ limit: 100 });
      setEvents((result.data ?? []).map((item: any) => ({ id: item.id, title: item.title })));
    } catch {
      setEvents([]);
    }
  }, []);

  const fetchApplications = useCallback(async () => {
    setLoadingData(true);
    setError('');
    try {
      const result = await adminApi.listParticipants({
        role: 'PARTICIPANT',
        search: search || undefined,
        eventId: eventFilter !== 'ALL' ? eventFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        limit: 100,
      });
      setApplications(result.data ?? []);
    } catch (err: any) {
      setApplications([]);
      setError(err.message || (locale === 'ru' ? 'Не удалось загрузить заявки.' : 'Failed to load applications.'));
    } finally {
      setLoadingData(false);
    }
  }, [eventFilter, locale, search, statusFilter]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    void fetchEvents();
  }, [user, isAdmin, fetchEvents]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    void fetchApplications();
  }, [user, isAdmin, fetchApplications]);

  const statusLabel = useCallback((status: string) => {
    const ru: Record<string, string> = {
      PENDING: 'Заявка на рассмотрении',
      ACTIVE: 'Принято',
      RESERVE: 'Резерв',
      REJECTED: 'Отклонено',
      CANCELLED: 'Отменено',
      REMOVED: 'Удалено',
    };
    const en: Record<string, string> = {
      PENDING: 'Pending review',
      ACTIVE: 'Approved',
      RESERVE: 'Reserve',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled',
      REMOVED: 'Removed',
    };
    return (locale === 'ru' ? ru : en)[status] ?? status;
  }, [locale]);

  const visibleRows = useMemo(() => {
    if (statusFilter === 'ALL') return applications;
    return applications.filter((item) => item.status === statusFilter || stickyIds[item.id]);
  }, [applications, statusFilter, stickyIds]);

  const updateStatus = useCallback(async (row: ApplicationRow, nextStatus: 'ACTIVE' | 'RESERVE' | 'REJECTED') => {
    setActionId(row.id);
    setError('');
    try {
      await adminApi.updateParticipantStatus(row.eventId, row.id, { status: nextStatus });
      setApplications((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: nextStatus } : item)));
      setStickyIds((prev) => ({ ...prev, [row.id]: true }));
    } catch (err: any) {
      setError(err.message || (locale === 'ru' ? 'Не удалось обновить статус заявки.' : 'Failed to update application status.'));
    } finally {
      setActionId(null);
    }
  }, [locale]);

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={locale === 'ru' ? 'Приём заявок' : 'Application intake'}
        subtitle={locale === 'ru' ? 'Единый реестр заявок участников с модерацией' : 'Unified participant application registry with moderation'}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Panel variant="elevated" className="admin-command-panel admin-data-panel">
        <SectionHeader
          title={locale === 'ru' ? 'Реестр заявок' : 'Application registry'}
          subtitle={locale === 'ru' ? 'Поиск по имени, email, городу, дате и названию события' : 'Search by name, email, city, date, and event title'}
        />

        <ToolbarRow>
          <FieldInput
            value={search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по ФИО, email, дате, событию' : 'Search by full name, email, date, event'}
            className="admin-filter-search"
          />
          <FieldSelect value={eventFilter} onChange={(event) => updateFilter('eventId', event.target.value)} className="admin-filter-select">
            <option value="ALL">{locale === 'ru' ? 'Все события' : 'All events'}</option>
            {events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </FieldSelect>
          <FieldSelect value={statusFilter} onChange={(event) => updateFilter('status', event.target.value)} className="admin-filter-select">
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>{status === 'ALL' ? (locale === 'ru' ? 'Все статусы' : 'All statuses') : statusLabel(status)}</option>
            ))}
          </FieldSelect>
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={8} />
        ) : visibleRows.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Заявки не найдены' : 'No applications found'}
            description={locale === 'ru' ? 'Измените фильтры или дождитесь новых заявок.' : 'Adjust filters or wait for new applications.'}
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Заявитель' : 'Applicant'}</th>
                  <th>{locale === 'ru' ? 'Email' : 'Email'}</th>
                  <th>{locale === 'ru' ? 'Город' : 'City'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{locale === 'ru' ? 'Дата' : 'Date'}</th>
                  <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                  <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const displayName = row.userName
                    ?? row.fullNameCyrillic
                    ?? row.fullNameLatin
                    ?? [row.lastNameCyrillic, row.firstNameCyrillic, row.middleNameCyrillic].filter(Boolean).join(' ')
                    ?? [row.lastNameLatin, row.firstNameLatin, row.middleNameLatin].filter(Boolean).join(' ')
                    ?? row.userEmail
                    ?? '—';

                  return (
                    <Fragment key={row.id}>
                      <tr>
                        <td><strong>{displayName || '—'}</strong></td>
                        <td className="signal-overflow-ellipsis">{row.userEmail || '—'}</td>
                        <td>{row.userCity || '—'}</td>
                        <td>{statusLabel(row.status)}</td>
                        <td className="signal-muted">{new Date(row.assignedAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')}</td>
                        <td className="signal-overflow-ellipsis">{row.eventTitle || '—'}</td>
                        <td className="right">
                          <div className="signal-row-actions">
                            {row.status === 'PENDING' ? (
                              <>
                                <button type="button" className="btn btn-primary btn-sm" disabled={actionId === row.id} onClick={() => void updateStatus(row, 'ACTIVE')}>{locale === 'ru' ? 'Принять' : 'Approve'}</button>
                                <button type="button" className="btn btn-secondary btn-sm" disabled={actionId === row.id} onClick={() => void updateStatus(row, 'RESERVE')}>{locale === 'ru' ? 'Резерв' : 'Reserve'}</button>
                                <button type="button" className="btn btn-danger btn-sm" disabled={actionId === row.id} onClick={() => void updateStatus(row, 'REJECTED')}>{locale === 'ru' ? 'Отклонить' : 'Reject'}</button>
                              </>
                            ) : null}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                              {expandedId === row.id ? (locale === 'ru' ? 'Скрыть' : 'Hide') : (locale === 'ru' ? 'Анкета' : 'Form')}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === row.id ? (
                        <tr className="admin-expanded-row">
                          <td colSpan={7}>
                            {row.answers && Object.keys(row.answers).length > 0 ? (
                              <div className="admin-answer-grid">
                                {Object.entries(row.answers).map(([key, value]) => (
                                  <div key={key}>
                                    <small>{key}</small>
                                    <strong>{String(value)}</strong>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="signal-muted">{locale === 'ru' ? 'Ответов анкеты пока нет.' : 'No form answers yet.'}</span>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}
