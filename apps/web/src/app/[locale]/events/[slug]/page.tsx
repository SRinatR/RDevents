'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { eventsApi, analyticsApi, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouteParams } from '../../../../hooks/useRouteParams';
import { EmptyState, FieldTextarea, LoadingLines, Notice, Panel, SectionHeader, ToolbarRow } from '@/components/ui/signal-primitives';
import { PublicFooter } from '../../../../components/layout/PublicFooter';

type MissingField = {
  key: string;
  label: string;
  scope: 'PROFILE' | 'EVENT_FORM';
  action: 'PROFILE' | 'EVENT_FORM';
};

const FIELD_LABELS_RU: Record<string, string> = {
  name: 'Имя',
  phone: 'Телефон',
  city: 'Город',
  factualAddress: 'Фактический адрес',
  telegram: 'Telegram',
  nativeLanguage: 'Родной язык',
  communicationLanguage: 'Язык коммуникации',
  birthDate: 'Дата рождения',
  avatarUrl: 'Фото профиля',
  bio: 'Био',
  motivation: 'Мотивация участия',
  experience: 'Опыт',
  teamPreference: 'Предпочтение по команде',
  tshirtSize: 'Размер футболки',
  emergencyContact: 'Контакт на случай экстренной связи',
  preferredSlot: 'Предпочтительный слот',
  specialRequirements: 'Особые требования',
  university: 'Университет',
  faculty: 'Факультет',
  course: 'Курс',
};

