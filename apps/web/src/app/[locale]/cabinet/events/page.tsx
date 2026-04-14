'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { Button } from '@/components/ui/button';

export default function CabinetAllEventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  useEffect(() => {
    eventsApi.list()
      .then(r => setEvents(r.data || []))
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  if (loading || !user) return null;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm">
      <h1 className="text-3xl font-bold mb-8 text-[#1a1a1a]">
        {locale === 'ru' ? 'Мероприятия' : 'Events'}
      </h1>

      <div className="flex gap-8 mb-8 border-b border-gray-200">
        <Link
          href={`/${locale}/cabinet/my-events`}
          className="pb-3 text-base font-medium text-gray-600 hover:text-[#E55C94] transition-colors border-b-2 border-transparent"
        >
          {locale === 'ru' ? 'Мои мероприятия' : 'My Events'}
        </Link>
        <Link
          href={`/${locale}/cabinet/events`}
          className="pb-3 text-base font-medium text-[#E55C94] border-b-2 border-[#E55C94]"
        >
          {locale === 'ru' ? 'Все мероприятия' : 'All Events'}
        </Link>
      </div>

      {eventsLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-gray-600">
            {locale === 'ru' ? 'Загрузка...' : 'Loading...'}
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-[#FAF8F7] rounded-2xl p-24 text-center border-2 border-dashed border-gray-200">
          <div className="text-6xl mb-4">🎪</div>
          <p className="text-gray-600 text-lg">
            {locale === 'ru' ? 'Мероприятий пока нет' : 'No events yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {events.map((e: any) => {
            const isOpen = new Date(e.registrationDeadline) > new Date();
            const startDate = new Date(e.startsAt);
            const endDate = new Date(e.endsAt);

            return (
              <div key={e.id} className="bg-[#FAF8F7] rounded-2xl p-6 flex items-center gap-6 hover:shadow-md transition-shadow">
                {e.coverImageUrl ? (
                  <img 
                    src={e.coverImageUrl} 
                    alt="" 
                    className="w-28 h-28 rounded-xl object-cover flex-shrink-0" 
                  />
                ) : (
                  <div className="w-28 h-28 rounded-xl bg-[#F5EDE7] flex items-center justify-center text-5xl flex-shrink-0">
                    🎪
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-600 mb-2 flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <span>📍</span>
                      <span>{e.location}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span>📅</span>
                      <span>{formatDate(e.startsAt)} — {formatDate(e.endsAt)}</span>
                    </span>
                  </div>
                  <div className="text-xl font-bold text-[#1a1a1a] mb-2">
                    {e.title}
                  </div>
                  {!isOpen && (
                    <div className="text-sm text-red-600 font-medium">
                      {locale === 'ru' 
                        ? `Регистрация доступна только до ${formatDate(e.registrationDeadline)}`
                        : `Registration available until ${formatDate(e.registrationDeadline)}`
                      }
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {isOpen ? (
                    <Link href={`/${locale}/events/${e.slug}`}>
                      <Button className="bg-gradient-to-r from-[#E84393] to-[#E55C94] hover:opacity-90 text-white font-bold whitespace-nowrap">
                        {locale === 'ru' ? 'Подать заявку' : 'Apply'}
                      </Button>
                    </Link>
                  ) : (
                    <span className="text-red-600 font-bold text-sm whitespace-nowrap">
                      {locale === 'ru' ? 'Регистрация недоступна' : 'Registration unavailable'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
