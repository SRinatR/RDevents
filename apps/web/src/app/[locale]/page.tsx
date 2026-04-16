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
    <div className="public-page-shell route-shell route-home route-home-v4">
      <main className="public-main home-v4-main">
        <section className="home-v4-hero motion-fade-up">
          <div className="home-v4-backdrop">
            {heroEvent?.coverImageUrl ? <img src={heroEvent.coverImageUrl} alt={heroEvent.title} /> : <div className="home-v4-backdrop-fallback" />}
            <div className="home-v4-backdrop-overlay" />
          </div>

          <div className="container-wide home-v4-hero-grid">
            <div className="home-v4-hero-copy">
              <span className="home-v4-kicker">{locale === 'ru' ? 'Event Experience Platform' : 'Event Experience Platform'}</span>
              <h1>
                {locale === 'ru'
                  ? 'Кинематографичная витрина событий с операционной точностью продукта.'
                  : 'A cinematic event front page with product-grade operational precision.'}
              </h1>
              <p>
                {locale === 'ru'
                  ? 'Сильный первый экран, брендовые страницы событий и управляемый цикл участия — в одной публичной системе, которую можно показывать инвесторам и командам роста.'
                  : 'A stronger first screen, branded event storytelling, and controlled participation flow in one public system you can confidently demo to investors and growth teams.'}
              </p>

              <div className="home-v4-hero-actions">
                <Link href={`/${locale}/events`} className="btn btn-primary">{locale === 'ru' ? 'Смотреть события' : 'Explore events'}</Link>
                <Link href={heroEvent ? `/${locale}/events/${heroEvent.slug}` : `/${locale}/events`} className="btn btn-secondary">
                  {locale === 'ru' ? 'Открыть главное событие' : 'Open featured event'}
                </Link>
                <Link href={`/${locale}/register`} className="btn btn-ghost">{locale === 'ru' ? 'Создать аккаунт' : 'Create account'}</Link>
              </div>

              <div className="home-v4-proof-strip">
                <article>
                  <small>{locale === 'ru' ? 'Каталог' : 'Catalog'}</small>
                  <strong>{previewEvents.length} {locale === 'ru' ? 'публичных слотов' : 'public slots'}</strong>
                </article>
                <article>
                  <small>{locale === 'ru' ? 'Форматы' : 'Formats'}</small>
                  <strong>{locale === 'ru' ? 'In-person · Virtual · Hybrid' : 'In-person · Virtual · Hybrid'}</strong>
                </article>
                <article>
                  <small>{locale === 'ru' ? 'Поток' : 'Flow'}</small>
                  <strong>{locale === 'ru' ? 'Discover → Apply → Operate' : 'Discover → Apply → Operate'}</strong>
                </article>
              </div>
            </div>

            <div className="home-v4-focal-panel">
              {heroEvent ? (
                <Link href={`/${locale}/events/${heroEvent.slug}`} className="home-v4-feature-card">
                  <small>{locale === 'ru' ? 'Featured event' : 'Featured event'}</small>
                  <h2>{heroEvent.title}</h2>
                  <p>
                    {heroEvent.shortDescription ||
                      (locale === 'ru'
                        ? 'Откройте карточку и запустите участие через полноценную публичную страницу события.'
                        : 'Open the destination and start participation through a premium public event page.')}
                  </p>
                  <div className="home-meta-row">
                    <span>{formatPreviewDate(heroEvent.startsAt, locale)}</span>
                    <span>{heroEvent.location}</span>
                    <span>{heroEvent.category}</span>
                  </div>
                </Link>
              ) : (
                <div className="home-v4-feature-card home-v4-feature-fallback">
                  <small>{locale === 'ru' ? 'Featured event' : 'Featured event'}</small>
                  <h2>{locale === 'ru' ? 'Следующее главное событие готовится к публикации' : 'The next flagship event is preparing for release'}</h2>
                  <p>
                    {locale === 'ru'
                      ? 'Пока в каталоге нет лидирующей позиции. Как только событие будет опубликовано, оно автоматически займет главный фокус этой сцены.'
                      : 'There is no leading slot in the catalog yet. Once a featured event is published, it will automatically take this dominant stage.'}
                  </p>
                  <Link href={`/${locale}/events`} className="signal-chip-link">{t('events.title')}</Link>
                </div>
              )}

              <div className="home-v4-focal-rail">
                <div>
                  <small>{locale === 'ru' ? 'Brand layer' : 'Brand layer'}</small>
                  <strong>{locale === 'ru' ? 'Премиальная публичная витрина' : 'Premium public storefront'}</strong>
                </div>
                <div>
                  <small>{locale === 'ru' ? 'Narrative' : 'Narrative'}</small>
                  <strong>{locale === 'ru' ? 'Сильный экран + понятный путь' : 'Bold screen + clear journey'}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="home-v4-story motion-fade-up-fast">
          <div className="container-wide home-v4-story-grid">
            <article>
              <small>01</small>
              <h3>{locale === 'ru' ? 'Открытие' : 'Discovery'}</h3>
              <p>{locale === 'ru' ? 'Пользователь получает выразительную первую точку входа и сразу понимает ценность событий.' : 'Visitors land into a high-intent first impression with immediate event value clarity.'}</p>
            </article>
            <article>
              <small>02</small>
              <h3>{locale === 'ru' ? 'Решение' : 'Decision'}</h3>
              <p>{locale === 'ru' ? 'Featured-секция задает доминирующий фокус и удерживает внимание на приоритетном запуске.' : 'The featured zone creates a dominant focal point and anchors attention on priority launches.'}</p>
            </article>
            <article>
              <small>03</small>
              <h3>{locale === 'ru' ? 'Действие' : 'Action'}</h3>
              <p>{locale === 'ru' ? 'Четкая иерархия CTA переводит в каталог, карточку события или регистрацию без лишних решений.' : 'Clear CTA hierarchy routes people to catalog, event destination, or account creation without friction.'}</p>
            </article>
          </div>
        </section>

        <section className="home-v4-stream motion-fade-up-fast">
          <div className="container-wide">
            <div className="home-v4-stream-head">
              <div>
                <h2>{locale === 'ru' ? 'Текущие события' : 'Current events'}</h2>
                <p>{locale === 'ru' ? 'Арт-дирекшн вместо однотипной сетки: разный масштаб карточек формирует запоминаемый ритм.' : 'Art-directed instead of uniform: varying card scale creates a memorable page rhythm.'}</p>
              </div>
              <Link href={`/${locale}/events`} className="signal-chip-link">{locale === 'ru' ? 'Перейти в каталог' : 'Go to catalog'}</Link>
            </div>

            {streamEvents.length === 0 ? (
              <div className="signal-empty-state home-v4-stream-empty">
                <h3>{locale === 'ru' ? 'Скоро появятся дополнительные события' : 'More events are coming soon'}</h3>
                <p>{locale === 'ru' ? 'Сейчас акцент на главной сцене. После публикации новых позиций блок автоматически развернётся в полную ленту.' : 'The stage currently highlights the flagship slot. As new events are published, this block expands into a full stream.'}</p>
              </div>
            ) : (
              <div className="home-v4-stream-layout motion-stagger">
                {streamEvents.map((event, index) => (
                  <Link
                    key={event.id}
                    href={`/${locale}/events/${event.slug}`}
                    className={`home-v4-stream-card ${index === 0 ? 'is-dominant' : ''} ${index === 2 ? 'is-tall' : ''}`}
                  >
                    <div className="home-v4-stream-card-cover">
                      {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <CoverFallback title={event.title} />}
                    </div>
                    <div className="home-v4-stream-card-body">
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
