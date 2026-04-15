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
    <div className="public-page-shell route-shell route-home">
      <main className="public-main">
        <section className="home-hero motion-fade-up">
          <div className="container">
            <div className="home-hero-layout">
              <div className="home-hero-story">
                <span className="home-kicker">{locale === 'ru' ? 'Операционная платформа мероприятий' : 'Event operations platform'}</span>
                <h1 className="home-hero-title">
                  {locale === 'ru'
                    ? 'Проводите события как единый продукт: витрина, кабинет, команды, админ-контроль.'
                    : 'Run events as one product: showcase, workspace, teams, and admin control.'}
                </h1>
                <p className="home-hero-lead">
                  {locale === 'ru'
                    ? 'От первого знакомства с событием до управляемой регистрации и аналитики. Структурированные сценарии участия без хаоса в инструментах.'
                    : 'From first event discovery to controlled registration and analytics. Structured participation workflows without tool chaos.'}
                </p>

                <div className="home-hero-actions">
                  <Link href={`/${locale}/events`} className="btn btn-primary">{t('events.title')}</Link>
                  <Link href={`/${locale}/register`} className="btn btn-secondary">{locale === 'ru' ? 'Создать аккаунт' : 'Create account'}</Link>
                  <Link href={leadEvent ? `/${locale}/events/${leadEvent.slug}` : `/${locale}/events`} className="btn btn-ghost">
                    {locale === 'ru' ? 'Смотреть фокус-событие' : 'View focus event'}
                  </Link>
                </div>

                <div className="home-intent-row">
                  <Link href={`/${locale}/events`} className="home-intent-chip">{locale === 'ru' ? 'Найти событие' : 'Find an event'}</Link>
                  <Link href={`/${locale}/cabinet`} className="home-intent-chip">{locale === 'ru' ? 'Мой кабинет' : 'My workspace'}</Link>
                  <Link href={`/${locale}/admin`} className="home-intent-chip">{locale === 'ru' ? 'Открыть контроль' : 'Open control center'}</Link>
                </div>
              </div>

              <aside className="home-hero-focus">
                <div className="home-hero-focus-head">
                  <small>{locale === 'ru' ? 'Сейчас в фокусе' : 'Now in focus'}</small>
                  <span>{locale === 'ru' ? `${previewEvents.length} события в обзоре` : `${previewEvents.length} events in preview`}</span>
                </div>
                <Link href={leadEvent ? `/${locale}/events/${leadEvent.slug}` : `/${locale}/events`} className="home-focal-event">
                  <div className="home-focal-cover">
                    {leadEvent?.coverImageUrl ? <img src={leadEvent.coverImageUrl} alt={leadEvent.title} /> : <CoverFallback title={leadEvent?.title ?? 'EP'} />}
                  </div>
                  <div className="home-focal-body">
                    <h2>{leadEvent?.title ?? (locale === 'ru' ? 'Каталог обновляется' : 'Catalog is updating')}</h2>
                    <p>{locale === 'ru' ? 'Кинематографичная карточка ключевого события с прямым переходом в детали.' : 'Cinematic highlight card with direct path to event details.'}</p>
                    {leadEvent ? (
                      <div className="home-meta-row">
                        <span>{formatPreviewDate(leadEvent.startsAt, locale)}</span>
                        <span>{leadEvent.location}</span>
                        <span>{leadEvent.category}</span>
                      </div>
                    ) : null}
                  </div>
                </Link>
                <div className="home-proof-strip">
                  <div><small>{locale === 'ru' ? 'Слои продукта' : 'Product layers'}</small><strong>Public / Workspace / Admin</strong></div>
                  <div><small>{locale === 'ru' ? 'Сценарий участия' : 'Participation model'}</small><strong>{locale === 'ru' ? 'Соло · Команды · Волонтёры' : 'Solo · Teams · Volunteers'}</strong></div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="home-section home-discovery motion-fade-up-fast">
          <div className="container">
            <div className="home-section-head">
              <h2>{locale === 'ru' ? 'Выберите путь входа' : 'Choose your entry path'}</h2>
              <p>{locale === 'ru' ? 'Три роли, один продуктовый контур и связанная логика данных.' : 'Three roles, one product surface, and connected data logic.'}</p>
            </div>
            <div className="home-intent-grid motion-stagger">
              <article className="home-intent-card">
                <h3>{locale === 'ru' ? 'Участнику' : 'For participants'}</h3>
                <p>{locale === 'ru' ? 'Найдите событие, подайте заявку, управляйте участием в кабинете.' : 'Find events, submit applications, and manage participation in workspace.'}</p>
                <Link href={`/${locale}/events`} className="signal-chip-link">{locale === 'ru' ? 'Открыть каталог' : 'Open catalog'}</Link>
              </article>
              <article className="home-intent-card">
                <h3>{locale === 'ru' ? 'Организатору' : 'For organizers'}</h3>
                <p>{locale === 'ru' ? 'Запускайте события и управляйте регистрацией с контролем статусов.' : 'Launch events and control registration flows with clear statuses.'}</p>
                <Link href={`/${locale}/admin/events/new`} className="signal-chip-link">{locale === 'ru' ? 'Создать событие' : 'Create event'}</Link>
              </article>
              <article className="home-intent-card">
                <h3>{locale === 'ru' ? 'Операционной команде' : 'For operations teams'}</h3>
                <p>{locale === 'ru' ? 'Контролируйте качество процесса через аналитические и админ-разделы.' : 'Control execution quality through analytics and admin sections.'}</p>
                <Link href={`/${locale}/admin`} className="signal-chip-link">{locale === 'ru' ? 'Открыть админ-панель' : 'Open admin panel'}</Link>
              </article>
            </div>
          </div>
        </section>

        {leadEvent ? (
          <section className="home-section home-featured motion-fade-up-fast">
            <div className="container">
              <div className="home-featured-layout">
                <article className="home-featured-main">
                  <div className="home-featured-copy">
                    <span className="signal-status-badge tone-info">{locale === 'ru' ? 'Фокус-событие недели' : 'Focus event of the week'}</span>
                    <h2>{leadEvent.title}</h2>
                    <p>{locale === 'ru' ? 'Сильная точка входа: событие с открытой регистрацией и полным контуром участия.' : 'Strong entry point: an event with open registration and a complete participation flow.'}</p>
                    <div className="home-meta-row">
                      <span>{formatPreviewDate(leadEvent.startsAt, locale)}</span>
                      <span>{leadEvent.location}</span>
                      <span>{leadEvent.category}</span>
                    </div>
                    <div className="home-featured-actions">
                      <Link href={`/${locale}/events/${leadEvent.slug}`} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Открыть событие' : 'Open event'}</Link>
                      <Link href={`/${locale}/events`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Смотреть весь каталог' : 'Browse catalog'}</Link>
                    </div>
                  </div>
                  <div className="home-featured-cover">
                    {leadEvent.coverImageUrl ? <img src={leadEvent.coverImageUrl} alt={leadEvent.title} /> : <CoverFallback title={leadEvent.title} />}
                  </div>
                </article>
                <div className="home-story-stack">
                  <article className="home-story-card">
                    <h3>{locale === 'ru' ? 'Планирование → запуск' : 'Planning → launch'}</h3>
                    <p>{locale === 'ru' ? 'Сценарии регистрации и ролей задаются до старта и исполняются без ручной фрагментации.' : 'Registration and role scenarios are designed upfront and executed without manual fragmentation.'}</p>
                  </article>
                  <article className="home-story-card">
                    <h3>{locale === 'ru' ? 'Участие → контроль' : 'Participation → control'}</h3>
                    <p>{locale === 'ru' ? 'Кабинет и админ работают в одной модели данных: меньше дублей, выше прозрачность.' : 'Workspace and admin run on one data model: fewer duplicates, higher transparency.'}</p>
                  </article>
                  {nextEvent ? (
                    <article className="home-story-card">
                      <h3>{locale === 'ru' ? 'Следующий слот' : 'Next slot'}</h3>
                      <p>{nextEvent.title}</p>
                    </article>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="home-section home-capabilities motion-fade-up-fast">
          <div className="container">
            <div className="home-section-head">
              <h2>{locale === 'ru' ? 'Что делает платформу цельной' : 'What makes the platform coherent'}</h2>
              <p>{locale === 'ru' ? 'Не набор страниц, а продуктовый контур со связанной операционной логикой.' : 'Not a set of pages, but one product loop with connected operational logic.'}</p>
            </div>
            <div className="home-capability-grid motion-stagger">
              <article><h3>{locale === 'ru' ? 'Каталог с фокусом' : 'Focused discovery catalog'}</h3><p>{locale === 'ru' ? 'Публичная витрина отдает релевантные сценарии участия, а не информационный шум.' : 'The public catalog prioritizes relevant participation paths over noise.'}</p></article>
              <article><h3>{locale === 'ru' ? 'Рабочий кабинет' : 'Operational workspace'}</h3><p>{locale === 'ru' ? 'Профиль, заявки, команды и статусы соединены в единый пользовательский контур.' : 'Profile, applications, teams, and statuses are unified in one user workspace.'}</p></article>
              <article><h3>{locale === 'ru' ? 'Контрольный центр' : 'Command center'}</h3><p>{locale === 'ru' ? 'Админ-панель поддерживает управляемый запуск, модерацию и видимость метрик.' : 'Admin supports controlled launch, moderation, and metric visibility.'}</p></article>
            </div>
          </div>
        </section>

        <section className="home-section home-catalog motion-fade-up-fast">
          <div className="container">
            <div className="home-section-head home-section-head-wide">
              <div>
                <h2>{locale === 'ru' ? 'Актуальные события' : 'Current events'} </h2>
                <p>{locale === 'ru' ? 'Быстрый просмотр каталога с прямым переходом в регистрацию.' : 'Fast catalog preview with direct path to registration details.'}</p>
              </div>
              <Link href={`/${locale}/events`} className="signal-chip-link">{locale === 'ru' ? 'Открыть весь каталог' : 'Open full catalog'}</Link>
            </div>

            {previewEvents.length === 0 ? (
              <div className="signal-empty-state">
                <h3>{locale === 'ru' ? 'События появятся скоро' : 'Events will appear soon'}</h3>
                <p>{locale === 'ru' ? 'Пока здесь пусто. Новые события появятся после публикации.' : 'Nothing here yet. New events will appear after publishing.'}</p>
              </div>
            ) : (
              <div className="home-catalog-grid motion-stagger">
                {previewEvents.map((event, index) => (
                  <Link key={event.id} href={`/${locale}/events/${event.slug}`} className={`home-catalog-card ${index === 0 ? 'spotlight' : ''}`}>
                    <div className="home-catalog-cover">{event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <CoverFallback title={event.title} />}</div>
                    <div className="home-catalog-body">
                      <div className="home-meta-row"><span>{formatPreviewDate(event.startsAt, locale)}</span><span>{event.location}</span></div>
                      <h3>{event.title}</h3>
                      <div className="home-catalog-footer">
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

        <section className="home-section home-cta motion-fade-up-fast">
          <div className="container">
            <div className="home-cta-panel">
              <div>
                <h2>{locale === 'ru' ? 'Запустите следующий сезон событий как единый продукт' : 'Run your next event season as one product'}</h2>
                <p>{locale === 'ru' ? 'Откройте каталог, подключите команду и выстройте управляемый контур от первого клика до аналитики.' : 'Open discovery, onboard your team, and run a controlled loop from first click to analytics.'}</p>
              </div>
              <div className="home-cta-actions">
                <Link href={`/${locale}/events`} className="btn btn-primary">{locale === 'ru' ? 'Перейти к событиям' : 'Go to events'}</Link>
                <Link href={`/${locale}/register`} className="btn btn-secondary">{locale === 'ru' ? 'Начать работу' : 'Start now'}</Link>
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
