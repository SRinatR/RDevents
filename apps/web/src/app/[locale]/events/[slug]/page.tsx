'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { eventsApi, analyticsApi } from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouteParams } from '../../../../hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, Panel, SectionHeader } from '@/components/ui/signal-primitives';
import { PublicFooter } from '../../../../components/layout/PublicFooter';

const QUEST_NAV_ITEMS = [
  { label: 'О событии', href: '#about' },
  { label: 'Станции', href: '#stations' },
  { label: 'Программа', href: '#program' },
  { label: 'Регистрация', href: '#registration' },
  { label: 'FAQ', href: '#contacts' },
];

const QUEST_HIGHLIGHTS = [
  'Юбилейный культурный квест к 25-летию Русского дома',
  'Именной «Паспорт гостя Русского дома» с отметками по всем шести станциям',
  'Маршрут про язык, традиции, музыку, творчество, доверие и силу характера',
  'Финал с награждением, выставкой работ и общей праздничной фотосессией',
];

const QUEST_STATS = [
  { value: '14-25', label: 'возраст участников' },
  { value: '100+', label: 'участников' },
  { value: '12', label: 'команд' },
  { value: '6', label: 'станций маршрута' },
  { value: '4 часа', label: 'продолжительность' },
  { value: '25 лет', label: 'Русскому дому' },
];

const QUEST_STATIONS = [
  {
    title: 'Живое слово',
    mark: '01',
    text: 'Станция о русском языке как живой памяти культуры: пословицы, выражения, разговор о доме и уважении к традиции.',
  },
  {
    title: 'Тепло традиций',
    mark: '02',
    text: 'Пространство русского гостеприимства, где хлеб, соль, рушник и обряд встречи раскрывают тепло дома.',
  },
  {
    title: 'Музыка души',
    mark: '03',
    text: 'Живое звучание, народная песня и общий ритм, в котором команда учится слышать друг друга.',
  },
  {
    title: 'Русский узор',
    mark: '04',
    text: 'Творческая мастерская с образом матрёшки как символа семьи, преемственности и многообразия традиций.',
  },
  {
    title: 'ВМЕСТЕ',
    mark: '05',
    text: 'Задания на доверие и командное взаимодействие, где поддержка становится главным условием маршрута.',
  },
  {
    title: 'Русский характер',
    mark: '06',
    text: 'Игровая площадка силы духа, выдержки и товарищества с честной командной борьбой.',
  },
];

const QUEST_TIMELINE = [
  { time: '10:00-11:00', title: 'Сбор и регистрация участников', place: 'Русский дом в Ташкенте' },
  { time: '11:00-11:30', title: 'Торжественное открытие юбилейного квеста', place: 'Основная площадка' },
  { time: '11:30-13:30', title: 'Прохождение маршрута по 6 станциям', place: 'Тематические пространства' },
  { time: '13:30-14:00', title: 'Финал маршрута и подведение итогов', place: 'Финальная площадка' },
  { time: '14:00-14:30', title: 'Кофе-брейк и неформальное общение', place: 'Зона отдыха' },
  { time: '14:30-15:00', title: 'Награждение и памятные призы', place: 'Сцена' },
  { time: '15:00-15:30', title: 'Фотосессия, выставка работ, общение гостей', place: 'Фотозона' },
];

const QUEST_GALLERY_ITEMS = [
  {
    title: 'Юбилейная афиша проекта',
    subtitle: 'Главный визуальный образ 25-летия Русского дома',
  },
  {
    title: 'Станция «Живое слово»',
    subtitle: 'Язык, смысл, пословицы, память поколений',
  },
  {
    title: 'Станция «Тепло традиций»',
    subtitle: 'Хлеб-соль, гостеприимство, атмосфера русского дома',
  },
  {
    title: 'Финал и награждение',
    subtitle: 'Фотозона, выставка работ, праздничная атмосфера',
  },
];

