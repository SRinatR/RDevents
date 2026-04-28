'use client';

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, MetricCard, Notice, Panel, SectionHeader, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, formatAdminDateTime, memberStatusTone, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

const STATUS_FILTERS = ['ALL', 'PENDING', 'ACTIVE', 'REJECTED', 'REMOVED'] as const;

export default function EventVolunteersPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL');
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [certificateActionId, setCertificateActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoadingData(true);
    setError('');

    try {
      const [eventResult, volunteersResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminApi.listEventVolunteers(eventId, statusFilter === 'ALL' ? undefined : statusFilter),
      ]);
      setEvent(eventResult.data[0] ?? null);
      setVolunteers(volunteersResult.volunteers ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load volunteers');
      setVolunteers([]);
    } finally {
      setLoadingData(false);
    }
  }, [eventId, statusFilter]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  const filteredVolunteers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return volunteers.filter((volunteer) => {
      if (!normalized) return true;
      return volunteer.user?.name?.toLowerCase().includes(normalized)
        || volunteer.user?.email?.toLowerCase().includes(normalized)
        || volunteer.notes?.toLowerCase().includes(normalized);
    });
  }, [volunteers, search]);

  const stats = useMemo(() => ({
    total: volunteers.length,
    pending: volunteers.filter((item) => item.status === 'PENDING').length,
    active: volunteers.filter((item) => item.status === 'ACTIVE').length,
    rejected: volunteers.filter((item) => item.status === 'REJECTED').length,
    certificates: volunteers.filter((item) => Boolean(item.volunteerCertificatePublicUrl)).length,
  }), [volunteers]);

  const syncVolunteer = useCallback((membership: any) => {
    setVolunteers((current) => {
      const next = current.map((item) => (
        item.id === membership.id
          ? {
              ...item,
              ...membership,
              user: membership.user ?? item.user,
              assignedByUser: membership.assignedByUser ?? item.assignedByUser,
            }
          : item
      ));

      return statusFilter === 'ALL'
        ? next
        : next.filter((item) => item.status === statusFilter);
    });
  }, [statusFilter]);

  const updateStatus = async (memberId: string, nextStatus: 'ACTIVE' | 'REJECTED' | 'REMOVED') => {
    if (!eventId) return;
    setActionId(memberId);
    setError('');
    setSuccess('');

    try {
      const result = await adminApi.updateVolunteerStatus(eventId, memberId, { status: nextStatus });
      syncVolunteer(result.membership);
      setSuccess(locale === 'ru' ? 'Статус волонтёра обновлён.' : 'Volunteer status updated.');
    } catch (err: any) {
      setError(err.message || 'Failed to update volunteer');
    } finally {
      setActionId(null);
    }
  };

  const handleUploadCertificate = async (memberId: string, file: File) => {
    if (!eventId) return;
    setCertificateActionId(memberId);
    setError('');
    setSuccess('');

    try {
      const result = await adminApi.uploadVolunteerCertificate(eventId, memberId, file);
      syncVolunteer(result.membership);
      setSuccess(locale === 'ru' ? 'Сертификат загружен и сразу доступен волонтёру в кабинете.' : 'Certificate uploaded and is now available in the volunteer cabinet.');
    } catch (err: any) {
      setError(err.message || (locale === 'ru' ? 'Не удалось загрузить сертификат.' : 'Failed to upload certificate.'));
    } finally {
      setCertificateActionId(null);
    }
  };

  const handleCertificateInput = async (memberId: string, inputEvent: ChangeEvent<HTMLInputElement>) => {
    const file = inputEvent.target.files?.[0];
    inputEvent.target.value = '';
    if (!file) return;
    await handleUploadCertificate(memberId, file);
  };

  const handleDeleteCertificate = async (memberId: string) => {
    if (!eventId) return;
    const confirmed = window.confirm(
      locale === 'ru'
        ? 'Удалить сертификат у этого волонтёра?'
        : 'Delete this volunteer certificate?'
    );
    if (!confirmed) return;

    setCertificateActionId(memberId);
    setError('');
    setSuccess('');

    try {
      await adminApi.deleteVolunteerCertificate(eventId, memberId);
      setVolunteers((current) => current.map((item) => (
        item.id === memberId
          ? {
              ...item,
              volunteerCertificateOriginalFilename: null,
              volunteerCertificateMimeType: null,
              volunteerCertificateSizeBytes: null,
              volunteerCertificatePublicUrl: null,
              volunteerCertificateUploadedAt: null,
            }
          : item
      )));
      setSuccess(locale === 'ru' ? 'Сертификат удалён.' : 'Certificate removed.');
    } catch (err: any) {
      setError(err.message || (locale === 'ru' ? 'Не удалось удалить сертификат.' : 'Failed to delete certificate.'));
    } finally {
      setCertificateActionId(null);
    }
  };

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Волонтёры события' : 'Event volunteers'}
        subtitle={event?.title}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : (
        <>
          <div className="signal-kpi-grid">
            <MetricCard tone="info" label={locale === 'ru' ? 'Всего' : 'Total'} value={stats.total} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'Ожидают' : 'Pending'} value={stats.pending} />
            <MetricCard tone="success" label={locale === 'ru' ? 'Активные' : 'Active'} value={stats.active} />
            <MetricCard tone="danger" label={locale === 'ru' ? 'Отклонены' : 'Rejected'} value={stats.rejected} />
            <MetricCard tone="info" label={locale === 'ru' ? 'С сертификатом' : 'With certificate'} value={stats.certificates} />
          </div>

          <Panel variant="elevated" className="admin-command-panel admin-data-panel">
            <SectionHeader
              title={locale === 'ru' ? 'Заявки волонтёров' : 'Volunteer applications'}
              subtitle={locale === 'ru'
                ? 'Здесь можно модерировать заявки и загружать сертификаты активным волонтёрам.'
                : 'Moderate volunteer applications and upload certificates for active volunteers here.'}
            />

            <ToolbarRow>
              <FieldInput
                value={search}
                onChange={(inputEvent) => setSearch(inputEvent.target.value)}
                placeholder={locale === 'ru' ? 'Поиск по имени, email или заметке' : 'Search by name, email, or note'}
                className="admin-filter-search"
              />
              <FieldSelect value={statusFilter} onChange={(selectEvent) => setStatusFilter(selectEvent.target.value as (typeof STATUS_FILTERS)[number])} className="admin-filter-select">
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>{status === 'ALL' ? (locale === 'ru' ? 'Все статусы' : 'All statuses') : status}</option>
                ))}
              </FieldSelect>
              
            </ToolbarRow>

            {filteredVolunteers.length === 0 ? (
              <EmptyState
                title={locale === 'ru' ? 'Заявок нет' : 'No volunteer applications'}
                description={locale === 'ru' ? 'Новые заявки волонтёров появятся здесь.' : 'New volunteer applications will appear here.'}
              />
            ) : (
              <TableShell>
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>{locale === 'ru' ? 'Волонтёр' : 'Volunteer'}</th>
                      <th>{locale === 'ru' ? 'Заметка' : 'Note'}</th>
                      <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                      <th>{locale === 'ru' ? 'Сертификат' : 'Certificate'}</th>
                      <th>{locale === 'ru' ? 'Дата' : 'Date'}</th>
                      <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVolunteers.map((volunteer) => (
                      <tr key={volunteer.id}>
                        <td>
                          <strong>{volunteer.user?.name ?? volunteer.user?.email ?? '—'}</strong>
                          <div className="signal-muted">{volunteer.user?.email}</div>
                        </td>
                        <td className="signal-overflow-ellipsis">{volunteer.notes ?? '—'}</td>
                        <td>
                          <StatusBadge tone={memberStatusTone(volunteer.status)}>
                            {formatVolunteerStatus(volunteer.status, locale)}
                          </StatusBadge>
                        </td>
                        <td>
                          {volunteer.volunteerCertificatePublicUrl ? (
                            <div className="signal-stack" style={{ gap: 6 }}>
                              <a
                                href={volunteer.volunteerCertificatePublicUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="signal-chip-link"
                              >
                                {locale === 'ru' ? 'Открыть сертификат' : 'Open certificate'}
                              </a>
                              <div className="signal-muted">
                                {volunteer.volunteerCertificateOriginalFilename ?? (locale === 'ru' ? 'Сертификат' : 'Certificate')}
                              </div>
                              <div className="signal-muted">
                                {formatFileSize(volunteer.volunteerCertificateSizeBytes, locale)} · {formatAdminDateTime(volunteer.volunteerCertificateUploadedAt, locale)}
                              </div>
                            </div>
                          ) : (
                            <span className="signal-muted">
                              {volunteer.status === 'ACTIVE'
                                ? (locale === 'ru' ? 'Пока не загружен' : 'Not uploaded yet')
                                : (locale === 'ru' ? 'Появится после загрузки' : 'Appears after upload')}
                            </span>
                          )}
                        </td>
                        <td className="signal-muted">{formatAdminDateTime(volunteer.assignedAt, locale)}</td>
                        <td className="right">
                          <div className="signal-row-actions">
                            {volunteer.status === 'PENDING' ? (
                              <>
                                <button type="button" className="btn btn-primary btn-sm" disabled={actionId === volunteer.id} onClick={() => updateStatus(volunteer.id, 'ACTIVE')}>{locale === 'ru' ? 'Одобрить' : 'Approve'}</button>
                                <button type="button" className="btn btn-danger btn-sm" disabled={actionId === volunteer.id} onClick={() => updateStatus(volunteer.id, 'REJECTED')}>{locale === 'ru' ? 'Отклонить' : 'Reject'}</button>
                              </>
                            ) : null}
                            {volunteer.status === 'ACTIVE' ? (
                              <>
                                <label
                                  className="btn btn-secondary btn-sm"
                                  style={certificateActionId === volunteer.id ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                                >
                                  <input
                                    type="file"
                                    accept=".pdf,image/jpeg,image/png,image/webp"
                                    style={{ display: 'none' }}
                                    disabled={certificateActionId === volunteer.id}
                                    onChange={(inputEvent) => {
                                      void handleCertificateInput(volunteer.id, inputEvent);
                                    }}
                                  />
                                  {certificateActionId === volunteer.id
                                    ? (locale === 'ru' ? 'Загружаем...' : 'Uploading...')
                                    : volunteer.volunteerCertificatePublicUrl
                                      ? (locale === 'ru' ? 'Заменить сертификат' : 'Replace certificate')
                                      : (locale === 'ru' ? 'Загрузить сертификат' : 'Upload certificate')}
                                </label>
                                <button type="button" className="btn btn-ghost btn-sm" disabled={actionId === volunteer.id} onClick={() => updateStatus(volunteer.id, 'REMOVED')}>{locale === 'ru' ? 'Убрать' : 'Remove'}</button>
                              </>
                            ) : null}
                            {volunteer.volunteerCertificatePublicUrl ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={certificateActionId === volunteer.id}
                                onClick={() => {
                                  void handleDeleteCertificate(volunteer.id);
                                }}
                              >
                                {certificateActionId === volunteer.id
                                  ? (locale === 'ru' ? 'Удаляем...' : 'Deleting...')
                                  : (locale === 'ru' ? 'Удалить сертификат' : 'Delete certificate')}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function formatVolunteerStatus(status: string | undefined, locale: string) {
  const ru: Record<string, string> = {
    PENDING: 'На рассмотрении',
    ACTIVE: 'Активен',
    REJECTED: 'Отклонён',
    REMOVED: 'Удалён',
    RESERVE: 'Резерв',
  };
  const en: Record<string, string> = {
    PENDING: 'Pending',
    ACTIVE: 'Active',
    REJECTED: 'Rejected',
    REMOVED: 'Removed',
    RESERVE: 'Reserve',
  };

  if (!status) return '—';
  return (locale === 'ru' ? ru : en)[status] ?? status;
}

function formatFileSize(value: number | null | undefined, locale: string) {
  if (!value || value <= 0) return locale === 'ru' ? 'Размер не указан' : 'Size unavailable';

  const units = locale === 'ru'
    ? ['Б', 'КБ', 'МБ', 'ГБ']
    : ['B', 'KB', 'MB', 'GB'];

  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const normalized = size >= 10 || unitIndex === 0 ? Math.round(size) : Number(size.toFixed(1));
  return `${normalized} ${units[unitIndex]}`;
}
