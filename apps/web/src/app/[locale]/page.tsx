import { access } from 'node:fs/promises';
import path from 'node:path';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PublicFooter } from '../../components/layout/PublicFooter';
import { MediaPreview } from '@/components/media/MediaPreview';
import { formatMediaDisplayNumber } from '@/components/media/MediaCard';

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

type HomeMediaHighlight = {
  id: string;
  kind: 'image' | 'video';
  title?: string | null;
  caption?: string | null;
  credit?: string | null;
  approvedAt?: string | null;
  asset: {
    publicUrl: string;
    storageKey?: string | null;
    originalFilename: string;
  };
  displayNumber?: number | null;
  event?: {
    slug: string;
    title: string;
    startsAt?: string | null;
  };
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const [previewEvents, mediaHighlights] = await Promise.all([
    getPreviewEvents(),
    getMediaHighlights(),
  ]);
  const t = await getTranslations();
  const heroEvent = previewEvents[0] ?? null;
  const hasSinglePreviewEvent = previewEvents.length === 1;
  const streamEvents = hasSinglePreviewEvent ? [previewEvents[0]] : previewEvents.slice(1, 5);
  const streamSingleEvent = hasSinglePreviewEvent ? previewEvents[0] : null;
  const heroImageSrc = await resolveHomeHeroImageSrc(heroEvent?.coverImageUrl ?? null);

  return (
    <div className="public-page-shell route-shell route-home route-home-v3">
      <main className="public-main home-landing-main">
        <section className="home-landing-stage motion-fade-up">
          <div className="home-landing-backdrop">
            {heroImageSrc
              ? <Image src={heroImageSrc} alt={heroEvent?.title ?? t('home.heroTitle')} fill sizes="100vw" priority style={{ objectFit: 'cover' }} />
              : <div className="home-v3-hero-fallback-art" />}
          </div>
          <div className="home-landing-backdrop-noise" />

          <div className="home-landing-stage-shell">
            <div className="container-wide home-landing-inner">
              <div className="home-landing-copy">
                <span className="home-landing-kicker">{t('home.heroKicker')}</span>
                <h1>{t('home.heroTitle')}</h1>
                <p>{t('home.heroSubtitle')}</p>
                <div className="home-landing-actions">
                  <Link href={`/${locale}/events`} className="btn btn-primary">
                    {t('home.exploreCta')}
                  </Link>
                  <Link href={`/${locale}/register`} className="btn btn-secondary">
                    {t('home.joinCta')}
                  </Link>
                </div>
              </div>

              <div className="home-landing-feature">
                {heroEvent ? (
                  <Link href={`/${locale}/events/${heroEvent.slug}`} className="home-landing-feature-card">
                    <div className="home-landing-feature-head">
                      <small>{t('home.featuredLabel')}</small>
                      <h2>{heroEvent.title}</h2>
                    </div>
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
                  <div className="home-landing-feature-card home-landing-feature-fallback">
                    <div className="home-landing-feature-head">
                      <small>{t('home.featuredLabel')}</small>
                      <h2>{t('home.featuredFallbackTitle')}</h2>
                    </div>
                    <p>{t('home.featuredFallbackDesc')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="home-events-stage motion-fade-up-fast">
          <div className="container-wide home-events-stage-inner">
            <div className="home-events-shell">
              <div className="home-events-head">
                <div>
                  <h2>{t('home.upcomingTitle')}</h2>
                  <p>{t('home.upcomingSubtitle')}</p>
                </div>
                <Link href={`/${locale}/events`} className="signal-chip-link">
                  {t('home.viewFullCatalog')}
                </Link>
              </div>

              {streamSingleEvent ? (
                <div className="home-events-single-showcase motion-stagger">
                  <Link
                    href={`/${locale}/events/${streamSingleEvent.slug}`}
                    className="home-v3-stream-card home-events-single-card"
                  >
                    <div className="home-v3-stream-card-cover">
                      {streamSingleEvent.coverImageUrl
                        ? <Image src={streamSingleEvent.coverImageUrl} alt={streamSingleEvent.title} fill sizes="(max-width: 768px) 100vw, 600px" style={{ objectFit: 'cover' }} />
                        : <CoverFallback title={streamSingleEvent.title} />}
                    </div>
                    <div className="home-v3-stream-card-body">
                      <h3>{streamSingleEvent.title}</h3>
                      {streamSingleEvent.shortDescription && (
                        <p className="home-v3-stream-card-desc">{streamSingleEvent.shortDescription}</p>
                      )}
                      <div className="home-meta-row">
                        <span>{formatPreviewDate(streamSingleEvent.startsAt, locale)}</span>
                        <span>{streamSingleEvent.location}</span>
                        <span>{streamSingleEvent.category}</span>
                      </div>
                    </div>
                  </Link>
                </div>
              ) : streamEvents.length === 0 ? (
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
                <div className="home-v3-stream-layout home-events-grid motion-stagger">
                  {streamEvents.map((event, index) => (
                    <Link
                      key={event.id}
                      href={`/${locale}/events/${event.slug}`}
                      className={`home-v3-stream-card ${index === 0 ? 'is-wide' : ''} ${index === 1 ? 'is-tall' : ''}`}
                    >
                      <div className="home-v3-stream-card-cover">
                        {event.coverImageUrl
                          ? <Image src={event.coverImageUrl} alt={event.title} fill sizes="(max-width: 768px) 100vw, 400px" style={{ objectFit: 'cover' }} />
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
          </div>
        </section>

        <section className="home-media-stage motion-fade-up-fast">
          <div className="container-wide home-media-shell">
            <div className="home-events-head">
              <div>
                <h2>{locale === 'ru' ? 'Медиабанк мероприятий' : 'Event media bank'}</h2>
                <p>{locale === 'ru' ? 'Последние утверждённые фото и видео с событий' : 'Latest approved photos and videos from events'}</p>
              </div>
              <Link href={`/${locale}/media`} className="signal-chip-link">
                {locale === 'ru' ? 'Открыть фотобанк' : 'Open media bank'}
              </Link>
            </div>

            {mediaHighlights.length ? (
              <div className="home-media-grid">
                {mediaHighlights.map((item) => (
                  <Link
                    key={item.id}
                    href={item.event?.slug ? `/${locale}/events/${item.event.slug}/media` : `/${locale}/media`}
                    className="home-media-card"
                  >
                    <div className="home-media-cover">
                      <MediaPreview
                        publicUrl={item.asset.publicUrl}
                        storageKey={item.asset.storageKey}
                        kind={item.kind}
                        alt={item.title || item.caption || item.asset.originalFilename}
                        sizes="(max-width: 768px) 100vw, 320px"
                        controls={false}
                      />
                      <span>{formatMediaDisplayNumber(item, locale)}</span>
                    </div>
                    <div className="home-media-body">
                      <strong>{item.event?.title ?? (locale === 'ru' ? 'Событие' : 'Event')}</strong>
                      {item.caption || item.title ? <p>{item.caption || item.title}</p> : null}
                      <small>{locale === 'ru' ? 'Открыть фотобанк' : 'Open media bank'}</small>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="signal-empty-state">
                <h3>{locale === 'ru' ? 'Медиабанк скоро появится' : 'Media bank is coming soon'}</h3>
                <p>{locale === 'ru' ? 'После модерации здесь появятся материалы мероприятий.' : 'Approved event media will appear here after moderation.'}</p>
              </div>
            )}
          </div>
        </section>

        <section className="home-journey-stage motion-fade-up-fast">
          <div className="container-wide home-journey-shell">
            <div className="home-journey-head">
              <h2>{t('home.howItWorksTitle')}</h2>
              <p>{t('home.howItWorksSubtitle')}</p>
            </div>
            <div className="home-journey-grid">
              <div className="home-journey-card">
                <h3>{t('home.howItWorks.step1Title')}</h3>
                <p>{t('home.howItWorks.step1Text')}</p>
              </div>
              <div className="home-journey-card">
                <h3>{t('home.howItWorks.step2Title')}</h3>
                <p>{t('home.howItWorks.step2Text')}</p>
              </div>
              <div className="home-journey-card">
                <h3>{t('home.howItWorks.step3Title')}</h3>
                <p>{t('home.howItWorks.step3Text')}</p>
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


const HOME_HERO_LOCAL_IMAGE_PUBLIC_PATH = '/home-hero-russian-house.jpg';

async function resolveHomeHeroImageSrc(fallbackImageUrl: string | null) {
  const localHeroFilePath = path.join(process.cwd(), 'public', 'home-hero-russian-house.jpg');

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

async function getMediaHighlights(): Promise<HomeMediaHighlight[]> {
  const baseUrl =
    process.env['API_INTERNAL_URL'] ??
    process.env['NEXT_PUBLIC_API_BASE_URL'] ??
    'http://localhost:4000';

  try {
    const response = await fetch(`${baseUrl}/api/events/media/highlights?limit=8`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload.media) ? payload.media : [];
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
