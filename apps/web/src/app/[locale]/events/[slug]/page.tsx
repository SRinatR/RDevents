'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { analyticsApi, eventsApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, Panel, SectionHeader } from '@/components/ui/signal-primitives';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { RussiaHouseQuestPage } from '@/components/events/russia-house-quest/RussiaHouseQuestPage';
import {
  getRegistrationClosedReason,
  getRegistrationClosedMessage,
} from '@/lib/registration-status';

export default function EventDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useAuth();
  const { locale, get } = useRouteParams();
  const slug = get('slug');

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [participationStatus, setParticipationStatus] = useState<string | null>(null);
  const [volunteerStatus, setVolunteerStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    eventsApi.get(slug)
      .then(({ event: currentEvent }) => {
        setEvent(currentEvent);
        setIsRegistered(currentEvent.isRegistered ?? false);
        
        const participantMembership = currentEvent.memberships?.find((membership: any) => membership.role === 'PARTICIPANT');
        if (participantMembership) {
          setParticipationStatus(participantMembership.status);
          setIsRegistered(participantMembership.status === 'ACTIVE');
        }
        
        const vm = currentEvent.memberships?.find((membership: any) => membership.role === 'VOLUNTEER');
        setVolunteerStatus(vm?.status ?? null);
        analyticsApi.track('EVENT_DETAIL_VIEW', { eventId: currentEvent.id, locale });
      })
      .catch(() => setError('Event not found'))
      .finally(() => setLoading(false));
  }, [slug, locale]);

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      hour: '2-digit', minute: '2-digit',
    });
  }

  function handleApplyCtaClick() {
    if (!slug) return;
    const cabinetHref = `/${locale}/cabinet/events/${slug}`;
    if (!user) {
      router.push(`/${locale}/login?next=${encodeURIComponent(cabinetHref)}`);
      return;
    }
    router.push(cabinetHref);
  }

  if (loading) {
    return (
      <div className="public-page-shell route-shell route-event-detail">
        <main className="public-main">
          <section className="public-section"><div className="container"><LoadingLines rows={8} /></div></section>
        </main>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="public-page-shell route-shell route-event-detail">
        <main className="public-main">
          <section className="public-section">
            <div className="container">
              <EmptyState title={error || 'Event not found'} description={locale === 'ru' ? 'Попробуйте вернуться к списку событий.' : 'Try going back to the event list.'} actions={<Link href={`/${locale}/events`} className="btn btn-primary btn-sm">{t('common.back')}</Link>} />
            </div>
          </section>
        </main>
      </div>
    );
  }

  const registrationClosedReason = getRegistrationClosedReason(event);
  const registrationBlocked = registrationClosedReason !== null;
  const registrationClosedMessage = getRegistrationClosedMessage(registrationClosedReason, locale);

  const hasActiveVolunteer = ['PENDING', 'APPROVED', 'ACTIVE'].includes(volunteerStatus ?? '');
  const isRussiaHouseEvent = event.slug === 'dom-gde-zhivet-rossiya';
  const spotsLeft = Math.max((event.capacity ?? 0) - (event.registrationsCount ?? 0), 0);
  const eventDateRange = isRussiaHouseEvent && locale === 'ru'
    ? 'воскресенье, 3 мая 2026 г. · 10:30 – 15:30'
    : `${formatDate(event.startsAt)} · ${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`;
  
  const requireApproval = event.requireParticipantApproval;
  const showCountPublicly = event.participantCountVisibility === 'PUBLIC';
  const limitMode = event.participantLimitMode;
  const participantTarget = event.participantTarget ?? event.capacity;
  const isStrictLimit = limitMode === 'STRICT_LIMIT';
  const isGoalLimit = limitMode === 'GOAL_LIMIT';
  const isFull = event.registrationsCount >= event.capacity;
  
  const getParticipationStatusLabel = (status: string | null) => {
    if (!status) return null;
    const labels: Record<string, string> = {
      'PENDING': locale === 'ru' ? 'Заявка на рассмотрении' : 'Application pending',
      'ACTIVE': locale === 'ru' ? 'Вы участник' : 'You are a participant',
      'RESERVE': locale === 'ru' ? 'В резерве' : 'In reserve',
      'REJECTED': locale === 'ru' ? 'Заявка отклонена' : 'Application rejected',
      'CANCELLED': locale === 'ru' ? 'Участие отменено' : 'Participation cancelled',
      'REMOVED': locale === 'ru' ? 'Удалён из участников' : 'Removed from participants',
    };
    return labels[status] ?? status;
  };
  
  function renderParticipationPanel(className: string) {
    const cabinetHref = `/${locale}/cabinet/events/${event.slug}`;

    return (
      <Panel className={className} id="event-participation">
        <SectionHeader
          title={locale === 'ru' ? 'Участие в мероприятии' : 'Event participation'}
          subtitle={locale === 'ru'
            ? 'Подайте заявку в личном кабинете. После входа система откроет страницу этого мероприятия и сохранит ваш прогресс.'
            : 'Apply in your cabinet. After sign-in, this event page opens directly and keeps your progress.'}
        />

        {showCountPublicly && (
          <>
            {!isRussiaHouseEvent ? <div className="signal-muted signal-gap-after-sm">{event.registrationsCount}/{event.capacity} {isFull ? (locale === 'ru' ? 'мест занято' : 'capacity reached') : (locale === 'ru' ? 'мест используется' : 'spots used')}</div> : null}
          </>
        )}

        {requireApproval ? (
          <div className="signal-muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
            {locale === 'ru' ? 'Требуется одобрение организатора' : 'Requires organizer approval'}
          </div>
        ) : isStrictLimit && !isRussiaHouseEvent ? (
          <div className="signal-muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
            {locale === 'ru' ? `Свободных мест: ${spotsLeft} из ${participantTarget}` : `Spots left: ${spotsLeft} of ${participantTarget}`}
          </div>
        ) : isGoalLimit ? (
          <div className="signal-muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
            {locale === 'ru' ? `Цель: ${participantTarget} участников` : `Goal: ${participantTarget} participants`}
          </div>
        ) : null}

        {registrationClosedReason ? (
          <Notice tone="warning">
            {registrationClosedMessage}
          </Notice>
        ) : null}

        {participationStatus === 'ACTIVE' || isRegistered ? (
          <Notice tone="success">
            <div>{getParticipationStatusLabel('ACTIVE')}</div>
            <Link href={cabinetHref} className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>
              {locale === 'ru' ? 'Открыть личный кабинет события' : 'Open event cabinet'}
            </Link>
          </Notice>
        )
          : participationStatus === 'PENDING' ? (
            <Notice tone="warning">
              <div>{getParticipationStatusLabel('PENDING')}</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>{locale === 'ru' ? 'Организатор рассмотрит вашу заявку' : 'Organizer will review your application'}</div>
            </Notice>
          )
          : participationStatus === 'RESERVE' ? <Notice tone="info">{getParticipationStatusLabel('RESERVE')}</Notice>
          : participationStatus && ['REJECTED', 'CANCELLED', 'REMOVED'].includes(participationStatus) ? <Notice tone="danger">{getParticipationStatusLabel(participationStatus)}</Notice>
          : hasActiveVolunteer ? (
            <Notice tone="info">
              {locale === 'ru'
                ? 'У вас активна волонтёрская заявка. Командный модуль доступен только участникам.'
                : 'You have an active volunteer application. Team module is available only for participants.'}
            </Notice>
          )
          : registrationBlocked && !participationStatus ? (
            <Notice tone="warning">
              {registrationClosedMessage}
            </Notice>
          )
          : (
            <div className="signal-stack">
              <Link href={cabinetHref} className="btn btn-primary">
                {locale === 'ru' ? 'Перейти в личный кабинет' : 'Open cabinet'}
              </Link>
              {event.isTeamBased ? (
                <Notice tone="info">
                  {locale === 'ru'
                    ? 'Команда создаётся и отправляется на утверждение только после одобрения вашей заявки участника.'
                    : 'The team module opens in the event workspace after participant approval.'}
                </Notice>
              ) : null}
            </div>
          )}

        {hasActiveVolunteer
          ? <Notice tone="info">{locale === 'ru' ? 'Заявка волонтёра' : 'Volunteer request'}: {volunteerStatus}</Notice>
          : event.volunteerApplicationsEnabled
            ? <Link href={user ? cabinetHref : `/${locale}/login?next=${encodeURIComponent(cabinetHref)}`} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Волонтёрские действия в ЛК' : 'Volunteer actions in cabinet'}</Link>
              : null}
      </Panel>
    );
  }

  if (isRussiaHouseEvent) {
    return (
      <RussiaHouseQuestPage
        event={event}
        locale={locale}
        user={user}
        onApply={handleApplyCtaClick}
        onCopyLink={handleCopyLink}
        copied={copied}
      />
    );
  }

  return (
    <div className="public-page-shell route-shell route-event-detail route-event-v4">
      <main className="public-main">
        <section className="event-v4-masthead motion-fade-up">
          <div className="event-v4-media-layer">
            {event.coverImageUrl ? <Image src={event.coverImageUrl} alt={event.title} fill sizes="100vw" style={{ objectFit: 'cover' }} priority /> : <div className="cover-fallback"><span>{event.title.slice(0, 2).toUpperCase()}</span></div>}
            <div className="event-v4-media-overlay" />
          </div>

          <div className="container-wide event-v4-masthead-inner">
            <div className="event-v4-title-zone">
              <div className="public-meta-row public-gap-after-xs">
                {isRussiaHouseEvent ? <span className="event-v4-status-badge">{locale === 'ru' ? 'Регистрация открыта' : 'Registration open'}</span> : null}
                {!isRussiaHouseEvent && event.category ? <span className="signal-muted">{event.category}</span> : null}
              </div>
              <h1>{event.title}</h1>
              <p>{event.shortDescription}</p>
            </div>

            <div className="event-v4-fact-grid">
              <article><small>{locale === 'ru' ? 'Дата и время' : 'Date & time'}</small><strong>{eventDateRange}</strong></article>
              <article><small>{locale === 'ru' ? 'Локация' : 'Location'}</small><strong>{event.location}</strong></article>
              {!isRussiaHouseEvent ? <article><small>{locale === 'ru' ? 'Свободные места' : 'Spots left'}</small><strong>{isFull ? (locale === 'ru' ? 'Нет мест' : 'No spots left') : spotsLeft}</strong></article> : null}
              <article><small>{locale === 'ru' ? 'Формат участия' : 'Participation format'}</small><strong>{(isRussiaHouseEvent || event.isTeamBased) ? (locale === 'ru' ? 'Командный' : 'Team-based') : (locale === 'ru' ? 'Индивидуальный' : 'Individual')}</strong></article>
            </div>
          </div>
        </section>

        <section className="event-v4-content motion-fade-up-fast">
          <div className="container-wide">
            <div className="event-v4-main-layout motion-stagger">
              <div className="event-v4-story-lane">
                <Panel className="event-v4-description-panel">
                  <SectionHeader title={t('events.description')} subtitle={locale === 'ru' ? 'Полная программа и содержание события' : 'Full story, context, and event structure'} />
                  <div className="signal-prose-copy">{event.fullDescription}</div>
                </Panel>
              </div>
              <section id="event-participation" className="event-v4-registration-stack motion-fade-up-fast">
                {renderParticipationPanel('public-participation-panel event-v4-participation-panel')}

                <div className="event-v4-share-action">
                  <button onClick={handleCopyLink} className="btn btn-secondary">
                    {copied ? (locale === 'ru' ? 'Ссылка скопирована' : 'Link copied') : (locale === 'ru' ? 'Поделиться событием' : 'Share event')}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter locale={locale} />
    </div>
  );
}
