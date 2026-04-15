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

  return (
    <div className="public-page-shell">
      <main className="public-main">
        <section className="public-hero">
          <div className="container public-hero-grid">
            <div>
              <span className="public-kicker">{locale === 'ru' ? 'Операционный стандарт мероприятий' : 'Operational-grade event platform'}</span>
              <h1>{locale === 'ru' ? 'Платформа для управляемых событий, команд и участия.' : 'A platform for managed events, teams, and participation.'}</h1>
              <p>
                {locale === 'ru'
                  ? 'Единый продукт для организаторов, участников и волонтёров: чёткая структура, прозрачные статусы, управляемые потоки регистрации.'
                  : 'A unified product for organizers, participants, and volunteers with clear structure, transparent statuses, and controlled registration flows.'}
              </p>
              <div className="public-hero-actions">
                <Link href={`/${locale}/events`} className="btn btn-primary">{t('events.title')}</Link>
                <Link href={`/${locale}/register`} className="btn btn-secondary">{locale === 'ru' ? 'Создать аккаунт' : 'Create account'}</Link>
              </div>
            </div>

            <aside className="public-hero-panel">
              <h3>{locale === 'ru' ? 'Платформа в цифрах' : 'Platform snapshot'}</h3>
              <div className="signal-stack">
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Предпросмотр событий' : 'Preview events'}</span><strong>{previewEvents.length}</strong></div>
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Модули' : 'Modules'}</span><strong>{locale === 'ru' ? 'События, команды, волонтёры' : 'Events, teams, volunteers'}</strong></div>
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Режим доступа' : 'Access model'}</span><strong>{locale === 'ru' ? 'Публичный + кабинет + админ' : 'Public + cabinet + admin'}</strong></div>
              </div>
            </aside>
          </div>
        </section>

        {leadEvent ? (
          <section className="public-featured-section">
            <div className="container">
              <div className="public-featured-card">
                <div className="public-featured-content">
                  <span className="signal-status-badge tone-info">{locale === 'ru' ? 'Рекомендуемое событие' : 'Featured event'}</span>
                  <h2>{leadEvent.title}</h2>
                  <p>{locale === 'ru' ? 'Ближайшее событие с открытой регистрацией и рабочей страницей участия.' : 'Nearest event with active registration and a complete participation flow.'}</p>
                  <div className="public-meta-row">
                    <span>{formatPreviewDate(leadEvent.startsAt, locale)}</span>
                    <span>{leadEvent.location}</span>
                    <span>{leadEvent.category}</span>
                  </div>
                  <Link href={`/${locale}/events/${leadEvent.slug}`} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Открыть событие' : 'Open event'}</Link>
                </div>
                <div className="public-featured-cover">
                  {leadEvent.coverImageUrl ? <img src={leadEvent.coverImageUrl} alt={leadEvent.title} /> : <CoverFallback title={leadEvent.title} />}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="public-section">
          <div className="container">
            <div className="public-section-head">
              <h2>{locale === 'ru' ? 'События' : 'Events'}</h2>
              <Link href={`/${locale}/events`} className="signal-chip-link">{locale === 'ru' ? 'Открыть каталог' : 'Open catalog'}</Link>
            </div>

            {previewEvents.length === 0 ? (
              <div className="signal-empty-state">
                <h3>{locale === 'ru' ? 'События появятся скоро' : 'Events will appear soon'}</h3>
                <p>{locale === 'ru' ? 'Каталог готов к публикации данных и отображает структурированное пустое состояние.' : 'Catalog is ready for published data and currently shows a structured empty state.'}</p>
              </div>
            ) : (
              <div className="public-events-grid">
                {previewEvents.map((event) => (
                  <Link key={event.id} href={`/${locale}/events/${event.slug}`} className="public-event-card">
                    <div className="public-event-cover">{event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <CoverFallback title={event.title} />}</div>
                    <div className="public-event-body">
                      <div className="public-meta-row"><span>{formatPreviewDate(event.startsAt, locale)}</span><span>{event.location}</span></div>
                      <h3>{event.title}</h3>
                      <span className="signal-status-badge tone-neutral">{event.category}</span>
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
