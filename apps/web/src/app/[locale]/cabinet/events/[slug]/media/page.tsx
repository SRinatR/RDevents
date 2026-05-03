'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { eventMediaApi, eventsApi, type EventMediaItem } from '@/lib/api';
import { MediaPreview } from '@/components/media/MediaPreview';
import { formatMediaDisplayNumber } from '@/components/media/MediaCard';
import { EmptyState, FieldInput, FieldTextarea, LoadingLines, Notice, PageHeader, Panel, SectionHeader, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';
import { getFriendlyApiErrorMessage } from '@/lib/api-errors';

type SubmissionFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const PARTICIPANT_UPLOAD_STATUSES = new Set(['ACTIVE', 'APPROVED', 'RESERVE']);

function statusLabel(status: EventMediaItem['status'], locale: string) {
  const ru: Record<EventMediaItem['status'], string> = {
    PENDING: 'На модерации',
    APPROVED: 'Опубликовано',
    REJECTED: 'Отклонено',
    DELETED: 'Удалено / скрыто',
  };
  const en: Record<EventMediaItem['status'], string> = {
    PENDING: 'Under review',
    APPROVED: 'Published',
    REJECTED: 'Rejected',
    DELETED: 'Deleted / hidden',
  };
  return (locale === 'ru' ? ru : en)[status];
}

function statusTone(status: EventMediaItem['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'REJECTED') return 'danger';
  return 'neutral';
}

function actionLabel(action: string, locale: string) {
  const ru: Record<string, string> = {
    SUBMITTED: 'Отправлено',
    APPROVED: 'Утверждено',
    REJECTED: 'Отклонено',
    UPDATED: 'Обновлено',
    DELETED: 'Удалено',
    RESTORED: 'Восстановлено',
  };
  const en: Record<string, string> = {
    SUBMITTED: 'Submitted',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    UPDATED: 'Updated',
    DELETED: 'Deleted',
    RESTORED: 'Restored',
  };
  return (locale === 'ru' ? ru : en)[action] ?? action;
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function renderSubmissionPreview(item: EventMediaItem) {
  const label = item.altText || item.title || item.caption || item.asset.originalFilename;
  return (
    <MediaPreview
      publicUrl={item.asset.publicUrl}
      storageKey={item.asset.storageKey}
      kind={item.kind}
      alt={label}
      sizes="(max-width: 768px) 100vw, 240px"
    />
  );
}

function getParticipantMembership(event: any, membership: any) {
  return membership?.memberships?.find((item: any) => item.role === 'PARTICIPANT')
    ?? event?.memberships?.find((item: any) => item.role === 'PARTICIPANT')
    ?? null;
}

export default function CabinetEventMediaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';
  const { user, loading } = useAuth();

  const [event, setEvent] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [media, setMedia] = useState<EventMediaItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<SubmissionFilter>('ALL');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [credit, setCredit] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cabinetHref = `/${locale}/cabinet/events/${slug}`;

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${locale}/login?next=${encodeURIComponent(`/${locale}/cabinet/events/${slug}/media`)}`);
    }
  }, [loading, user, router, locale, slug]);

  const loadData = useCallback(async () => {
    if (!user || !slug) return;
    setPageLoading(true);
    setError('');
    try {
      const { event: currentEvent } = await eventsApi.get(slug);
      const [membershipResult, mediaResult] = await Promise.all([
        eventsApi.membership(currentEvent.id).catch(() => ({ membership: null })),
        eventMediaApi.myList(currentEvent.id),
      ]);
      setEvent(currentEvent);
      setMembership(membershipResult.membership);
      setMedia(mediaResult.media);
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setPageLoading(false);
    }
  }, [user, slug, locale]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const participantMembership = getParticipantMembership(event, membership);
  const canUpload = PARTICIPANT_UPLOAD_STATUSES.has(participantMembership?.status ?? '');
  const filteredMedia = useMemo(() => {
    if (filter === 'ALL') return media;
    return media.filter((item) => item.status === filter);
  }, [filter, media]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!event || !file) {
      setError(isRu ? 'Выберите фото или видео.' : 'Choose a photo or video.');
      return;
    }

    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const result = await eventMediaApi.submit(event.id, file, { title, caption, credit });
      setFile(null);
      setTitle('');
      setCaption('');
      setCredit('');
      e.currentTarget.reset();
      setNotice(result.media.status === 'APPROVED'
        ? (isRu ? 'Материал опубликован в фотобанке мероприятия.' : 'Your media was published to the event media bank.')
        : (isRu ? 'Материал отправлен на модерацию. После проверки он появится в фотобанке мероприятия.' : 'Your media will be reviewed. After approval it will appear in the public media bank.'));
      await loadData();
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  if (pageLoading) {
    return (
      <div className="signal-page-shell cabinet-workspace-page media-cabinet-page">
        <Panel><LoadingLines rows={8} /></Panel>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="signal-page-shell cabinet-workspace-page media-cabinet-page">
        <EmptyState
          title={isRu ? 'Мероприятие не найдено' : 'Event not found'}
          description={error || (isRu ? 'Вернитесь к списку мероприятий.' : 'Return to the event list.')}
          actions={<Link href={`/${locale}/cabinet/events`} className="btn btn-secondary btn-sm">{isRu ? 'К мероприятиям' : 'To events'}</Link>}
        />
      </div>
    );
  }

  return (
    <div className="signal-page-shell cabinet-workspace-page media-cabinet-page">
      <PageHeader
        title={isRu ? 'Фотобанк' : 'Media bank'}
        subtitle={event.title}
        actions={(
          <ToolbarRow>
            <Link href={cabinetHref} className="btn btn-secondary btn-sm">{isRu ? 'ЛК события' : 'Event cabinet'}</Link>
            <Link href={`/${locale}/events/${event.slug}/media`} className="btn btn-ghost btn-sm">{isRu ? 'Публичный фотобанк' : 'Public media bank'}</Link>
          </ToolbarRow>
        )}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <Panel variant="elevated" className="media-upload-panel">
        <SectionHeader
          title={isRu ? 'Добавить фото или видео' : 'Add photo or video'}
          subtitle={isRu
            ? 'Материал отправится на модерацию. После утверждения он появится в публичном фотобанке мероприятия.'
            : 'Your media will be reviewed. After approval it will appear in the public media bank.'}
        />

        {!canUpload ? (
          <Notice tone="warning">
            {isRu
              ? 'Загрузка доступна только подтверждённым участникам мероприятия.'
              : 'Upload is available only to approved event participants.'}
          </Notice>
        ) : (
          <form className="media-upload-form" onSubmit={handleSubmit}>
            <label className="media-upload-dropzone">
              <span>{file ? file.name : (isRu ? 'Выберите файл' : 'Choose file')}</span>
              <small>{isRu ? 'Фото или видео, до лимита мероприятия' : 'Photo or video, within event limit'}</small>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
              />
            </label>
            <FieldInput value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder={isRu ? 'Название, необязательно' : 'Title, optional'} />
            <FieldInput value={credit} onChange={(event) => setCredit(event.target.value)} maxLength={120} placeholder={isRu ? 'Автор / команда, необязательно' : 'Author / team, optional'} />
            <FieldTextarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={1000} rows={4} placeholder={isRu ? 'Подпись, необязательно' : 'Caption, optional'} />
            <button className="btn btn-primary" type="submit" disabled={submitting || !file}>
              {submitting ? (isRu ? 'Отправляем...' : 'Submitting...') : (isRu ? 'Отправить на модерацию' : 'Submit for review')}
            </button>
          </form>
        )}
      </Panel>

      <Panel variant="elevated" className="media-submissions-panel">
        <SectionHeader
          title={isRu ? 'Мои отправки' : 'My submissions'}
          subtitle={isRu ? 'История статусов и решений модерации' : 'Submission status and moderation history'}
        />

        <ToolbarRow>
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as SubmissionFilter[]).map((item) => (
            <button
              type="button"
              key={item}
              className={`btn btn-sm ${filter === item ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(item)}
            >
              {item === 'ALL' ? (isRu ? 'Все' : 'All') : statusLabel(item as EventMediaItem['status'], locale)}
            </button>
          ))}
        </ToolbarRow>

        {filteredMedia.length === 0 ? (
          <EmptyState
            title={isRu ? 'Отправок пока нет' : 'No submissions yet'}
            description={isRu ? 'После загрузки материалы появятся здесь со статусом модерации.' : 'After upload, your media will appear here with review status.'}
          />
        ) : (
          <div className="media-submission-list">
            {filteredMedia.map((item) => (
              <article className="media-submission-card" key={item.id}>
                <div className="media-submission-preview">
                  {renderSubmissionPreview(item)}
                </div>
                <div className="media-submission-body">
                  <div className="media-submission-title-row">
                    <strong>{item.title || item.asset.originalFilename}</strong>
                    <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status, locale)}</StatusBadge>
                  </div>
                  {item.caption ? <p>{item.caption}</p> : null}
                  <div className="media-submission-meta">
                    <span>{formatMediaDisplayNumber(item, locale)}</span>
                    <span>{formatDate(item.createdAt, locale)}</span>
                    {item.credit ? <span>{item.credit}</span> : null}
                  </div>
                  {item.status === 'REJECTED' && item.moderationNotes ? (
                    <Notice tone="danger">
                      {isRu ? 'Причина отклонения: ' : 'Rejection reason: '}
                      {item.moderationNotes}
                    </Notice>
                  ) : null}
                  <details className="media-history-details">
                    <summary>{isRu ? 'История действий' : 'Action history'}</summary>
                    <div className="media-history-timeline">
                      {(item.history ?? []).map((entry) => (
                        <div className="media-history-entry" key={entry.id}>
                          <strong>{actionLabel(entry.action, locale)}</strong>
                          <span>{formatDate(entry.createdAt, locale)}</span>
                          {entry.reason ? <p>{entry.reason}</p> : null}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