export default function EventDetailPage() {
  const t = useTranslations();
  const { user } = useAuth();
  const { locale, get } = useRouteParams();
  const slug = get('slug');

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [hasPendingApplication, setHasPendingApplication] = useState(false);
  const [participationStatus, setParticipationStatus] = useState<string | null>(null);
  const [volunteering, setVolunteering] = useState(false);
  const [volunteerError, setVolunteerError] = useState('');
  const [volunteerStatus, setVolunteerStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [teamState, setTeamState] = useState<'IDLE' | 'CREATING' | 'JOINING'>('IDLE');
  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [teamError, setTeamError] = useState('');
  const [myTeam, setMyTeam] = useState<any>(null);
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [eventAnswers, setEventAnswers] = useState<Record<string, string>>({});
  const [savingAnswers, setSavingAnswers] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    eventsApi.get(slug)
      .then(({ event: currentEvent }) => {
        setEvent(currentEvent);
        setIsRegistered(currentEvent.isRegistered ?? false);
        setMyTeam(currentEvent.teamMembership?.team ?? null);
        setEventAnswers(currentEvent.registrationAnswers ?? {});
        
        // Find participant membership status
        const participantMembership = currentEvent.memberships?.find((membership: any) => membership.role === 'PARTICIPANT');
        if (participantMembership) {
          setParticipationStatus(participantMembership.status);
          setHasPendingApplication(participantMembership.status === 'PENDING');
          setIsRegistered(participantMembership.status === 'ACTIVE');
        }
        
        // Find volunteer membership status
        const vm = currentEvent.memberships?.find((membership: any) => membership.role === 'VOLUNTEER');
        setVolunteerStatus(vm?.status ?? null);
        analyticsApi.track('EVENT_DETAIL_VIEW', { eventId: currentEvent.id, locale });
      })
      .catch(() => setError('Event not found'))
      .finally(() => setLoading(false));
  }, [slug, locale]);

  async function handleRegister() {
    if (!user) return;
    setRegistering(true);
    setRegError('');
    analyticsApi.track('REGISTER_CLICK', { eventId: event.id });
    try {
      await eventsApi.register(event.id, eventAnswers);
      setIsRegistered(true);
      setMissingFields([]);
      setEvent((previous: any) => previous ? { ...previous, registrationsCount: previous.registrationsCount + 1 } : previous);
      analyticsApi.track('EVENT_REGISTRATION', { eventId: event.id });
    } catch (err) {
      handleRegistrationError(err, setRegError);
    } finally {
      setRegistering(false);
    }
  }

  async function handleCreateTeam() {
    if (!user) return;
    setRegistering(true);
    setTeamError('');
    try {
      const result = await eventsApi.createTeam(event.id, { name: teamName, answers: eventAnswers });
      setMyTeam(result.team);
      setIsRegistered(result.team.status === 'ACTIVE');
      setMissingFields([]);
      setTeamState('IDLE');
      if (result.team.status === 'ACTIVE') {
        setEvent((previous: any) => previous ? { ...previous, registrationsCount: previous.registrationsCount + 1 } : previous);
      }
    } catch (err) {
      handleRegistrationError(err, setTeamError);
    } finally {
      setRegistering(false);
    }
  }

  async function handleJoinTeam() {
    if (!user) return;
    setRegistering(true);
    setTeamError('');
    try {
      const { member } = await eventsApi.joinTeamByCode(event.id, joinCode, eventAnswers);
      const { team } = await eventsApi.getTeam(event.id, member.teamId);
      setMyTeam(team);
      setIsRegistered(member.status === 'ACTIVE');
      setMissingFields([]);
      setTeamState('IDLE');
      if (member.status === 'ACTIVE') {
        setEvent((previous: any) => previous ? { ...previous, registrationsCount: previous.registrationsCount + 1 } : previous);
      }
    } catch (err: any) {
      handleRegistrationError(err, setTeamError);
    } finally {
      setRegistering(false);
    }
  }

  function handleRegistrationError(err: unknown, setMessage: (message: string) => void) {
    if (err instanceof ApiError) {
      const details = err.details as { missingFields?: MissingField[] } | undefined;
      if (Array.isArray(details?.missingFields)) {
        setMissingFields(details.missingFields);
        setMessage('');
        return;
      }
      setMessage(err.message);
      return;
    }
    setMessage(locale === 'ru' ? 'Не удалось выполнить действие' : 'Action failed');
  }

  async function handleSaveRegistrationAnswers() {
    if (!user || !event) return;
    setSavingAnswers(true);
    setRegError('');
    setTeamError('');
    try {
      await eventsApi.saveRegistrationAnswers(event.id, eventAnswers);
      const { precheck } = await eventsApi.registrationPrecheck(event.id, eventAnswers);
      setMissingFields(precheck.missingFields ?? []);
      if (precheck.ok) {
        setRegError(locale === 'ru' ? 'Анкета сохранена. Теперь можно завершить участие.' : 'Form saved. You can finish joining now.');
      }
    } catch (err) {
      handleRegistrationError(err, setRegError);
    } finally {
      setSavingAnswers(false);
    }
  }

  async function handleVolunteerApply() {
    if (!user || !event) return;
    setVolunteering(true);
    setVolunteerError('');
    try {
      await eventsApi.applyVolunteer(event.id);
      setVolunteerStatus('PENDING');
      analyticsApi.track('VOLUNTEER_APPLICATION_SUBMITTED', { eventId: event.id });
    } catch (err) {
      if (err instanceof ApiError) setVolunteerError(err.message);
    } finally {
      setVolunteering(false);
    }
  }

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

  const capacityPct = event.capacity > 0
    ? Math.min((event.registrationsCount / event.capacity) * 100, 100)
    : 0;
  const isFull = event.registrationsCount >= event.capacity;
  const registrationEnabled = event.registrationEnabled !== false;
  const registrationNotOpen = event.registrationOpensAt ? new Date(event.registrationOpensAt).getTime() > Date.now() : false;
  const registrationExpired = event.registrationDeadline ? new Date(event.registrationDeadline).getTime() < Date.now() : false;
  const hasActiveVolunteer = ['PENDING', 'APPROVED', 'ACTIVE'].includes(volunteerStatus ?? '');
  const profileMissing = missingFields.filter((field) => field.scope === 'PROFILE');
  const eventFormMissing = missingFields.filter((field) => field.scope === 'EVENT_FORM');
  const profileLink = profileMissing.length > 0
    ? `/${locale}/cabinet/profile?${new URLSearchParams({
        required: profileMissing.map((field) => field.key).join(','),
        event: event.title,
      }).toString()}`
    : '';
  const fieldLabel = (field: MissingField) => locale === 'ru'
    ? FIELD_LABELS_RU[field.key] ?? field.label
    : field.label;
  const isRussiaHouseEvent = event.slug === 'dom-gde-zhivet-rossiya';
  const eventDateRange = isRussiaHouseEvent
    ? (locale === 'ru' ? 'воскресенье, 3 мая 2026 г. · 10:30 – 15:30' : 'Sunday, May 3, 2026 · 10:30 – 15:30')
    : `${formatDate(event.startsAt)} · ${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`;
  const spotsLeft = Math.max((event.capacity ?? 0) - (event.registrationsCount ?? 0), 0);
  
  // Participation config values
  const requireApproval = event.requireParticipantApproval;
  const showCountPublicly = event.participantCountVisibility === 'PUBLIC';
  const limitMode = event.participantLimitMode;
  const participantTarget = event.participantTarget ?? event.capacity;
  const isStrictLimit = limitMode === 'STRICT_LIMIT';
  const isGoalLimit = limitMode === 'GOAL_LIMIT';
  const registrationBlocked = !registrationEnabled || registrationNotOpen || registrationExpired || (isFull && isStrictLimit);
  
  // Status labels
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
  
  const getParticipationStatusTone = (status: string | null): 'success' | 'warning' | 'danger' | 'info' => {
    if (!status) return 'info';
    if (status === 'ACTIVE') return 'success';
    if (status === 'PENDING') return 'warning';
    if (status === 'RESERVE') return 'info';
    return 'danger';
  };

  return (
    <div className="public-page-shell route-shell route-event-detail route-event-v4">
      <main className="public-main">
        <section className="event-v4-masthead motion-fade-up">
          <div className="event-v4-media-layer">
            {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <div className="cover-fallback"><span>{event.title.slice(0, 2).toUpperCase()}</span></div>}
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
              {isRussiaHouseEvent
                ? <article><small>{locale === 'ru' ? 'Участники' : 'Participants'}</small><strong>60+ {locale === 'ru' ? 'участников' : 'participants'}</strong></article>
                : <article><small>{locale === 'ru' ? 'Свободные места' : 'Spots left'}</small><strong>{isFull ? (locale === 'ru' ? 'Нет мест' : 'No spots left') : spotsLeft}</strong></article>}
              <article><small>{locale === 'ru' ? 'Формат участия' : 'Participation format'}</small><strong>{(isRussiaHouseEvent || event.isTeamBased) ? (locale === 'ru' ? 'Командный маршрут' : 'Team route') : (locale === 'ru' ? 'Индивидуальный' : 'Individual')}</strong></article>
            </div>
            {isRussiaHouseEvent ? (
              <div className="public-meta-row public-gap-after-xs">
                <a href="https://yandex.ru/maps/-/CPCiq-o7" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                  {locale === 'ru' ? 'Открыть маршрут в Яндекс Картах' : 'Open route in Yandex Maps'}
                </a>
              </div>
            ) : null}
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
                <Panel className="public-participation-panel event-v4-participation-panel">
                  <SectionHeader title={locale === 'ru' ? 'Участие' : 'Participation'} subtitle={locale === 'ru' ? 'Действия и текущий статус' : 'Actions and current status'} />

                  {showCountPublicly && !isRussiaHouseEvent && (
                    <>
                      <div className="progress-bar signal-gap-after-2xs public-participation-progress"><div className={`progress-bar-fill${isFull ? ' danger' : ''}`} style={{ width: `${capacityPct}%` }} /></div>
                      <div className="signal-muted signal-gap-after-sm">{event.registrationsCount}/{event.capacity} {isFull ? (locale === 'ru' ? 'мест занято' : 'capacity reached') : (locale === 'ru' ? 'мест используется' : 'spots used')}</div>
                    </>
                  )}
                  {isRussiaHouseEvent ? (
                    <div className="signal-muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
                      60+ {locale === 'ru' ? 'участников' : 'participants'}
                    </div>
                  ) : null}

                  {requireApproval ? (
                    <div className="signal-muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
                      {locale === 'ru' ? 'Требуется одобрение организатора' : 'Requires organizer approval'}
                    </div>
                  ) : isStrictLimit && !isRussiaHouseEvent ? (
                    <div className="signal-muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
                      {locale === 'ru' ? `Свободных мест: ${spotsLeft} из ${participantTarget}` : `Spots left: ${spotsLeft} of ${participantTarget}`}
                    </div>
                  ) : isGoalLimit && !isRussiaHouseEvent ? (
                    <div className="signal-muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
                      {locale === 'ru' ? `Цель: ${participantTarget} участников` : `Goal: ${participantTarget} participants`}
                    </div>
                  ) : null}

                  {!registrationEnabled ? <Notice tone="warning">{locale === 'ru' ? 'Регистрация закрыта организатором.' : 'Registration is closed by organizer.'}</Notice> : null}
                  {registrationNotOpen ? <Notice tone="warning">{locale === 'ru' ? 'Регистрация ещё не открыта.' : 'Registration is not open yet.'}</Notice> : null}
                  {registrationExpired ? <Notice tone="warning">{locale === 'ru' ? 'Дедлайн регистрации прошёл.' : 'Registration deadline has passed.'}</Notice> : null}

                  {myTeam ? <Notice tone="success">{locale === 'ru' ? 'Вы состоите в команде' : 'You are on team'}: {myTeam.name}</Notice>
                    : participationStatus === 'ACTIVE' ? <Notice tone="success">{getParticipationStatusLabel('ACTIVE')}</Notice>
                    : participationStatus === 'PENDING' ? (
                      <Notice tone="warning">
                        <div>{getParticipationStatusLabel('PENDING')}</div>
                        <div style={{ fontSize: '0.8rem', marginTop: 4 }}>{locale === 'ru' ? 'Организатор рассмотрит вашу заявку' : 'Organizer will review your application'}</div>
                      </Notice>
                    )
                    : participationStatus === 'RESERVE' ? <Notice tone="info">{getParticipationStatusLabel('RESERVE')}</Notice>
                    : participationStatus && ['REJECTED', 'CANCELLED', 'REMOVED'].includes(participationStatus) ? <Notice tone="danger">{getParticipationStatusLabel(participationStatus)}</Notice>
                    : user ? (
                      <div className="signal-stack">
                        {event.isTeamBased ? (
                          <>
                            {teamState === 'IDLE' ? (
                              <ToolbarRow>
                                <button onClick={() => setTeamState('CREATING')} disabled={registrationBlocked} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Создать команду' : 'Create team'}</button>
                                <button onClick={() => setTeamState('JOINING')} disabled={registrationBlocked} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Вступить по коду' : 'Join by code'}</button>
                                {event.allowSoloParticipation ? <button onClick={handleRegister} disabled={registering || registrationBlocked} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Участвовать одному' : 'Participate solo'}</button> : null}
                              </ToolbarRow>
                            ) : null}

                            {teamState === 'CREATING' ? (
                              <div className="signal-stack public-participation-state">
                                <input className="signal-field" placeholder={locale === 'ru' ? 'Название команды' : 'Team name'} value={teamName} onChange={(event) => setTeamName(event.target.value)} />
                                <ToolbarRow>
                                  <button onClick={handleCreateTeam} disabled={registering || !teamName} className="btn btn-primary btn-sm">{t('common.save')}</button>
                                  <button onClick={() => setTeamState('IDLE')} className="btn btn-secondary btn-sm">{t('common.cancel')}</button>
                                </ToolbarRow>
                              </div>
                            ) : null}

                            {teamState === 'JOINING' ? (
                              <div className="signal-stack public-participation-state">
                                <input className="signal-field" placeholder={locale === 'ru' ? 'Код приглашения' : 'Join code'} value={joinCode} onChange={(event) => setJoinCode(event.target.value)} />
                                <ToolbarRow>
                                  <button onClick={handleJoinTeam} disabled={registering || !joinCode} className="btn btn-primary btn-sm">{t('events.join')}</button>
                                  <button onClick={() => setTeamState('IDLE')} className="btn btn-secondary btn-sm">{t('common.cancel')}</button>
                                </ToolbarRow>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <button onClick={handleRegister} disabled={registering || registrationBlocked} className="btn btn-primary">
                            {registering ? t('common.loading') : registrationBlocked ? (locale === 'ru' ? 'Регистрация закрыта' : 'Registration closed') : requireApproval ? (locale === 'ru' ? 'Подать заявку' : 'Apply now') : t('events.join')}
                          </button>
                        )}

                        {teamError ? <Notice tone="danger">{teamError}</Notice> : null}
                        {regError ? <Notice tone="danger">{regError}</Notice> : null}
                      </div>
                    ) : <Link href={`/${locale}/login`} className="btn btn-primary">{t('events.loginToJoin')}</Link>}

                  {missingFields.length > 0 ? (
                    <Panel className="public-missing-fields-panel">
                      <SectionHeader title={locale === 'ru' ? 'Требуются дополнительные поля' : 'Additional fields required'} subtitle={locale === 'ru' ? 'Заполните профиль и анкету события' : 'Complete profile and event form fields'} />
                      <div className="signal-stack">
                        {missingFields.map((field) => (
                          <div key={`${field.scope}-${field.key}`} className="signal-ranked-item"><span>{fieldLabel(field)}</span></div>
                        ))}
                        {profileMissing.length > 0 ? <Link href={profileLink} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Заполнить профиль' : 'Complete profile'}</Link> : null}
                        {eventFormMissing.length > 0 ? eventFormMissing.map((field) => (
                          <label key={field.key} className="signal-stack">
                            <span className="signal-muted">{fieldLabel(field)}</span>
                            <FieldTextarea value={eventAnswers[field.key] ?? ''} onChange={(event) => setEventAnswers((previous) => ({ ...previous, [field.key]: event.target.value }))} rows={2} />
                          </label>
                        )) : null}
                        {eventFormMissing.length > 0 ? <button onClick={handleSaveRegistrationAnswers} disabled={savingAnswers} className="btn btn-primary btn-sm">{savingAnswers ? t('common.loading') : locale === 'ru' ? 'Сохранить анкету' : 'Save event form'}</button> : null}
                      </div>
                    </Panel>
                  ) : null}

                  {hasActiveVolunteer
                    ? <Notice tone="info">{locale === 'ru' ? 'Заявка волонтёра' : 'Volunteer request'}: {volunteerStatus}</Notice>
                    : user && event.volunteerApplicationsEnabled
                      ? <button onClick={handleVolunteerApply} disabled={volunteering} className="btn btn-secondary btn-sm">{volunteering ? t('common.loading') : locale === 'ru' ? 'Откликнуться как волонтёр' : 'Apply as volunteer'}</button>
                      : !user && event.volunteerApplicationsEnabled
                        ? <Link href={`/${locale}/login`} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Войти для волонтёрства' : 'Login to volunteer'}</Link>
                        : null}

                  {volunteerError ? <Notice tone="danger">{volunteerError}</Notice> : null}
                </Panel>

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
