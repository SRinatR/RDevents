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
  const spotlightEvents = previewEvents.slice(1, 4);

  return (
    <div className="public-page-shell route-shell route-home route-home-v6">
      <main className="public-main home-v6-main">
        <section className="home-v6-stage motion-fade-up">
          <div className="home-v6-media-layer">
            {heroEvent?.coverImageUrl ? <img src={heroEvent.coverImageUrl} alt={heroEvent.title} /> : <div className="home-v6-media-fallback" />}
            <div className="home-v6-media-overlay" />
          </div>

          <div className="container-wide home-v6-stage-inner">
            <div className="home-v6-marquee">
              <span>{locale === 'ru' ? 'Event Experience Platform' : 'Event Experience Platform'}</span>
              <span>{locale === 'ru' ? 'Discover · Register · Operate' : 'Discover · Register · Operate'}</span>
              <span>{previewEvents.length} {locale === 'ru' ? 'публичных событий' : 'public events'}</span>
            </div>

            <div className="home-v6-silhouette">
              <article className="home-v6-intro">
                <h1>
                  {locale === 'ru'
                    ? 'Продуктовый уровень управления событиями в формате сильной публичной сцены.'
                    : 'Product-grade event operations presented as a high-impact public stage.'}
                </h1>
                <p>
                  {locale === 'ru'
                    ? 'Одна цельная система для открытия событий, регистрации и действий участия — достаточно сильная для инвесторского демо и запуска командного роста.'
                    : 'One coherent system for event discovery, registration, and participation actions—confident enough for investor demos and growth operations.'}
                </p>
                <div className="home-v6-cta-row">
                  <Link href={`/${locale}/events`} className="btn btn-primary">{locale === 'ru' ? 'Открыть каталог' : 'Open catalog'}</Link>
                  <Link href={`/${locale}/register`} className="btn btn-secondary">{locale === 'ru' ? 'Создать аккаунт' : 'Create account'}</Link>
                  <Link href={heroEvent ? `/${locale}/events/${heroEvent.slug}` : `/${locale}/events`} className="btn btn-ghost">{locale === 'ru' ? 'Главное событие' : 'Flagship event'}</Link>
                </div>
              </article>

              <article className="home-v6-flagship">
                {heroEvent ? (
                  <>
                    <small>{locale === 'ru' ? 'Флагман запуска' : 'Launch flagship'}</small>
                    <h2>{heroEvent.title}</h2>
                    <p>{heroEvent.shortDescription || (locale === 'ru' ? 'Откройте карточку события для участия, требований и полной программы.' : 'Open the event destination for participation flow, requirements, and full story.')}</p>
                    <div className="home-meta-row">
                      <span>{formatPreviewDate(heroEvent.startsAt, locale)}</span>
                      <span>{heroEvent.location}</span>
                      <span>{heroEvent.category}</span>
                    </div>
                    <Link href={`/${locale}/events/${heroEvent.slug}`} className="signal-chip-link">{locale === 'ru' ? 'Перейти к событию' : 'Open event destination'}</Link>
                  </>
                ) : (
                  <>
                    <small>{locale === 'ru' ? 'Флагман запуска' : 'Launch flagship'}</small>
                    <h2>{locale === 'ru' ? 'Следующий релиз события готовится к публикации' : 'The next event release is preparing for publication'}</h2>
                    <p>{locale === 'ru' ? 'Как только новое приоритетное событие будет опубликовано, эта позиция автоматически станет главным фокусом страницы.' : 'Once a new priority event is published, this panel automatically becomes the primary page focus.'}</p>
                    <Link href={`/${locale}/events`} className="signal-chip-link">{t('events.title')}</Link>
                  </>
                )}
              </article>

              <div className="home-v6-command-strip">
                <div>
                  <small>{locale === 'ru' ? 'Сценарий' : 'Flow'}</small>
                  <strong>{locale === 'ru' ? 'Открытие → Заявка → Участие' : 'Discovery → Application → Participation'}</strong>
                </div>
                <div>
                  <small>{locale === 'ru' ? 'Форматы' : 'Formats'}</small>
                  <strong>{locale === 'ru' ? 'Индивидуально и командно' : 'Individual and team entry'}</strong>
                </div>
                <div>
                  <small>{locale === 'ru' ? 'Визуальный контур' : 'Presentation layer'}</small>
                  <strong>{locale === 'ru' ? 'Премиальная продуктовая сцена' : 'Premium product-stage delivery'}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="home-v6-spotlights motion-fade-up-fast">
          <div className="container-wide">
            <div className="home-v6-spotlights-head">
              <h2>{locale === 'ru' ? 'Текущие направления' : 'Current directions'}</h2>
              <Link href={`/${locale}/events`} className="signal-chip-link">{locale === 'ru' ? 'Весь каталог' : 'Full catalog'}</Link>
            </div>

            {spotlightEvents.length === 0 ? (
              <div className="signal-empty-state">
                <h3>{locale === 'ru' ? 'Новые направления появятся скоро' : 'New directions will appear soon'}</h3>
                <p>{locale === 'ru' ? 'Сейчас акцент на флагманском запуске. После публикации новых событий секция автоматически расширится.' : 'The current focus is on the flagship launch. This section expands automatically as events are published.'}</p>
              </div>
            ) : (
              <div className="home-v6-spotlights-grid motion-stagger">
                {spotlightEvents.map((event, index) => (
                  <Link key={event.id} href={`/${locale}/events/${event.slug}`} className={`home-v6-spotlight-card c-${index + 1}`}>
                    <div className="home-v6-spotlight-cover">
                      {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <CoverFallback title={event.title} />}
                    </div>
                    <div className="home-v6-spotlight-body">
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
