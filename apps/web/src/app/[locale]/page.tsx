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
  shortDescription?: string | null;
  coverImageUrl?: string | null;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const previewEvents = await getPreviewEvents();
  const t = await getTranslations();
  const heroEvent = previewEvents[0] ?? null;
  const streamEvents = previewEvents.slice(1, 5);

  return (
    <div className="public-page-shell route-shell route-home route-home-v3">
      <main className="public-main home-v3-main">
        <section className="home-v3-hero motion-fade-up">
          <div className="home-v3-hero-media">
            {heroEvent?.coverImageUrl ? <img src={heroEvent.coverImageUrl} alt={heroEvent.title} /> : <div className="home-v3-hero-fallback-art" />}
            <div className="home-v3-hero-overlay" />
          </div>

          <div className="container-wide home-v3-hero-inner">
            <div className="home-v3-hero-copy">
              <span className="home-v3-kicker">{locale === 'ru' ? 'Культурно-образовательный центр' : 'Cultural and Educational Center'}</span>
              <h1>
                {locale === 'ru'
                  ? 'Русский Дом — платформа для мероприятий и культурных событий.'
                  : 'Russian House — platform for events and cultural activities.'}
              </h1>
              <p>
                {locale === 'ru'
                  ? 'Каталог событий, регистрация участников, команды и волонтёрство — всё в одном месте.'
                  : 'Event catalog, participant registration, teams and volunteering — all in one place.'}
              </p>

              <div className="home-v3-hero-actions">
                <Link href={`/${locale}/events`} className="btn btn-primary">{locale === 'ru' ? 'Открыть события' : 'Open events'}</Link>
                <Link href={`/${locale}/register`} className="btn btn-secondary">{locale === 'ru' ? 'Создать аккаунт' : 'Create account'}</Link>
                <Link href={heroEvent ? `/${locale}/events/${heroEvent.slug}` : `/${locale}/events`} className="btn btn-ghost">{locale === 'ru' ? 'Ближайший запуск' : 'Nearest launch'}</Link>
              </div>
            </div>

            <div className="home-v3-hero-dock">
              {heroEvent ? (
                <Link href={`/${locale}/events/${heroEvent.slug}`} className="home-v3-hero-dock-card">
                  <small>{locale === 'ru' ? 'Главная сцена' : 'Main stage'}</small>
                  <h2>{heroEvent.title}</h2>
                  <p>{heroEvent.shortDescription || (locale === 'ru' ? 'Откройте карточку события, чтобы посмотреть детали и условия участия.' : 'Open the event destination to view details and participation conditions.')}</p>
                  <div className="home-meta-row">
                    <span>{formatPreviewDate(heroEvent.startsAt, locale)}</span>
                    <span>{heroEvent.location}</span>
                    <span>{heroEvent.category}</span>
                  </div>
                </Link>
              ) : (
                <div className="home-v3-hero-dock-card home-v3-hero-dock-fallback">
                  <small>{locale === 'ru' ? 'Сцена подготовки' : 'Launch prep stage'}</small>
                  <h2>{locale === 'ru' ? 'Публикации готовятся к следующему релизу' : 'Public releases are preparing for the next cycle'}</h2>
                  <p>{locale === 'ru' ? 'Каталог обновится после публикации новых событий. Структура страницы остаётся цельной даже без featured-данных.' : 'Catalog updates when new events are published. The page keeps an intentional premium composition even without featured data.'}</p>
                  <Link href={`/${locale}/events`} className="signal-chip-link">{t('events.title')}</Link>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="home-v3-ribbon motion-fade-up-fast">
          <div className="container-wide">
            <div className="home-v3-ribbon-track">
              <article><small>{locale === 'ru' ? 'Сценарий' : 'Flow'}</small><strong>Discover · Apply · Execute</strong></article>
              <article><small>{locale === 'ru' ? 'Форматы' : 'Formats'}</small><strong>{locale === 'ru' ? 'Индивидуальный и командный вход' : 'Individual and team entry'}</strong></article>
              <article><small>{locale === 'ru' ? 'Пульс каталога' : 'Catalog pulse'}</small><strong>{previewEvents.length} {locale === 'ru' ? 'активных позиций' : 'active slots'}</strong></article>
              <article><small>{locale === 'ru' ? 'Роль волонтёров' : 'Volunteer track'}</small><strong>{locale === 'ru' ? 'Встроен в участие' : 'Integrated into participation'}</strong></article>
            </div>
          </div>
        </section>

        <section className="home-v3-stream motion-fade-up-fast">
          <div className="container-wide">
            <div className="home-v3-stream-head">
              <div>
                <h2>{locale === 'ru' ? 'События в текущем цикле' : 'Events in the current cycle'}</h2>
                <p>{locale === 'ru' ? 'Не равномерная сетка, а режиссированная лента с разным визуальным весом.' : 'Not a uniform grid, but an art-directed stream with deliberate weight and rhythm.'}</p>
              </div>
              <Link href={`/${locale}/events`} className="signal-chip-link">{locale === 'ru' ? 'Весь каталог' : 'Full catalog'}</Link>
            </div>

            {streamEvents.length === 0 ? (
              <div className="signal-empty-state">
                <h3>{locale === 'ru' ? 'Лента скоро пополнится' : 'The stream will fill soon'}</h3>
                <p>{locale === 'ru' ? 'Пока доступна только главная сцена. Новые позиции появятся после публикации.' : 'Only the main stage is available now. New slots will appear after publishing.'}</p>
              </div>
            ) : (
              <div className="home-v3-stream-layout motion-stagger">
                {streamEvents.map((event, index) => (
                  <Link
                    key={event.id}
                    href={`/${locale}/events/${event.slug}`}
                    className={`home-v3-stream-card ${index === 0 ? 'is-wide' : ''} ${index === 1 ? 'is-tall' : ''}`}
                  >
                    <div className="home-v3-stream-card-cover">
                      {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <CoverFallback title={event.title} />}
                    </div>
                    <div className="home-v3-stream-card-body">
                      <h3>{event.title}</h3>
                      <div className="home-meta-row">
                        <span>{formatPreviewDate(event.startsAt, locale)}</span>
                        <span>{event.location}</span>
                        <span>{event.category}</span>
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
    const response = await fetch(`${baseUrl}/api/events?limit=5`, {
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