const QUEST_FAQ_ITEMS = [
  {
    question: 'Нужна ли предварительная регистрация?',
    answer: 'Да. Участие проходит по предварительной регистрации. Количество мест ограничено, поэтому лучше подать заявку заранее и дождаться подтверждения.',
  },
  {
    question: 'Как проходит маршрут квеста?',
    answer: 'После открытия участники получают «Паспорт гостя Русского дома» и проходят шесть тематических станций, собирая отметки и баллы команды.',
  },
  {
    question: 'Кто может принять участие?',
    answer: 'К участию приглашаются школьники, студенты, молодёжные объединения и гости мероприятия. Формат события рассчитан на командное прохождение.',
  },
  {
    question: 'Чем завершается программа?',
    answer: 'Финал включает подведение итогов, выставку творческих работ, фотосессию, вручение памятных призов и закрытие юбилейного культурного квеста.',
  },
];

function QuestBadge({ children, inverted = false }: { children: ReactNode; inverted?: boolean }) {
  return (
    <span className={`rhq-badge${inverted ? ' rhq-badge-inverted' : ''}`}>
      <span aria-hidden="true">+</span>
      {children}
    </span>
  );
}

function QuestSectionHeader({
  eyebrow,
  title,
  copy,
  inverted = false,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  inverted?: boolean;
}) {
  return (
    <div className={`rhq-section-heading${inverted ? ' rhq-section-heading-inverted' : ''}`}>
      <QuestBadge inverted={inverted}>{eyebrow}</QuestBadge>
      <h2>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </div>
  );
}

