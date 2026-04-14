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

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1">
        <section className="relative overflow-hidden bg-white py-16">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -left-32 top-1/3 w-80 h-80 rounded-full bg-[#F5C7D8] opacity-40" />
            <div className="absolute -left-24 top-2/3 w-64 h-64 rounded-full bg-[#B8E4D4] opacity-50" />
            <div className="absolute -right-32 top-1/4 w-96 h-96 rounded-full bg-[#FFE5B4] opacity-40" />
            <div className="absolute right-0 top-2/3 w-80 h-80 rounded-full bg-[#C8E6D7] opacity-40" />
            <div className="absolute left-1/4 -bottom-32 w-72 h-72 rounded-full bg-[#F5D1E0] opacity-30" />
          </div>

          <div className="max-w-[1400px] mx-auto px-6 relative z-10">
            <div className="text-center mb-12">
              <h1 className="text-5xl md:text-6xl font-bold mb-4 text-[#1a1a1a] leading-tight">
                {locale === 'ru' ? 'Международная платформа' : 'International platform'}<br />
                {locale === 'ru' ? 'возможностей' : 'of opportunities'}
              </h1>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                {locale === 'ru'
                  ? 'Единое пространство для организаторов, участников, команд и волонтёров'
                  : 'A shared space for organizers, participants, teams, and volunteers'}
              </p>
            </div>

            {previewEvents.length > 0 && previewEvents[0] && (
              <div className="max-w-5xl mx-auto">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-yellow-400 via-yellow-300 to-orange-400 p-1">
                  <div className="relative rounded-[22px] overflow-hidden bg-gradient-to-r from-green-400 via-teal-300 to-green-300 h-[400px]">
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-300 to-teal-200" />
                    </div>

                    <div className="relative h-full flex items-center">
                      <div className="flex-1 px-12 z-10">
                        <div className="bg-white rounded-2xl p-8 max-w-lg shadow-xl">
                          <p className="text-green-600 font-semibold mb-3">
                            {formatPreviewDate(previewEvents[0].startsAt, locale)}
                          </p>
                          <h2 className="text-3xl font-bold text-[#2E3192] mb-6 leading-tight">
                            {previewEvents[0].title}
                          </h2>

                          <div className="flex flex-wrap gap-3 mb-6">
                            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md">
                              {locale === 'ru' ? 'ПОДАЙ ЗАЯВКУ' : 'APPLY NOW'}
                            </div>
                            <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md">
                              {locale === 'ru' ? 'ВМЕСТЕ С СООБЩЕСТВОМ' : 'WITH THE COMMUNITY'}
                            </div>
                          </div>

                          <Link href={`/${locale}/events/${previewEvents[0].slug}`}>
                            <button className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all">
                              {locale === 'ru' ? 'Подать заявку' : 'Apply'}
                            </button>
                          </Link>
                        </div>
                      </div>

                      <div className="flex-1 h-full flex items-center justify-center pr-12">
                        {previewEvents[0].coverImageUrl ? (
                          <img
                            src={previewEvents[0].coverImageUrl}
                            alt={previewEvents[0].title}
                            className="max-h-[350px] object-contain drop-shadow-2xl"
                          />
                        ) : (
                          <div className="flex h-[280px] w-[280px] items-center justify-center rounded-2xl bg-white/70 text-7xl shadow-xl">
                            🎪
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="py-16 bg-[#FAF8F7]">
          <div className="max-w-[1400px] mx-auto px-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-4xl font-bold text-[#1a1a1a]">
                {locale === 'ru' ? 'Мероприятия' : 'Events'}
              </h2>
              <Link href={`/${locale}/events`} className="text-[#E55C94] hover:text-[#D04A82] font-medium flex items-center gap-2">
                {locale === 'ru' ? 'Смотреть все' : 'View all'}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {previewEvents.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🎪</div>
                <p className="text-gray-600">
                  {locale === 'ru' ? 'События скоро появятся.' : 'Events will appear soon.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {previewEvents.map((event) => (
                  <div key={event.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="relative h-[200px] bg-[#F5EDE7] flex items-center justify-center p-6">
                      {event.coverImageUrl ? (
                        <img
                          src={event.coverImageUrl}
                          alt={event.title}
                          className="w-full h-full object-contain"
                        />
                        ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-xl bg-white text-5xl">
                          🎪
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{formatPreviewDate(event.startsAt, locale)}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{event.location}</span>
                      </div>

                      <h3 className="text-base font-semibold mb-4 text-[#1a1a1a] leading-tight min-h-[60px]">
                        {event.title}
                      </h3>

                      <Link href={`/${locale}/events/${event.slug}`}>
                        <button className="w-full px-4 py-2.5 bg-gradient-to-r from-[#E84393] to-[#E55C94] text-white rounded-full font-medium text-sm hover:opacity-90 transition-opacity">
                          {locale === 'ru' ? 'Подробнее' : 'Details'}
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-20">
        <div className="max-w-[1400px] mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E55C94] text-xl font-black text-white">
                  E
                </span>
                <div>
                  <div className="text-lg font-black text-[#1a1a1a]">EventPlatform</div>
                  <div className="text-sm text-gray-600">
                    {locale === 'ru' ? 'Платформа для событий и команд' : 'Events and teams platform'}
                  </div>
                </div>
              </div>
              <a
                href="mailto:support@eventplatform.local"
                className="inline-flex rounded-full border-2 border-gray-800 bg-transparent px-6 py-2 font-medium text-gray-800 hover:bg-gray-50"
              >
                {locale === 'ru' ? 'Обратная связь' : 'Feedback'}
              </a>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Link href={`/${locale}/events`} className="block text-sm hover:text-primary transition-colors">
                  {locale === 'ru' ? 'Мероприятия' : 'Events'}
                </Link>
                <Link href={`/${locale}/register`} className="block text-sm hover:text-primary transition-colors">
                  {locale === 'ru' ? 'Регистрация' : 'Register'}
                </Link>
                <Link href={`/${locale}/login`} className="block text-sm hover:text-primary transition-colors">
                  {locale === 'ru' ? 'Вход' : 'Login'}
                </Link>
              </div>
              <div className="space-y-3">
                <Link href={`/${locale}/cabinet`} className="block text-sm hover:text-primary transition-colors">
                  {locale === 'ru' ? 'Кабинет' : 'Cabinet'}
                </Link>
                <Link href={`/${locale}/admin`} className="block text-sm hover:text-primary transition-colors">
                  {locale === 'ru' ? 'Админ-панель' : 'Admin'}
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-sm text-gray-600">
            <div>
              <p className="mb-1">© 2026 EventPlatform</p>
              <p>{locale === 'ru' ? 'Все права защищены' : 'All rights reserved'}</p>
            </div>
            <Link
              href="/doc/privacy-policy-ru.pdf"
              target="_blank"
              className="text-sm underline hover:text-primary transition-colors"
            >
              {locale === 'ru' ? 'Политика конфиденциальности' : 'Privacy Policy'}
            </Link>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-xl p-6 z-50">
          <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-700">
              {locale === 'ru'
                ? 'Платформа работает как часы благодаря файлам cookie. Чтобы всё работало корректно, пожалуйста, ознакомьтесь с нашей'
                : 'The platform works like a clock thanks to cookies. To ensure everything works correctly, please read our'}
              <Link href="/doc/privacy-policy-ru.pdf" target="_blank" className="text-[#E55C94] underline">
                {locale === 'ru' ? 'Политикой конфиденциальности' : 'Privacy Policy'}
              </Link>
            </p>
            <button className="bg-[#E55C94] hover:bg-[#D04A82] text-white rounded-full px-8 py-2 whitespace-nowrap cursor-pointer border-none">
              {locale === 'ru' ? 'Принять' : 'Accept'}
            </button>
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
