'use client';

import Image from 'next/image';
import { type ChangeEvent, useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldSelect, LoadingLines, Notice, Panel, SectionHeader } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';

const STATUS_FILTERS = ['PENDING', 'ACTIVE', 'REJECTED', 'REMOVED'] as const;

export default function AdminVolunteersPage() {
  const t = useTranslations();
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingVolunteers, setLoadingVolunteers] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [certificateActionId, setCertificateActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    setLoadingData(true);
    adminApi.listEvents({ limit: 100 })
      .then((result) => {
        setEvents(result.data);
        setSelectedEventId(result.data[0]?.id ?? '');
      })
      .catch(() => setEvents([]))
      .finally(() => setLoadingData(false));
  }, [user, isAdmin]);

  const loadVolunteers = useCallback(() => {
    if (!selectedEventId) return;
    setLoadingVolunteers(true);
    adminApi.listEventVolunteers(selectedEventId, status)
      .then((result) => setVolunteers(result.volunteers))
      .catch(() => setVolunteers([]))
      .finally(() => setLoadingVolunteers(false));
  }, [selectedEventId, status]);

  useEffect(() => {
    loadVolunteers();
  }, [loadVolunteers]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const syncVolunteer = useCallback((membership: any) => {
    setVolunteers((current) => current.map((item) => (
      item.id === membership.id
        ? {
            ...item,
            ...membership,
            user: membership.user ?? item.user,
            assignedByUser: membership.assignedByUser ?? item.assignedByUser,
          }
        : item
    )));
  }, []);

  async function updateStatus(memberId: string, nextStatus: 'ACTIVE' | 'REJECTED') {
    setActionId(memberId);
    setError('');
    setSuccess('');
    try {
      const result = await adminApi.updateVolunteerStatus(selectedEventId, memberId, { status: nextStatus });
      syncVolunteer(result.membership);
      setSuccess(locale === 'ru' ? 'Статус волонтёра обновлён.' : 'Volunteer status updated.');
    } finally {
      setActionId(null);
    }
  }

  async function handleUploadCertificate(memberId: string, file: File) {
    if (!selectedEventId) return;
    setCertificateActionId(memberId);
    setError('');
    setSuccess('');

    try {
      const result = await adminApi.uploadVolunteerCertificate(selectedEventId, memberId, file);
      syncVolunteer(result.membership);
      setSuccess(locale === 'ru'
        ? 'Сертификат загружен для выбранного мероприятия.'
        : 'Certificate uploaded for the selected event.');
    } catch (err: any) {
      setError(err.message || (locale === 'ru' ? 'Не удалось загрузить сертификат.' : 'Failed to upload certificate.'));
    } finally {
      setCertificateActionId(null);
    }
  }

  async function handleCertificateInput(memberId: string, inputEvent: ChangeEvent<HTMLInputElement>) {
    const file = inputEvent.target.files?.[0];
    inputEvent.target.value = '';
    if (!file) return;
    await handleUploadCertificate(memberId, file);
  }

  async function handleDeleteCertificate(memberId: string) {
    if (!selectedEventId) return;
    const confirmed = window.confirm(
      locale === 'ru'
        ? 'Удалить сертификат у этого волонтёра для выбранного мероприятия?'
        : 'Delete this certificate for the selected event?'
    );
    if (!confirmed) return;

    setCertificateActionId(memberId);
    setError('');
    setSuccess('');

    try {
      await adminApi.deleteVolunteerCertificate(selectedEventId, memberId);
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
  }

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader title={t('admin.volunteers')} subtitle={locale === 'ru' ? 'Модерация заявок волонтёров по событиям' : 'Volunteer moderation by event scope'} />

      {success ? <Notice tone="success">{success}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="admin-control-strip">
        <div className="admin-control-card"><small>{locale === 'ru' ? 'Очередь' : 'Queue'}</small><strong>{locale === 'ru' ? 'Модерация волонтёров' : 'Volunteer moderation'}</strong></div>
        <div className="admin-control-card"><small>{locale === 'ru' ? 'Статус' : 'Status'}</small><strong>{status}</strong></div>
      </div>

      <Panel variant="elevated" className="admin-command-panel admin-data-panel">
        <SectionHeader
          title={locale === 'ru' ? 'Очередь модерации' : 'Moderation queue'}
          subtitle={locale === 'ru'
            ? 'Сначала выбирается мероприятие, затем волонтёр внутри него. Сертификат загружается именно за выбранное событие.'
            : 'Pick the event first, then the volunteer inside it. Certificates are uploaded for that selected event.'}
        />

        {loadingData ? <LoadingLines rows={4} /> : events.length === 0 ? (
          <EmptyState title={locale === 'ru' ? 'Нет событий для модерации' : 'No manageable events yet'} description={locale === 'ru' ? 'После создания события здесь появится очередь волонтёров.' : 'Volunteer queue appears once events are available.'} />
        ) : (
          <>
            <AdminToolbar>
              <FieldSelect value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} className="admin-filter-search admin-toolbar-search">
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.title}</option>
                ))}
              </FieldSelect>
              <FieldSelect value={status} onChange={(event) => setStatus(event.target.value)} className="admin-filter-select admin-toolbar-select">
                {STATUS_FILTERS.map((item) => <option key={item} value={item}>{item}</option>)}
              </FieldSelect>
              {selectedEventId ? <Link href={`/${locale}/admin/events/${selectedEventId}/edit`} className="btn btn-secondary btn-sm">{t('common.edit')} event</Link> : null}
            </AdminToolbar>

            {loadingVolunteers ? <LoadingLines rows={5} /> : volunteers.length === 0 ? (
              <EmptyState title={locale === 'ru' ? 'Очередь пуста' : 'Queue is empty'} description={locale === 'ru' ? `Нет заявок со статусом ${status}.` : `No volunteer entries with status ${status}.`} />
            ) : (
              <AdminMobileList>
                {volunteers.map((membership: any) => (
                  <AdminMobileCard
                    key={membership.id}
                    title={
                      <span className="admin-user-cell">
                        <span className="signal-avatar">
                          {membership.user?.avatarUrl ? <Image src={membership.user.avatarUrl} alt="" width={40} height={40} /> : (membership.user?.name || membership.user?.email || '?').charAt(0).toUpperCase()}
                        </span>
                        <span>{membership.user?.name || membership.user?.email}</span>
                      </span>
                    }
                    subtitle={membership.user?.email}
                    meta={[
                      { label: locale === 'ru' ? 'Мероприятие' : 'Event', value: selectedEvent?.title || '—' },
                      { label: locale === 'ru' ? 'Статус' : 'Status', value: membership.status },
                      { label: locale === 'ru' ? 'Заметки' : 'Notes', value: membership.notes || '—' },
                      {
                        label: locale === 'ru' ? 'Сертификат' : 'Certificate',
                        value: membership.volunteerCertificatePublicUrl
                          ? `${membership.volunteerCertificateOriginalFilename || (locale === 'ru' ? 'Загружен' : 'Uploaded')}`
                          : (locale === 'ru' ? 'Не загружен' : 'Not uploaded'),
                      },
                    ]}
                    actions={
                      membership.status === 'PENDING' ? (
                        <>
                          <button onClick={() => updateStatus(membership.id, 'ACTIVE')} disabled={actionId === membership.id} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Одобрить' : 'Approve'}</button>
                          <button onClick={() => updateStatus(membership.id, 'REJECTED')} disabled={actionId === membership.id} className="btn btn-danger btn-sm">{locale === 'ru' ? 'Отклонить' : 'Reject'}</button>
                        </>
                      ) : membership.status === 'ACTIVE' ? (
                        <>
                          <label
                            className="btn btn-secondary btn-sm"
                            style={certificateActionId === membership.id ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                          >
                            <input
                              type="file"
                              accept=".pdf,image/jpeg,image/png,image/webp"
                              style={{ display: 'none' }}
                              disabled={certificateActionId === membership.id}
                              onChange={(inputEvent) => {
                                void handleCertificateInput(membership.id, inputEvent);
                              }}
                            />
                            {certificateActionId === membership.id
                              ? (locale === 'ru' ? 'Загружаем...' : 'Uploading...')
                              : membership.volunteerCertificatePublicUrl
                                ? (locale === 'ru' ? 'Заменить сертификат' : 'Replace certificate')
                                : (locale === 'ru' ? 'Загрузить сертификат' : 'Upload certificate')}
                          </label>
                          {membership.volunteerCertificatePublicUrl ? (
                            <>
                              <a
                                href={membership.volunteerCertificatePublicUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-ghost btn-sm"
                              >
                                {locale === 'ru' ? 'Открыть' : 'Open'}
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleDeleteCertificate(membership.id);
                                }}
                                disabled={certificateActionId === membership.id}
                                className="btn btn-ghost btn-sm"
                              >
                                {certificateActionId === membership.id
                                  ? (locale === 'ru' ? 'Удаляем...' : 'Deleting...')
                                  : (locale === 'ru' ? 'Удалить сертификат' : 'Delete certificate')}
                              </button>
                            </>
                          ) : null}
                        </>
                      ) : null
                    }
                  />
                ))}
              </AdminMobileList>
            )}
          </>
        )}
      </Panel>

      <Notice tone="info">
        {locale === 'ru' ? 'Страница использует текущие API-статусы и не имитирует дополнительные backend-состояния.' : 'This module uses current API statuses and does not simulate unsupported backend states.'}
      </Notice>
    </div>
  );
}
