'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi, eventMediaApi, type EventMediaCaptionSuggestion } from '@/lib/api';
import { MediaPreview } from '@/components/media/MediaPreview';
import { EmptyState, FieldInput, FieldTextarea, LoadingLines, Notice, Panel, SectionHeader, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';
import { getFriendlyApiErrorMessage } from '@/lib/api-errors';

type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ALL';
type DraftMap = Record<string, { title: string; caption: string; credit: string; altText: string; reason: string }>;

function statusLabel(status: SuggestionStatus, isRu: boolean) {
  const ru: Record<SuggestionStatus, string> = {
    PENDING: 'На модерации',
    APPROVED: 'Принято',
    REJECTED: 'Отклонено',
    CANCELLED: 'Отменено',
    ALL: 'Все',
  };
  const en: Record<SuggestionStatus, string> = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    ALL: 'All',
  };
  return (isRu ? ru : en)[status];
}

function statusTone(status: EventMediaCaptionSuggestion['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'REJECTED') return 'danger';
  return 'neutral';
}

function buildDrafts(suggestions: EventMediaCaptionSuggestion[]): DraftMap {
  return Object.fromEntries(suggestions.map((item) => [item.id, {
    title: item.suggestedTitle ?? item.media?.title ?? '',
    caption: item.suggestedCaption ?? item.media?.caption ?? '',
    credit: item.suggestedCredit ?? item.media?.credit ?? '',
    altText: item.suggestedAltText ?? item.media?.altText ?? '',
    reason: item.moderationReason ?? '',
  }]));
}

export default function AdminMediaCaptionSuggestionsPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');
  const isRu = locale === 'ru';
  const [eventTitle, setEventTitle] = useState('');
  const [status, setStatus] = useState<SuggestionStatus>('PENDING');
  const [suggestions, setSuggestions] = useState<EventMediaCaptionSuggestion[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [pageLoading, setPageLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setPageLoading(true);
    setError('');
    try {
      const [eventResult, suggestionResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        eventMediaApi.captionSuggestions.adminList(eventId, { status }),
      ]);
      setEventTitle(eventResult.data?.[0]?.title ?? '');
      setSuggestions(suggestionResult.suggestions);
      setDrafts(buildDrafts(suggestionResult.suggestions));
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
      setSuggestions([]);
      setDrafts({});
    } finally {
      setPageLoading(false);
    }
  }, [eventId, locale, status]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  function patchDraft(id: string, key: keyof DraftMap[string], value: string) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  }

  async function approveSuggestion(item: EventMediaCaptionSuggestion) {
    if (!eventId) return;
    const draft = drafts[item.id];
    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      await eventMediaApi.captionSuggestions.approve(eventId, item.id, {
        title: draft?.title || undefined,
        caption: draft?.caption || undefined,
        credit: draft?.credit || undefined,
        altText: draft?.altText || undefined,
      });
      setNotice(isRu ? 'Подпись принята и применена к медиа.' : 'Caption suggestion approved and applied to the media item.');
      await loadData();
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusyId('');
    }
  }

  async function rejectSuggestion(item: EventMediaCaptionSuggestion) {
    if (!eventId) return;
    const reason = drafts[item.id]?.reason?.trim();
    if (!reason) {
      setError(isRu ? 'Укажите причину отклонения.' : 'Please provide a rejection reason.');
      return;
    }
    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      await eventMediaApi.captionSuggestions.reject(eventId, item.id, reason);
      setNotice(isRu ? 'Предложение подписи отклонено.' : 'Caption suggestion rejected.');
      await loadData();
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusyId('');
    }
  }

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  return (
    <div className="signal-page-shell admin-control-page admin-media-captions-page">
      <Panel variant="elevated" className="admin-command-panel">
        <SectionHeader
          title={isRu ? 'Подписи на модерации' : 'Caption suggestions'}
          subtitle={eventTitle
            ? `${eventTitle} · ${isRu ? 'проверка предложений участников к уже опубликованным медиа' : 'review participant suggestions for existing media'}`
            : (isRu ? 'Проверка предложений участников к уже опубликованным медиа' : 'Review participant suggestions for existing media')}
        />
        <ToolbarRow>
          {(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'] as SuggestionStatus[]).map((item) => (
            <button key={item} type="button" className={`btn btn-sm ${status === item ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatus(item)}>
              {statusLabel(item, isRu)}
            </button>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadData()}>
            {isRu ? 'Обновить' : 'Refresh'}
          </button>
          <Link href={`/${locale}/admin/events/${eventId}/media`} className="btn btn-ghost btn-sm">
            {isRu ? 'К фотобанку' : 'Back to media bank'}
          </Link>
        </ToolbarRow>
      </Panel>

      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {pageLoading ? <LoadingLines rows={8} /> : suggestions.length ? (
        <div className="admin-event-media-list">
          {suggestions.map((item) => {
            const draft = drafts[item.id] ?? { title: '', caption: '', credit: '', altText: '', reason: '' };
            const media = item.media;
            return (
              <article className="admin-event-media-card" key={item.id}>
                {media ? <div className="admin-event-media-preview">
                  <MediaPreview
                    publicUrl={media.asset.publicUrl}
                    storageKey={media.asset.storageKey}
                    kind={media.kind}
                    alt={media.altText || media.title || media.caption || media.asset.originalFilename}
                    sizes="(max-width: 768px) 100vw, 280px"
                  />
                </div> : null}
                <div className="admin-event-media-body">
                  <div className="admin-event-media-title-row">
                    <strong>{media?.title || media?.asset.originalFilename || (isRu ? 'Медиа' : 'Media item')}</strong>
                    <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status, isRu)}</StatusBadge>
                  </div>
                  <div className="signal-muted">
                    {isRu ? 'Предложил' : 'Suggested by'}: {item.author?.name || item.author?.email || '—'} · {new Date(item.createdAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                  </div>

                  <Panel className="admin-command-panel">
                    <strong>{isRu ? 'Текущие данные медиа' : 'Current media data'}</strong>
                    <div className="signal-muted">{isRu ? 'Название' : 'Title'}: {media?.title || '—'}</div>
                    <div className="signal-muted">{isRu ? 'Подпись' : 'Caption'}: {media?.caption || '—'}</div>
                    <div className="signal-muted">Credit: {media?.credit || '—'}</div>
                    <div className="signal-muted">Alt: {media?.altText || '—'}</div>
                  </Panel>

                  <strong>{isRu ? 'Предложение участника' : 'Participant suggestion'}</strong>
                  <FieldInput value={draft.title} onChange={(event) => patchDraft(item.id, 'title', event.target.value)} placeholder={isRu ? 'Название' : 'Title'} />
                  <FieldTextarea value={draft.caption} onChange={(event) => patchDraft(item.id, 'caption', event.target.value)} rows={3} placeholder={isRu ? 'Подпись' : 'Caption'} />
                  <FieldInput value={draft.credit} onChange={(event) => patchDraft(item.id, 'credit', event.target.value)} placeholder="Credit" />
                  <FieldInput value={draft.altText} onChange={(event) => patchDraft(item.id, 'altText', event.target.value)} placeholder="Alt text" />
                  <FieldTextarea value={draft.reason} onChange={(event) => patchDraft(item.id, 'reason', event.target.value)} rows={2} placeholder={isRu ? 'Причина отклонения' : 'Rejection reason'} />

                  <ToolbarRow>
                    <button className="btn btn-primary btn-sm" type="button" disabled={busyId === item.id || item.status !== 'PENDING'} onClick={() => void approveSuggestion(item)}>
                      {isRu ? 'Принять и применить' : 'Approve and apply'}
                    </button>
                    <button className="btn btn-ghost btn-sm" type="button" disabled={busyId === item.id || item.status !== 'PENDING'} onClick={() => void rejectSuggestion(item)}>
                      {isRu ? 'Отклонить' : 'Reject'}
                    </button>
                  </ToolbarRow>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={isRu ? 'Нет подписей на модерации' : 'No caption suggestions'}
          description={isRu ? 'Когда участник предложит подпись к существующему медиа, она появится здесь.' : 'When a participant suggests a caption for existing media, it will appear here.'}
          actions={<Link href={`/${locale}/admin/media`} className="btn btn-primary">{isRu ? 'К разделу Фотобанк' : 'Go to Media bank'}</Link>}
        />
      )}
    </div>
  );
}
