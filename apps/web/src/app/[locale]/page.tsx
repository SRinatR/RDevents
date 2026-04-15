import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PublicFooter } from '../../components/layout/PublicFooter';

type HomePageProps = Readonly<{
  params: Promise<{
    locale: string;
  }>;
}>;

type PreviewEvent = {
  id: string;
  slug: string;
  title: string;
  category: string;
  location: string;
  startsAt: string;
  coverImageUrl?: string | null;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const previewEvents = await getPreviewEvents();
  const t = await getTranslations();
  const leadEvent = previewEvents[0];
  const nextEvent = previewEvents[1];

  return (
    <div className="public-page-shell">
      <main className="public-main">
        <section className="public-hero public-hero-stage">
          <div className="container public-hero-grid public-hero-grid-stage">
            <div className="public-hero-content public-hero-content-stage">
              <span className="public-kicker">{locale === 'ru' ? 'Платформа для современных мероприятий' : 'Modern event platform'}</span>
              <h1>{locale === 'ru' ? 'Управляйте событиями, командами и заявками в одном месте.' : 'Manage events, teams, and applications in one place.'}</h1>
              <p>
                {locale === 'ru'
                  ? 'Единое пространство для организаторов, участников и волонтёров: каталог событий, понятные сценарии участия и рабочая админ-панель.'
                  : 'One workspace for organizers, participants, and volunteers: event catalog, clear participation flows, and a practical admin panel.'}
              </p>
              <div className="public-hero-actions">
                <Link href={`/${locale}/events`} className="btn btn-primary">{t('events.title')}</Link>
                <Link href={`/${locale}/register`} className="btn btn-secondary">{locale === 'ru' ? 'Создать аккаунт' : 'Create account'}</Link>
                <Link href={leadEvent ? `/${locale}/events/${leadEvent.slug}` : `/${locale}/events`} className="btn btn-ghost">
                  {locale === 'ru' ? 'Смотреть главное событие' : 'View lead event'}
                </Link>
              </div>
              <div className="public-hero-points">
                <div>{locale === 'ru' ? 'Структура ролей, команд и волонтёрства' : 'Structured roles, teams, and volunteer workflow'}</div>
                <div>{locale === 'ru' ? 'Одна модель данных в Public / Cabinet / Admin' : 'One data model across Public / Cabinet / Admin'}</div>
                <div>{locale === 'ru' ? 'Прозрачные статусы и управляемые формы участия' : 'Transparent statuses and controlled participation forms'}</div>
              </div>
            </div>

            <aside className="public-hero-panel public-hero-panel-stage">
              <h3>{locale === 'ru' ? 'Обзор платформы' : 'Platform overview'}</h3>
              <div className="signal-stack">
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'События в предпросмотре' : 'Preview events'}</span><strong>{previewEvents.length}</strong></div>
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Режимы работы' : 'Modes'}</span><strong>{locale === 'ru' ? 'Публичный, кабинет, админ' : 'Public, cabinet, admin'}</strong></div>
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Архитектура участия' : 'Participation model'}</span><strong>{locale === 'ru' ? 'Соло, команды, волонтёры' : 'Solo, teams, volunteers'}</strong></div>
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Главное событие сейчас' : 'Current featured event'}</span><strong>{leadEvent ? leadEvent.title : (locale === 'ru' ? 'Список обновляется' : 'List is updating')}</strong></div>
              </div>
              {leadEvent ? (
                <Link href={`/${locale}/events/${leadEvent.slug}`} className="public-hero-panel-preview">
                  <div className="public-event-cover">
                    {leadEvent.coverImageUrl ? <img src={leadEvent.coverImageUrl} alt={leadEvent.title} /> : <CoverFallback title={leadEvent.title} />}
                  </div>
                  <div>
                    <small>{locale === 'ru' ? 'Сейчас в фокусе' : 'Now in focus'}</small>
                    <strong>{leadEvent.title}</strong>
                  </div>
                </Link>
              ) : null}
            </aside>
          </div>

          <div className="container">
            <div className="public-proof-strip">
              <div className="public-proof-card">
                <small>{locale === 'ru' ? 'Активные модули' : 'Active modules'}</small>
                <strong>06</strong>
              </div>
              <div className="public-proof-card">
                <small>{locale === 'ru' ? 'Средняя глубина сценария' : 'Avg. workflow depth'}</small>
                <strong>{locale === 'ru' ? '3 уровня' : '3 layers'}</strong>
              </div>
              <div className="public-proof-card">
                <small>{locale === 'ru' ? 'Сквозной контур' : 'Unified surface'}</small>
                <strong>Public / Cabinet / Admin</strong>
              </div>
              <div className="public-proof-card">
                <small>{locale === 'ru' ? 'Текущий релиз' : 'Current release'}</small>
                <strong>{locale === 'ru' ? 'Фаза 2' : 'Phase 2'}</strong>
              </div>
            </div>
          </div>
        </section>

        {leadEvent ? (
          <section className="public-featured-section public-featured-section-story">
            <div className="container">
              <div className="public-featured-story-grid">
                <article className="public-featured-card public-featured-card-main">
                  <div className="public-featured-content">
                    <span className="signal-status-badge tone-info">{locale === 'ru' ? 'Рекомендуемое событие' : 'Featured event'}</span>
                    <h2>{leadEvent.title}</h2>
                    <p>{locale === 'ru' ? 'Ближайшее событие с открытой регистрацией.' : 'The nearest event with registration currently open.'}</p>
                    <div className="public-meta-row">
                      <span>{formatPreviewDate(leadEvent.startsAt, locale)}</span>
                      <span>{leadEvent.location}</span>
                      <span>{leadEvent.category}</span>
                    </div>
                    <div className="public-featured-actions">
                      <Link href={`/${locale}/events/${leadEvent.slug}`} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Открыть событие' : 'Open event'}</Link>
                      <Link href={`/${locale}/events`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Смотреть весь каталог' : 'See full catalog'}</Link>
                    </div>
                    {nextEvent ? (
                      <div className="public-featured-next">
                        <small>{locale === 'ru' ? 'Следующее событие' : 'Up next'}</small>
                        <strong>{nextEvent.title}</strong>
                      </div>
                    ) : null}
                  </div>
                  <div className="public-featured-cover">
                    {leadEvent.coverImageUrl ? <img src={leadEvent.coverImageUrl} alt={leadEvent.title} /> : <CoverFallback title={leadEvent.title} />}
                  </div>
                </article>

                <div className="public-narrative-stack">
                  <article className="public-narrative-card">
                    <h3>{locale === 'ru' ? 'Планирование и запуск' : 'Planning and launch'}</h3>
                    <p>{locale === 'ru' ? 'Организаторы настраивают событие и параметры регистрации в одном процессе.' : 'Organizers set up events and registration modes in one flow.'}</p>
                  </article>
                  <article className="public-narrative-card">
                    <h3>{locale === 'ru' ? 'Участие и команды' : 'Participation and teams'}</h3>
                    <p>{locale === 'ru' ? 'Индивидуальное участие, команды и вход по коду собраны в единый сценарий.' : 'Solo participation, teams, and join-by-code are combined into one flow.'}</p>
                  </article>
                  <article className="public-narrative-card">
                    <h3>{locale === 'ru' ? 'Контроль и аналитика' : 'Control and analytics'}</h3>
                    <p>{locale === 'ru' ? 'Админ-панель помогает отслеживать приоритеты и ключевые показатели.' : 'The admin panel keeps priorities and key metrics visible.'}</p>
                  </article>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="public-section public-section-catalog-preview">
          <div className="container">
            <div className="public-section-head public-section-head-wide">
              <div>
                <h2>{locale === 'ru' ? 'Каталог событий' : 'Event catalog preview'}</h2>
                <p>{locale === 'ru' ? 'Быстрый доступ к активным событиям и текущим регистрациям.' : 'Quick access to active events and current registrations.'}</p>
              </div>
              <Link href={`/${locale}/events`} className="signal-chip-link">{locale === 'ru' ? 'Открыть полный каталог' : 'Open full catalog'}</Link>
            </div>

            {previewEvents.length === 0 ? (
              <div className="signal-empty-state">
                <h3>{locale === 'ru' ? 'События появятся скоро' : 'Events will appear soon'}</h3>
                <p>{locale === 'ru' ? 'Пока здесь пусто. Новые события появятся после публикации.' : 'Nothing here yet. New events will appear after publishing.'}</p>
              </div>
            ) : (
              <div className="public-events-grid public-events-preview-grid">
                {previewEvents.map((event, index) => (
                  <Link key={event.id} href={`/${locale}/events/${event.slug}`} className={`public-event-card public-event-card-preview ${index === 0 ? 'public-event-card-spotlight' : ''}`}>
                    <div className="public-event-cover">{event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <CoverFallback title={event.title} />}</div>
                    <div className="public-event-body">
                      <div className="public-meta-row"><span>{formatPreviewDate(event.startsAt, locale)}</span><span>{event.location}</span></div>
                      <h3>{event.title}</h3>
                      <div className="public-event-card-footer">
                        <span className="signal-status-badge tone-neutral">{event.category}</span>
                        <span className="signal-chip-link">{locale === 'ru' ? 'Открыть' : 'Open'}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <PublicFooter locale={locale} />
    </div>
  );
}

function CoverFallback({ title }: { title: string }) {
  return <div className="cover-fallback"><span>{title.slice(0, 2).toUpperCase()}</span></div>;
}

async function getPreviewEvents(): Promise<PreviewEvent[]> {
  const baseUrl =
    process.env['API_INTERNAL_URL'] ??
    process.env['NEXT_PUBLIC_API_BASE_URL'] ??
    'http://localhost:4000';

  try {
    const response = await fetch(`${baseUrl}/api/events?limit=3`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload.data) ? payload.data : [];
  } catch {
    return [];
  }
}

function formatPreviewDate(date: string, locale: string) {
  return new Date(date).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
