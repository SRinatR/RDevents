'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminDataTable, AdminDataTableBody, AdminDataTableCell, AdminDataTableHeader, AdminDataTableRow, AdminTableActions, AdminTableCellMain } from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Notice, Panel, SectionHeader, StatusBadge } from '@/components/ui/signal-primitives';

type ApplicationRow = {
  id: string;
  applicationType: 'PARTICIPANT' | 'VOLUNTEER' | 'TEAM';
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
  teamId?: string | null;
  teamName?: string | null;
  teamCaptainName?: string | null;
};

const STATUS_FILTERS = ['ALL', 'PENDING', 'ACTIVE', 'RESERVE', 'REJECTED', 'CANCELLED'] as const;
const TYPE_FILTERS = ['ALL', 'PARTICIPANT', 'VOLUNTEER', 'TEAM'] as const;

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
  const typeFilter = searchParams.get('type') ?? 'ALL';
  const [rawSearch, setRawSearch] = useState(search);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [loading, user, isAdmin, router, locale]);

  useEffect(() => {
    setRawSearch(search);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get('search') ?? '';
      const next = rawSearch.trim();
      if (next === current) return;

      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set('search', next);
      else params.delete('search');

      router.replace(`?${params.toString()}`, { scroll: false });
    }, 350);

    return () => clearTimeout(timer);
  }, [rawSearch, router, searchParams]);

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
      const result = await adminApi.listApplications({
        search: search || undefined,
        eventId: eventFilter !== 'ALL' ? eventFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        limit: 150,
      });
      setApplications(result.data ?? []);
    } catch (err: any) {
      setApplications([]);
      setError(err.message || (locale === 'ru' ? 'Не удалось загрузить заявки.' : 'Failed to load applications.'));
    } finally {
      setLoadingData(false);
    }
  }, [eventFilter, locale, search, statusFilter, typeFilter]);

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

  const typeLabel = useCallback((type: string) => {
    const ru: Record<string, string> = {
      PARTICIPANT: 'Участник',
      VOLUNTEER: 'Волонтёр',
      TEAM: 'Команда',
    };
    const en: Record<string, string> = {
      PARTICIPANT: 'Participant',
      VOLUNTEER: 'Volunteer',
      TEAM: 'Team',
    };
    return (locale === 'ru' ? ru : en)[type] ?? type;
  }, [locale]);

  const statusTone = useCallback((status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    if (status === 'ACTIVE') return 'success';
    if (status === 'PENDING' || status === 'RESERVE') return 'warning';
    if (status === 'REJECTED' || status === 'CANCELLED' || status === 'REMOVED') return 'danger';
    return 'neutral';
  }, []);

  const updateStatus = useCallback(async (row: ApplicationRow, nextStatus: 'ACTIVE' | 'RESERVE' | 'REJECTED') => {
    setActionId(row.id);
    setError('');
    try {
      if (row.applicationType === 'TEAM') {
        if (!row.teamId) throw new Error(locale === 'ru' ? 'Команда не найдена' : 'Team not found');
        if (nextStatus === 'ACTIVE') {
          await adminApi.approveTeamChangeRequest(row.eventId, row.teamId, row.id);
        } else if (nextStatus === 'REJECTED') {
          await adminApi.rejectTeamChangeRequest(row.eventId, row.teamId, row.id);
        } else {
          throw new Error(locale === 'ru' ? 'Для команды доступно только одобрение/отклонение' : 'Only approve/reject is available for team applications');
        }
      } else if (row.applicationType === 'VOLUNTEER') {
        await adminApi.updateVolunteerStatus(row.eventId, row.id, { status: nextStatus });
      } else if (row.applicationType === 'PARTICIPANT') {
        await adminApi.updateParticipantStatus(row.eventId, row.id, { status: nextStatus });
      } else {
        throw new Error(locale === 'ru' ? 'Неизвестный тип заявки' : 'Unknown application type');
      }
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
      <AdminPageHeader
        title={locale === 'ru' ? 'Приём заявок' : 'Application intake'}
        subtitle={locale === 'ru' ? 'Единый реестр заявок участников с модерацией' : 'Unified participant application registry with moderation'}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Panel variant="elevated" className="admin-command-panel admin-data-panel">
        <SectionHeader
          title={locale === 'ru' ? 'Реестр заявок' : 'Application registry'}
          subtitle={locale === 'ru' ? 'Единый реестр заявок: участник, волонтёр, команда' : 'Unified registry: participant, volunteer, team'}
        />

        <AdminToolbar>
          <FieldInput
            value={rawSearch}
            onChange={(event) => setRawSearch(event.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по ФИО, email, дате, событию' : 'Search by full name, email, date, event'}
            className="admin-filter-search admin-toolbar-search"
          />
          <FieldSelect value={eventFilter} onChange={(event) => updateFilter('eventId', event.target.value)} className="admin-filter-select admin-toolbar-select">
            <option value="ALL">{locale === 'ru' ? 'Все события' : 'All events'}</option>
            {events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </FieldSelect>
          <FieldSelect value={statusFilter} onChange={(event) => updateFilter('status', event.target.value)} className="admin-filter-select admin-toolbar-select">
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>{status === 'ALL' ? (locale === 'ru' ? 'Все статусы' : 'All statuses') : statusLabel(status)}</option>
            ))}
          </FieldSelect>
          <FieldSelect value={typeFilter} onChange={(event) => updateFilter('type', event.target.value)} className="admin-filter-select admin-toolbar-select">
            {TYPE_FILTERS.map((type) => (
              <option key={type} value={type}>{type === 'ALL' ? (locale === 'ru' ? 'Все типы' : 'All types') : typeLabel(type)}</option>
            ))}
          </FieldSelect>
        </AdminToolbar>

        {loadingData ? (
          <LoadingLines rows={8} />
        ) : visibleRows.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Заявки не найдены' : 'No applications found'}
            description={locale === 'ru' ? 'Измените фильтры или дождитесь новых заявок.' : 'Adjust filters or wait for new applications.'}
          />
        ) : (
          <div className="admin-table-mobile-cards">
            <AdminDataTable minWidth={1180}>
              <AdminDataTableHeader
                columns={[
                  { label: locale === 'ru' ? 'Заявитель' : 'Applicant', width: '19%' },
                  { label: locale === 'ru' ? 'Тип' : 'Type', width: '11%' },
                  { label: locale === 'ru' ? 'Email' : 'Email', width: '15%' },
                  { label: locale === 'ru' ? 'Город' : 'City', width: '10%' },
                  { label: locale === 'ru' ? 'Статус' : 'Status', width: '11%' },
                  { label: locale === 'ru' ? 'Дата' : 'Date', width: '10%' },
                  { label: locale === 'ru' ? 'Событие' : 'Event', width: '14%' },
                  { label: locale === 'ru' ? 'Действия' : 'Actions', align: 'right', width: '10%' },
                ]}
              />
              <AdminDataTableBody>
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
                      <AdminDataTableRow>
                        <AdminDataTableCell>
                          <AdminTableCellMain title={displayName || '—'} subtitle={row.userEmail || '—'} />
                        </AdminDataTableCell>
                        <AdminDataTableCell>{typeLabel(row.applicationType)}</AdminDataTableCell>
                        <AdminDataTableCell truncate>{row.userEmail || '—'}</AdminDataTableCell>
                        <AdminDataTableCell>{row.userCity || '—'}</AdminDataTableCell>
                        <AdminDataTableCell>
                          <StatusBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusBadge>
                        </AdminDataTableCell>
                        <AdminDataTableCell className="signal-muted">{new Date(row.assignedAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')}</AdminDataTableCell>
                        <AdminDataTableCell truncate>
                          {row.eventTitle || '—'}
                          {row.applicationType === 'TEAM' && row.teamName ? ` · ${row.teamName}` : ''}
                        </AdminDataTableCell>
                        <AdminDataTableCell align="right">
                          <AdminTableActions>
                            {row.status === 'PENDING' ? (
                              <>
                                <button type="button" className="btn btn-primary btn-sm" disabled={actionId === row.id} onClick={() => void updateStatus(row, 'ACTIVE')}>{locale === 'ru' ? 'Принять' : 'Approve'}</button>
                                {row.applicationType === 'PARTICIPANT' ? <button type="button" className="btn btn-secondary btn-sm" disabled={actionId === row.id} onClick={() => void updateStatus(row, 'RESERVE')}>{locale === 'ru' ? 'Резерв' : 'Reserve'}</button> : null}
                                <button type="button" className="btn btn-danger btn-sm" disabled={actionId === row.id} onClick={() => void updateStatus(row, 'REJECTED')}>{locale === 'ru' ? 'Отклонить' : 'Reject'}</button>
                              </>
                            ) : null}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                              {expandedId === row.id ? (locale === 'ru' ? 'Скрыть' : 'Hide') : (locale === 'ru' ? 'Анкета' : 'Form')}
                            </button>
                          </AdminTableActions>
                        </AdminDataTableCell>
                      </AdminDataTableRow>
                      {expandedId === row.id ? (
                        <tr className="admin-expanded-row">
                          <td colSpan={8}>
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
                              <span className="signal-muted">
                                {row.applicationType === 'TEAM'
                                  ? (locale === 'ru'
                                    ? `Команда: ${row.teamName ?? '—'} · Капитан: ${row.teamCaptainName ?? '—'}`
                                    : `Team: ${row.teamName ?? '—'} · Captain: ${row.teamCaptainName ?? '—'}`)
                                  : (locale === 'ru' ? 'Ответов анкеты пока нет.' : 'No form answers yet.')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </AdminDataTableBody>
            </AdminDataTable>

            <AdminMobileList>
              {visibleRows.map((row) => {
                const displayName = row.userName
                  ?? row.fullNameCyrillic
                  ?? row.fullNameLatin
                  ?? [row.lastNameCyrillic, row.firstNameCyrillic, row.middleNameCyrillic].filter(Boolean).join(' ')
                  ?? [row.lastNameLatin, row.firstNameLatin, row.middleNameLatin].filter(Boolean).join(' ')
                  ?? row.userEmail
                  ?? '—';

                return (
                  <AdminMobileCard
                    key={row.id}
                    title={displayName || '—'}
                    subtitle={row.userEmail || '—'}
                    badge={<StatusBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusBadge>}
                    meta={[
                      { label: locale === 'ru' ? 'Тип' : 'Type', value: typeLabel(row.applicationType) },
                      { label: locale === 'ru' ? 'Город' : 'City', value: row.userCity || '—' },
                      { label: locale === 'ru' ? 'Дата' : 'Date', value: new Date(row.assignedAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US') },
                      { label: locale === 'ru' ? 'Событие' : 'Event', value: `${row.eventTitle || '—'}${row.applicationType === 'TEAM' && row.teamName ? ` · ${row.teamName}` : ''}` },
                      ...(expandedId === row.id ? [{
                        label: locale === 'ru' ? 'Анкета' : 'Form',
                        value: row.answers && Object.keys(row.answers).length > 0
                          ? Object.entries(row.answers).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')
                          : row.applicationType === 'TEAM'
                            ? (locale === 'ru'
                              ? `Команда: ${row.teamName ?? '—'} · Капитан: ${row.teamCaptainName ?? '—'}`
                              : `Team: ${row.teamName ?? '—'} · Captain: ${row.teamCaptainName ?? '—'}`)
                            : (locale === 'ru' ? 'Ответов анкеты пока нет.' : 'No form answers yet.'),
                      }] : []),
                    ]}
                    actions={
                      <AdminTableActions>
                        {row.status === 'PENDING' ? (
                          <>
                            <button type="button" className="btn btn-primary btn-sm" disabled={actionId === row.id} onClick={() => void updateStatus(row, 'ACTIVE')}>{locale === 'ru' ? 'Принять' : 'Approve'}</button>
                            {row.applicationType === 'PARTICIPANT' ? <button type="button" className="btn btn-secondary btn-sm" disabled={actionId === row.id} onClick={() => void updateStatus(row, 'RESERVE')}>{locale === 'ru' ? 'Резерв' : 'Reserve'}</button> : null}
                            <button type="button" className="btn btn-danger btn-sm" disabled={actionId === row.id} onClick={() => void updateStatus(row, 'REJECTED')}>{locale === 'ru' ? 'Отклонить' : 'Reject'}</button>
                          </>
                        ) : null}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                          {expandedId === row.id ? (locale === 'ru' ? 'Скрыть анкету' : 'Hide form') : (locale === 'ru' ? 'Показать анкету' : 'Show form')}
                        </button>
                      </AdminTableActions>
                    }
                  />
                );
              })}
            </AdminMobileList>
          </div>
        )}
      </Panel>
    </div>
  );
}
