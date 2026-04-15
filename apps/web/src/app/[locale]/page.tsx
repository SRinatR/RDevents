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
  const sideEvent = previewEvents[1];
  const tailEvents = previewEvents.slice(2);

  return (
    <div className="public-page-shell route-shell route-home route-home-rebuilt">
      <main className="public-main home-main-rebuilt">
        <section className="home-cinematic-hero motion-fade-up">
          <div className="container">
            <div className="home-hero-canvas">
              <div className="home-dominant-stage">
                <span className="home-stage-kicker">{locale === 'ru' ? 'Event operations suite' : 'Event operations suite'}</span>
                <h1>
                  {locale === 'ru'
                    ? 'Публичная витрина, где каждое событие ощущается как релиз продукта.'
                    : 'A public destination where every event feels like a product release.'}
                </h1>
                <p>
                  {locale === 'ru'
                    ? 'Сильная подача, управляемая регистрация и понятный переход в рабочие сценарии — без перегруженного интерфейса и случайной структуры.'
                    : 'Stronger storytelling, controlled registration, and a clean transition into operational flows without noisy, template-like layout.'}
                </p>

                <div className="home-stage-actions">
                  <Link href={`/${locale}/events`} className="btn btn-primary">{locale === 'ru' ? 'Смотреть каталог' : 'Browse events'}</Link>
                  <Link href={`/${locale}/register`} className="btn btn-secondary">{locale === 'ru' ? 'Создать аккаунт' : 'Create account'}</Link>
                  <Link href={leadEvent ? `/${locale}/events/${leadEvent.slug}` : `/${locale}/events`} className="btn btn-ghost">
                    {locale === 'ru' ? 'Открыть ближайшее событие' : 'Open nearest event'}
                  </Link>
                </div>

                <div className="home-stage-strip">
                  <div>
                    <small>{locale === 'ru' ? 'Витрина' : 'Public surface'}</small>
                    <strong>{locale === 'ru' ? 'Каталог с фокусом' : 'Focused catalog'}</strong>
                  </div>
                  <div>
                    <small>{locale === 'ru' ? 'Участие' : 'Participation'}</small>
                    <strong>{locale === 'ru' ? 'Соло и команды' : 'Solo and teams'}</strong>
                  </div>
                  <div>
                    <small>{locale === 'ru' ? 'Темп' : 'Cadence'}</small>
                    <strong>{previewEvents.length} {locale === 'ru' ? 'активных слотов' : 'active slots'}</strong>
                  </div>
                </div>
              </div>

              <aside className="home-support-rail">
                {leadEvent ? (
                  <Link href={`/${locale}/events/${leadEvent.slug}`} className="home-rail-primary">
                    <div className="home-rail-cover">
                      {leadEvent.coverImageUrl ? <img src={leadEvent.coverImageUrl} alt={leadEvent.title} /> : <CoverFallback title={leadEvent.title} />}
                    </div>
                    <div className="home-rail-body">
                      <span>{locale === 'ru' ? 'Ближайший запуск' : 'Nearest launch'}</span>
                      <h2>{leadEvent.title}</h2>
                      <div className="home-meta-row">
                        <span>{formatPreviewDate(leadEvent.startsAt, locale)}</span>
                        <span>{leadEvent.location}</span>
                        <span>{leadEvent.category}</span>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="home-rail-primary home-rail-fallback">
                    <div className="home-fallback-orbit" />
                    <h2>{locale === 'ru' ? 'Сцена подготовки открыта' : 'The launch stage is open'}</h2>
                    <p>
                      {locale === 'ru'
                        ? 'Новые события публикуются после модерации. Откройте каталог и следите за стартом регистрации.'
                        : 'New events appear after moderation. Open the catalog to monitor upcoming registrations.'}
                    </p>
                    <Link href={`/${locale}/events`} className="signal-chip-link">{t('events.title')}</Link>
                  </div>
                )}

                <div className="home-rail-stack">
                  <article>
                    <small>{locale === 'ru' ? 'Операционный контур' : 'Operations loop'}</small>
                    <strong>{locale === 'ru' ? 'Discovery → Join → Execute' : 'Discovery → Join → Execute'}</strong>
                  </article>
                  <article>
                    <small>{locale === 'ru' ? 'Архитектура роли' : 'Role architecture'}</small>
                    <strong>{locale === 'ru' ? 'Участник / Команда / Волонтёр' : 'Participant / Team / Volunteer'}</strong>
                  </article>
                  {sideEvent ? (
                    <Link href={`/${locale}/events/${sideEvent.slug}`} className="home-side-event-link">
                      <small>{locale === 'ru' ? 'Следующий в очереди' : 'Next in queue'}</small>
                      <strong>{sideEvent.title}</strong>
                    </Link>
                  ) : null}
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="home-section home-section-rebuilt home-event-flow motion-fade-up-fast">
          <div className="container">
            <div className="home-flow-grid motion-stagger">
              <article>
                <h3>{locale === 'ru' ? 'Открыть каталог' : 'Open catalog'}</h3>
                <p>{locale === 'ru' ? 'Быстрая навигация по событиям, где важные слоты выделены масштабом и ритмом.' : 'Browse events through a stronger hierarchy where important slots lead visually.'}</p>
              </article>
              <article>
                <h3>{locale === 'ru' ? 'Подать участие' : 'Apply to participate'}</h3>
                <p>{locale === 'ru' ? 'Понятный вход в соло/командные сценарии и прозрачный статус регистрации.' : 'Clear entry into solo/team scenarios with transparent registration states.'}</p>
              </article>
              <article>
                <h3>{locale === 'ru' ? 'Управлять исполнением' : 'Run execution'}</h3>
                <p>{locale === 'ru' ? 'Переход в кабинет поддерживает реальный рабочий цикл, а не декоративный UI.' : 'Transition into workspace supports a real operating loop, not decorative UI.'}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="home-section home-section-rebuilt home-catalog-showcase motion-fade-up-fast">
          <div className="container">
            <div className="home-section-head home-section-head-wide">
              <div>
                <h2>{locale === 'ru' ? 'Живой каталог событий' : 'Live event catalog'}</h2>
                <p>{locale === 'ru' ? 'Первые позиции получают больший вес, остальные поддерживают ритм ленты.' : 'Top entries carry stronger visual weight while the rest build a curated rhythm.'}</p>
              </div>
              <Link href={`/${locale}/events`} className="signal-chip-link">{locale === 'ru' ? 'Открыть все события' : 'Open all events'}</Link>
            </div>

            {previewEvents.length === 0 ? (
              <div className="signal-empty-state">
                <h3>{locale === 'ru' ? 'События появятся скоро' : 'Events will appear soon'}</h3>
                <p>{locale === 'ru' ? 'Пока активных публикаций нет. Каталог обновится после следующего релиза.' : 'No active publications yet. The catalog updates on the next release cycle.'}</p>
              </div>
            ) : (
              <div className="home-showcase-grid motion-stagger">
                <Link href={`/${locale}/events/${leadEvent ? leadEvent.slug : ''}`} className="home-showcase-lead">
                  <div className="home-showcase-cover">
                    {leadEvent?.coverImageUrl ? <img src={leadEvent.coverImageUrl} alt={leadEvent.title} /> : <CoverFallback title={leadEvent?.title ?? 'EP'} />}
                  </div>
                  <div className="home-showcase-copy">
                    <h3>{leadEvent?.title}</h3>
                    <div className="home-meta-row">
                      <span>{leadEvent ? formatPreviewDate(leadEvent.startsAt, locale) : ''}</span>
                      <span>{leadEvent?.location}</span>
                      <span>{leadEvent?.category}</span>
                    </div>
                  </div>
                </Link>

                <div className="home-showcase-stack">
                  {(sideEvent ? [sideEvent, ...tailEvents] : tailEvents).map((event) => (
                    <Link key={event.id} href={`/${locale}/events/${event.slug}`} className="home-showcase-item">
                      <div className="home-showcase-item-cover">
                        {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <CoverFallback title={event.title} />}
                      </div>
                      <div>
                        <h4>{event.title}</h4>
                        <div className="home-meta-row">
                          <span>{formatPreviewDate(event.startsAt, locale)}</span>
                          <span>{event.location}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
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
    const response = await fetch(`${baseUrl}/api/events?limit=4`, {
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