export default function EventDetailPage() {
  const t = useTranslations();
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
        
        // Find participant membership status
        const participantMembership = currentEvent.memberships?.find((membership: any) => membership.role === 'PARTICIPANT');
        if (participantMembership) {
          setParticipationStatus(participantMembership.status);
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
  const eventDateRange = `${formatDate(event.startsAt)} · ${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`;
  const spotsLeft = Math.max((event.capacity ?? 0) - (event.registrationsCount ?? 0), 0);
  const isRussiaHouseEvent = event.slug === 'dom-gde-zhivet-rossiya';
  
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
  
  function renderParticipationPanel(className: string) {
    const cabinetHref = `/${locale}/cabinet/events?event=${encodeURIComponent(event.slug)}#event-${event.slug}`;

    return (
      <Panel className={className} id="event-participation">
        <SectionHeader
          title={locale === 'ru' ? 'Регистрация через личный кабинет' : 'Registration through cabinet'}
          subtitle={locale === 'ru'
            ? 'Публичная страница показывает информацию о событии. Подача заявки, precheck профиля и командные действия доступны только в ЛК.'
            : 'The public page shows event information. Application, profile precheck, and team actions are available only in your cabinet.'}
        />

        {showCountPublicly && (
          <>
            <div className="progress-bar signal-gap-after-2xs public-participation-progress"><div className={`progress-bar-fill${isFull ? ' danger' : ''}`} style={{ width: `${capacityPct}%` }} /></div>
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

        {!registrationEnabled ? <Notice tone="warning">{locale === 'ru' ? 'Регистрация закрыта организатором.' : 'Registration is closed by organizer.'}</Notice> : null}
        {registrationNotOpen ? <Notice tone="warning">{locale === 'ru' ? 'Регистрация ещё не открыта.' : 'Registration is not open yet.'}</Notice> : null}
        {registrationExpired ? <Notice tone="warning">{locale === 'ru' ? 'Дедлайн регистрации прошёл.' : 'Registration deadline has passed.'}</Notice> : null}

        {participationStatus === 'ACTIVE' || isRegistered ? (
          <Notice tone="success">
            <div>{getParticipationStatusLabel('ACTIVE')}</div>
            <Link href={`/${locale}/cabinet/my-events/${event.slug}`} className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>
              {locale === 'ru' ? 'Открыть рабочее пространство' : 'Open event workspace'}
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
          : (
            <div className="signal-stack">
              <Link href={cabinetHref} className="btn btn-primary">
                {locale === 'ru' ? 'Перейти в ЛК для подачи заявки' : 'Open cabinet to apply'}
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
            ? <Link href={user ? cabinetHref : `/${locale}/login`} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Волонтёрские действия в ЛК' : 'Volunteer actions in cabinet'}</Link>
              : null}
      </Panel>
    );
  }

  if (isRussiaHouseEvent) {
    const heroImage = event.coverImageUrl || '/dom-gde-zhivet-rossiya.jpg';
    const descriptionParts = String(event.fullDescription ?? '').split(/\n{2,}/).filter(Boolean);

    return (
      <div className="public-page-shell route-shell route-event-detail route-russia-house-quest">
        <main className="rhq-page">
          <section className="rhq-hero" id="top">
            <img className="rhq-hero-image" src={heroImage} alt={event.title} />
            <div className="rhq-hero-overlay" />
            <div className="rhq-container rhq-hero-inner">
              <div className="rhq-hero-copy">
                <QuestBadge inverted>25 лет Русскому дому в Ташкенте</QuestBadge>
                <h1>{event.title}</h1>
                <p>{event.shortDescription}</p>
                <div className="rhq-hero-actions">
                  <a href="#registration" className="rhq-button rhq-button-primary">Зарегистрироваться</a>
                  <a href="#program" className="rhq-button rhq-button-secondary">Смотреть программу</a>
                </div>
              </div>

              <div className="rhq-hero-facts" aria-label="Ключевая информация">
                <article>
                  <span>Дата и время</span>
                  <strong>{eventDateRange}</strong>
                </article>
                <article>
                  <span>Локация</span>
                  <strong>{event.location}</strong>
                </article>
                <article>
                  <span>Формат</span>
                  <strong>Командный маршрут</strong>
                </article>
                <article>
                  <span>Регистрация</span>
                  <strong>{registrationBlocked ? 'Закрыта' : 'Открыта'}</strong>
                </article>
              </div>
            </div>
          </section>

          <nav className="rhq-subnav" aria-label="Навигация по событию">
            <div className="rhq-container rhq-subnav-inner">
              {QUEST_NAV_ITEMS.map((item) => (
                <a key={item.href} href={item.href}>{item.label}</a>
              ))}
            </div>
          </nav>

          <section className="rhq-section rhq-intro" id="about">
            <div className="rhq-container rhq-intro-grid">
              <div>
                <QuestSectionHeader
                  eyebrow="О событии"
                  title="Путешествие по дому, языку и традициям"
                  copy="Юбилейный квест собирает участников в общий маршрут по пространствам Русского дома. Каждая станция раскрывает отдельную грань культуры, а финал превращает прохождение в общий праздник."
                />
                <div className="rhq-copy">
                  {descriptionParts.map((part) => <p key={part}>{part}</p>)}
                </div>
              </div>
              <div className="rhq-highlight-list">
                {QUEST_HIGHLIGHTS.map((item) => (
                  <article key={item}>
                    <span aria-hidden="true">✓</span>
                    <p>{item}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="rhq-stats-band" aria-label="Цифры мероприятия">
            <div className="rhq-container rhq-stats-grid">
              {QUEST_STATS.map((item) => (
                <article key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="rhq-section" id="stations">
            <div className="rhq-container">
              <QuestSectionHeader
                eyebrow="Станции квеста"
                title="Шесть пространств одного маршрута"
                copy="Команды проходят путь от живого слова до русского характера, собирая отметки в «Паспорт гостя Русского дома»."
              />
              <div className="rhq-stations-grid">
                {QUEST_STATIONS.map((station) => (
                  <article className="rhq-station-card" key={station.title}>
                    <span className="rhq-station-mark">{station.mark}</span>
                    <h3>{station.title}</h3>
                    <p>{station.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="rhq-section rhq-program-section" id="program">
            <div className="rhq-container rhq-program-panel">
              <div className="rhq-program-heading">
                <QuestSectionHeader
                  eyebrow="Программа дня"
                  title="От регистрации до праздничного финала"
                  copy="Маршрут рассчитан на живое участие команд, торжественное открытие, прохождение станций и общую церемонию награждения."
                  inverted
                />
              </div>
              <div className="rhq-timeline">
                {QUEST_TIMELINE.map((item) => (
                  <article key={`${item.time}-${item.title}`}>
                    <time>{item.time}</time>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.place}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="rhq-section rhq-venue-section" id="venue">
            <div className="rhq-container rhq-venue-grid">
              <article>
                <QuestSectionHeader eyebrow="Дата и место" title="Русский дом в Ташкенте" />
                <dl>
                  <div>
                    <dt>Когда</dt>
                    <dd>{eventDateRange}</dd>
                  </div>
                  <div>
                    <dt>Где</dt>
                    <dd>{event.location}</dd>
                  </div>
                  <div>
                    <dt>Дедлайн регистрации</dt>
                    <dd>{event.registrationDeadline ? `${formatDate(event.registrationDeadline)} · ${formatTime(event.registrationDeadline)}` : 'Будет объявлен дополнительно'}</dd>
                  </div>
                </dl>
              </article>
              <article>
                <QuestSectionHeader eyebrow="Формат участия" title="Командная игра с финальным маршрутом" />
                <p>Участники проходят станции в командах, выполняют задания, получают отметки и приходят к общему финалу. Можно создать свою команду, вступить по коду приглашения или участвовать одному, если формат события это допускает.</p>
              </article>
            </div>
          </section>

          <section className="rhq-section rhq-registration-section" id="registration">
            <div className="rhq-container rhq-registration-grid">
              <div>
                <QuestSectionHeader
                  eyebrow="Регистрация"
                  title="Подайте заявку на участие"
                  copy="Система сохранит статус заявки, команду и дополнительные поля анкеты. Если нужны данные профиля, страница подскажет, что заполнить."
                />
                <div className="rhq-registration-notes">
                  <article>
                    <strong>{spotsLeft}</strong>
                    <span>ориентировочно свободных мест</span>
                  </article>
                  <article>
                    <strong>{event.capacity}</strong>
                    <span>общая вместимость события</span>
                  </article>
                </div>
              </div>
              <div className="rhq-registration-card">
                {renderParticipationPanel('public-participation-panel rhq-registration-panel')}
                <button onClick={handleCopyLink} className="rhq-button rhq-button-secondary rhq-share-button">
                  {copied ? 'Ссылка скопирована' : 'Поделиться событием'}
                </button>
              </div>
            </div>
          </section>

          <section className="rhq-section" id="gallery">
            <div className="rhq-container">
              <QuestSectionHeader
                eyebrow="Галерея"
                title="Юбилейный образ проекта"
                copy="Здесь собраны визуальные акценты мероприятия: афиша, тематические станции и праздничный финал."
              />
              <div className="rhq-gallery-grid">
                <article className="rhq-gallery-feature">
                  <img src={heroImage} alt="Юбилейный квест «Дом, где живёт Россия»" />
                  <div>
                    <h3>{QUEST_GALLERY_ITEMS[0].title}</h3>
                    <p>{QUEST_GALLERY_ITEMS[0].subtitle}</p>
                  </div>
                </article>
                {QUEST_GALLERY_ITEMS.slice(1).map((item, index) => (
                  <article className="rhq-gallery-card" key={item.title}>
                    <span>{String(index + 2).padStart(2, '0')}</span>
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="rhq-section rhq-contacts-section" id="contacts">
            <div className="rhq-container rhq-contacts-grid">
              <article className="rhq-contact-card">
                <QuestSectionHeader eyebrow="Контакты" title="Связаться с оргкомитетом" inverted />
                <p>По вопросам участия, регистрации, команд и партнёрского взаимодействия напишите организаторам мероприятия.</p>
                <a href={`mailto:${event.contactEmail ?? 'platform@example.com'}`}>{event.contactEmail ?? 'platform@example.com'}</a>
              </article>
              <div className="rhq-faq-list">
                <QuestSectionHeader eyebrow="FAQ" title="Часто задаваемые вопросы" />
                {QUEST_FAQ_ITEMS.map((item, index) => (
                  <details key={item.question} open={index === 0}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        </main>

        <PublicFooter locale={locale} />
      </div>
    );
  }

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
