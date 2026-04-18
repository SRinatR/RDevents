import { access } from 'node:fs/promises';
import path from 'node:path';
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
  const heroImageSrc = await resolveHomeHeroImageSrc(heroEvent?.coverImageUrl ?? null);

  return (
    <div className="public-page-shell route-shell route-home route-home-v3">
      <main className="public-main home-v3-main">

        {/* Hero: catalog-first — primary action is browsing events */}
        <section className="home-v3-hero motion-fade-up">
          <div className="home-v3-hero-media">
            {heroImageSrc
              ? <img src={heroImageSrc} alt={heroEvent?.title ?? t('home.heroTitle')} />
              : <div className="home-v3-hero-fallback-art" />}
            <div className="home-v3-hero-overlay" />
          </div>

          <div className="container-wide home-v3-hero-inner">
            <div className="home-v3-hero-copy">
              <span className="home-v3-kicker">{t('home.heroKicker')}</span>
              <h1>{t('home.heroTitle')}</h1>
              <p>{t('home.heroSubtitle')}</p>
              <div className="home-v3-hero-actions">
                <Link href={`/${locale}/events`} className="btn btn-primary">
                  {t('home.exploreCta')}
                </Link>
                <Link href={`/${locale}/register`} className="btn btn-secondary">
                  {t('home.joinCta')}
                </Link>
              </div>
            </div>

            <div className="home-v3-hero-dock">
              {heroEvent ? (
                <Link href={`/${locale}/events/${heroEvent.slug}`} className="home-v3-hero-dock-card">
                  <small>{t('home.featuredLabel')}</small>
                  <h2>{heroEvent.title}</h2>
                  <p>
                    {heroEvent.shortDescription
                      || t('home.featuredFallbackDesc')}
                  </p>
                  <div className="home-meta-row">
                    <span>{formatPreviewDate(heroEvent.startsAt, locale)}</span>
                    <span>{heroEvent.location}</span>
                    <span>{heroEvent.category}</span>
                  </div>
                </Link>
              ) : (
                <div className="home-v3-hero-dock-card home-v3-hero-dock-fallback">
                  <small>{t('home.featuredLabel')}</small>
                  <h2>{t('home.featuredFallbackTitle')}</h2>
                  <p>{t('home.featuredFallbackDesc')}</p>
                  <Link href={`/${locale}/events`} className="signal-chip-link">
                    {t('events.title')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Event stream: upcoming events catalog preview */}
        <section className="home-v3-stream motion-fade-up-fast">
          <div className="container-wide">
            <div className="home-v3-stream-head">
              <div>
                <h2>{t('home.upcomingTitle')}</h2>
                <p>{t('home.upcomingSubtitle')}</p>
              </div>
              <Link href={`/${locale}/events`} className="signal-chip-link">
                {t('home.viewFullCatalog')}
              </Link>
            </div>

            {streamEvents.length === 0 ? (
              <div className="signal-empty-state">
                <h3>{t('home.streamEmptyTitle')}</h3>
                <p>{t('home.streamEmptyDesc')}</p>
                <div className="signal-empty-actions">
                  <Link href={`/${locale}/events`} className="signal-chip-link">
                    {t('events.title')}
                  </Link>
                </div>
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
                      {event.coverImageUrl
                        ? <img src={event.coverImageUrl} alt={event.title} />
                        : <CoverFallback title={event.title} />}
                    </div>
                    <div className="home-v3-stream-card-body">
                      <h3>{event.title}</h3>
                      {index === 0 && event.shortDescription && (
                        <p className="home-v3-stream-card-desc">{event.shortDescription}</p>
                      )}
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

        {/* How to start: 3 real steps backed by existing functionality */}
        <section className="home-v3-steps motion-fade-up-fast">
          <div className="container-wide">
            <h2 className="home-v3-steps-title">{t('home.howItWorksTitle')}</h2>
            <div className="home-v3-steps-grid">
              <div className="home-v3-step-card">
                <span className="home-v3-step-num">01</span>
                <strong>{t('home.howItWorks.step1')}</strong>
              </div>
              <div className="home-v3-step-card">
                <span className="home-v3-step-num">02</span>
                <strong>{t('home.howItWorks.step2')}</strong>
              </div>
              <div className="home-v3-step-card">
                <span className="home-v3-step-num">03</span>
                <strong>{t('home.howItWorks.step3')}</strong>
              </div>
            </div>
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


const HOME_HERO_LOCAL_IMAGE_PUBLIC_PATH = '/images/home-hero-russian-house.jpg';

async function resolveHomeHeroImageSrc(fallbackImageUrl: string | null) {
  const localHeroFilePath = path.join(process.cwd(), 'public', 'images', 'home-hero-russian-house.jpg');

  try {
    await access(localHeroFilePath);
    return HOME_HERO_LOCAL_IMAGE_PUBLIC_PATH;
  } catch {
    return fallbackImageUrl;
  }
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
