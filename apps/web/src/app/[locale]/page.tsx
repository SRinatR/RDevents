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

const FEATURE_ICONS = ['⚡', '📊', '🎭'];
const FEATURE_COLORS = ['indigo', 'purple', 'coral'] as const;

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations();
  const previewEvents = await getPreviewEvents();

  const featureKeys = ['fast', 'analytics', 'roles'] as const;
  const steps = [
    t('home.howItWorks.step1'),
    t('home.howItWorks.step2'),
    t('home.howItWorks.step3'),
  ];

  return (
    <div className="page-shell">
      <main className="page-main">

        {/* ── Hero ───────────────────────────────── */}
        <section className="hero">
          <div className="hero-bg" />
          <div className="container hero-content">

            <span className="hero-badge">
              <span className="hero-badge-dot">✦</span>
              {t('common.appName')} · MVP
            </span>

            <h1 className="hero-title">
              {t('home.heroTitle').split(' ').slice(0, -2).join(' ')}{' '}
              <span className="text-gradient">
                {t('home.heroTitle').split(' ').slice(-2).join(' ')}
              </span>
            </h1>

            <p className="hero-subtitle">{t('home.heroSubtitle')}</p>

            <div className="hero-actions">
              <Link href={`/${locale}/events`} className="btn btn-primary btn-lg">
                🎪 {t('home.exploreCta')}
              </Link>
              <Link href={`/${locale}/register`} className="btn btn-secondary btn-lg">
                {t('home.joinCta')} →
              </Link>
            </div>

            <div className="hero-stats">
              <div className="hero-stat">
                <span className="hero-stat-icon">🎪</span>
                <div>
                  <div className="hero-stat-value">10+</div>
                  <div className="hero-stat-label">
                    {locale === 'ru' ? 'стартовых событий' : 'starter events'}
                  </div>
                </div>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-icon">🔐</span>
                <div>
                  <div className="hero-stat-value">4</div>
                  <div className="hero-stat-label">
                    {locale === 'ru' ? 'способа входа' : 'auth methods'}
                  </div>
                </div>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-icon">📊</span>
                <div>
                  <div className="hero-stat-value">1</div>
                  <div className="hero-stat-label">
                    {locale === 'ru' ? 'панель управления' : 'admin panel'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ───────────────────────────── */}
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
                <article
                  key={key}
                  className="feature-card"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={`feature-icon-wrap ${FEATURE_COLORS[index]}`}>
                    {FEATURE_ICONS[index]}
                  </div>
                  <div className="feature-num">0{index + 1}</div>
                  <h3 className="feature-title">{t(`home.features.${key}.title`)}</h3>
                  <p className="feature-description">{t(`home.features.${key}.description`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Preview Events ──────────────────────── */}
        <section className="section" style={{ background: 'var(--color-bg-soft)', paddingTop: 64, paddingBottom: 64 }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h2 className="section-title">{t('home.popularTitle')}</h2>
                <p className="section-subtitle">
                  {locale === 'ru'
                    ? 'Подборка открытых событий из живого каталога.'
                    : 'A selection of open events from the live catalog.'}
                </p>
              </div>
              <Link href={`/${locale}/events`} className="btn btn-secondary">
                {locale === 'ru' ? 'Все события' : 'View all'} →
              </Link>
            </div>

            {previewEvents.length === 0 ? (
              <div className="empty-state" style={{ paddingTop: 40 }}>
                <div className="empty-state-icon">🎪</div>
                <p className="empty-state-text">
                  {locale === 'ru' ? 'События скоро появятся.' : 'Events will appear soon.'}
                </p>
              </div>
            ) : (
              <div className="cards-grid">
                {previewEvents.map((event) => (
                  <Link key={event.id} href={`/${locale}/events/${event.slug}`} className="event-card">
                    {event.coverImageUrl ? (
                      <img
                        src={event.coverImageUrl}
                        alt={event.title}
                        className="event-card-cover"
                      />
                    ) : (
                      <div className="event-card-cover-placeholder">🎪</div>
                    )}
                    <div className="event-card-body">
                      <div className="event-card-header">
                        <span className="badge badge-primary">{event.category}</span>
                      </div>
                      <h3 className="event-card-title">{event.title}</h3>
                      <div className="event-card-meta">
                        <span>📅 {formatPreviewDate(event.startsAt, locale)}</span>
                        <span>📍 {event.location}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── How It Works ───────────────────────── */}
        <section className="section">
          <div className="container">
            <h2 className="section-title">{t('home.howItWorksTitle')}</h2>
            <div className="cards-grid">
              {steps.map((step, index) => (
                <article
                  key={step}
                  className="feature-card"
                  style={{ animationDelay: `${index * 0.1}s`, textAlign: 'center' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: 'var(--radius-full)',
                      background: `linear-gradient(135deg, var(--color-primary), #a855f7)`,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                      fontWeight: 900,
                      boxShadow: 'var(--shadow-primary)',
                    }}>
                      {index + 1}
                    </div>
                  </div>
                  <h3 className="feature-title">
                    {locale === 'ru' ? `Шаг ${index + 1}` : `Step ${index + 1}`}
                  </h3>
                  <p className="feature-description">{step}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Banner ──────────────────────────── */}
        <section className="section-sm">
          <div className="container">
            <div style={{
              background: 'linear-gradient(135deg, var(--color-primary) 0%, #a855f7 100%)',
              borderRadius: 'var(--radius-3xl)',
              padding: '52px 40px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-primary-lg)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse 60% 50% at 80% 20%, rgba(255,255,255,0.12) 0%, transparent 60%)',
                pointerEvents: 'none',
              }} />
              <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 900, color: '#fff', marginBottom: 12, position: 'relative' }}>
                {locale === 'ru' ? 'Готовы начать?' : 'Ready to get started?'}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: '1.05rem', marginBottom: 28, position: 'relative' }}>
                {locale === 'ru'
                  ? 'Присоединяйтесь к платформе и создавайте незабываемые события.'
                  : 'Join the platform and create unforgettable events.'}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
                <Link href={`/${locale}/register`} className="btn btn-lg" style={{ background: '#fff', color: 'var(--color-primary)', fontWeight: 800 }}>
                  {t('home.joinCta')}
                </Link>
                <Link href={`/${locale}/events`} className="btn btn-lg" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }}>
                  {t('home.exploreCta')}
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--color-primary), #a855f7)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '0.75rem',
            }}>✦</span>
            <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>EventPlatform</span>
            <span>© 2026</span>
          </div>
          <div className="footer-links">
            <a href="#">{t('footer.product')}</a>
            <a href="#">{t('footer.company')}</a>
            <a href="#">{t('footer.support')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
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
