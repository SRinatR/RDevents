import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

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
  const t = await getTranslations();
  const previewEvents = await getPreviewEvents();

  const featureKeys = ['fast', 'analytics', 'roles'] as const;
  const steps = [
    t('home.howItWorks.step1'),
    t('home.howItWorks.step2'),
    t('home.howItWorks.step3')
  ];

  return (
    <div className="page-shell">
      <main className="page-main">
        <section className="hero">
          <div className="container">
            <div className="hero-card">
              <span className="hero-badge">
                {t('common.appName')} • MVP
              </span>

              <h1 className="hero-title">
                {t('home.heroTitle').split(' ').slice(0, -2).join(' ')}{' '}
                <span className="text-gradient">
                  {t('home.heroTitle').split(' ').slice(-2).join(' ')}
                </span>
              </h1>

              <p className="hero-subtitle">{t('home.heroSubtitle')}</p>

              <div className="hero-actions">
                <Link
                  href={`/${locale}/events`}
                  style={primaryButtonStyle}
                >
                  {t('home.exploreCta')}
                </Link>

                <Link
                  href={`/${locale}/register`}
                  style={secondaryButtonStyle}
                >
                  {t('home.joinCta')}
                </Link>
              </div>

              <div className="hero-stats">
                <div className="hero-stat">
                  <span className="hero-stat-value">10+</span>
                  <span className="hero-stat-label">
                    {locale === 'ru' ? 'стартовых событий' : 'starter events'}
                  </span>
                </div>

                <div className="hero-stat">
                  <span className="hero-stat-value">4</span>
                  <span className="hero-stat-label">
                    {locale === 'ru' ? 'способа входа' : 'auth methods'}
                  </span>
                </div>

                <div className="hero-stat">
                  <span className="hero-stat-value">1</span>
                  <span className="hero-stat-label">
                    {locale === 'ru' ? 'панель управления' : 'admin control panel'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2 className="section-title">{t('home.featuresTitle')}</h2>
            <p className="section-subtitle">
              {locale === 'ru'
                ? 'Платформа объединяет публичный сайт, регистрацию, админку и аналитику в одном продукте.'
                : 'The platform combines a public website, registration flows, admin tools and analytics in one product.'}
            </p>

            <div className="cards-grid">
              {featureKeys.map((key, index) => (
                <article key={key} className="feature-card">
                  <span className="feature-icon">0{index + 1}</span>
                  <h3 className="feature-title">{t(`home.features.${key}.title`)}</h3>
                  <p className="feature-description">
                    {t(`home.features.${key}.description`)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2 className="section-title">{t('home.popularTitle')}</h2>
            <p className="section-subtitle">
              {locale === 'ru'
                ? 'Подборка открытых событий из живого каталога.'
                : 'A selection of open events from the live catalog.'}
            </p>

            {previewEvents.length === 0 ? (
              <p style={{ marginTop: 18, color: 'var(--color-text-muted)' }}>
                {locale === 'ru' ? 'События скоро появятся.' : 'Events will appear soon.'}
              </p>
            ) : (
              <div className="cards-grid">
                {previewEvents.map((event) => (
                  <Link key={event.id} href={`/${locale}/events/${event.slug}`} className="event-preview-card">
                    {event.coverImageUrl && (
                      <img
                        src={event.coverImageUrl}
                        alt={event.title}
                        style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 'var(--radius-lg)', marginBottom: 16 }}
                      />
                    )}
                    <span className="event-preview-badge">{event.category}</span>
                    <h3 className="event-preview-title">{event.title}</h3>
                    <div className="event-preview-meta">
                      <span>{formatPreviewDate(event.startsAt, locale)}</span>
                      <span>{event.location}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2 className="section-title">{t('home.howItWorksTitle')}</h2>
            <div className="cards-grid">
              {steps.map((step, index) => (
                <article key={step} className="step-card">
                  <span className="feature-icon">0{index + 1}</span>
                  <h3 className="step-title">
                    {locale === 'ru' ? `Шаг ${index + 1}` : `Step ${index + 1}`}
                  </h3>
                  <p className="step-description">{step}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <span>
            © 2026 {t('common.appName')}. {t('footer.rights')}
          </span>
          <span>
            {t('footer.product')} • {t('footer.company')} • {t('footer.support')}
          </span>
        </div>
      </footer>
    </div>
  );
}

async function getPreviewEvents(): Promise<PreviewEvent[]> {
  const baseUrl = process.env['API_INTERNAL_URL'] ?? process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:4000';

  try {
    const response = await fetch(`${baseUrl}/api/events?limit=3`, { next: { revalidate: 60 } });
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

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 50,
  padding: '0 20px',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--color-primary)',
  color: '#fff',
  fontWeight: 800,
  border: '1px solid transparent',
  boxShadow: 'var(--shadow-sm)'
};

const secondaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 50,
  padding: '0 20px',
  borderRadius: 'var(--radius-lg)',
  background: 'rgba(255,255,255,0.9)',
  color: 'var(--color-text-primary)',
  fontWeight: 800,
  border: '1px solid var(--color-border)',
  boxShadow: 'var(--shadow-sm)'
};
