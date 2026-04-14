'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { Button } from '@/components/ui/button';

export default function MyEventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  useEffect(() => {
    if (!user) return;

    setEventsLoading(true);
    setError('');
    eventsApi.myEvents()
      .then(result => setEvents(result.events || []))
      .catch(() => setError(locale === 'ru' ? 'Не удалось загрузить мероприятия.' : 'Failed to load events.'))
      .finally(() => setEventsLoading(false));
  }, [user, locale]);

  if (loading || !user) return null;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; label: string }> = {
      ACTIVE: {
        className: 'bg-green-100 text-green-700',
        label: locale === 'ru' ? 'Активно' : 'Active',
      },
      APPROVED: {
        className: 'bg-green-100 text-green-700',
        label: locale === 'ru' ? 'Одобрено' : 'Approved',
      },
      PENDING: {
        className: 'bg-yellow-100 text-yellow-700',
        label: locale === 'ru' ? 'На рассмотрении' : 'Pending',
      },
      REJECTED: {
        className: 'bg-red-100 text-red-700',
        label: locale === 'ru' ? 'Отклонено' : 'Rejected',
      },
    };
    const config = statusConfig[status] || {
      className: 'bg-gray-100 text-gray-700',
      label: status,
    };

    return (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm">
      <h1 className="text-3xl font-bold mb-8 text-[#1a1a1a]">
        {locale === 'ru' ? 'Мероприятия' : 'Events'}
      </h1>

      <div className="flex gap-8 mb-8 border-b border-gray-200">
        <Link
          href={`/${locale}/cabinet/my-events`}
          className="pb-3 text-base font-medium text-[#E55C94] border-b-2 border-[#E55C94]"
        >
          {locale === 'ru' ? 'Мои мероприятия' : 'My Events'}
        </Link>
        <Link
          href={`/${locale}/cabinet/events`}
          className="pb-3 text-base font-medium text-gray-600 hover:text-[#E55C94] transition-colors border-b-2 border-transparent"
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
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-[#FAF8F7] rounded-2xl p-24 text-center border-2 border-dashed border-gray-200">
          <div className="text-6xl mb-4">🎪</div>
          <p className="text-gray-600 text-lg mb-6">
            {locale === 'ru' ? 'Вы пока не участвуете ни в одном мероприятии' : 'You have not joined any events yet'}
          </p>
          <Link href={`/${locale}/cabinet/events`}>
            <Button className="bg-gradient-to-r from-[#E84393] to-[#E55C94] hover:opacity-90 text-white font-bold">
              {locale === 'ru' ? 'Посмотреть мероприятия' : 'View Events'}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {events.map((registration: any) => {
            const event = registration.event ?? registration;
            const href = event.slug
              ? `/${locale}/cabinet/my-events/${event.slug}`
              : `/${locale}/cabinet/my-events`;

            return (
              <Link
                key={registration.registrationId ?? registration.id ?? event.id}
                href={href}
                className="block bg-[#FAF8F7] rounded-2xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-6">
                  {event.coverImageUrl ? (
                    <img
                      src={event.coverImageUrl}
                      alt=""
                      className="w-28 h-28 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-xl bg-[#F5EDE7] flex items-center justify-center text-5xl flex-shrink-0">
                      🎪
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-600 mb-2 flex flex-wrap items-center gap-4">
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <span>📍</span>
                          <span>{event.location}</span>
                        </span>
                      )}
                      {event.startsAt && event.endsAt && (
                        <span className="flex items-center gap-1">
                          <span>📅</span>
                          <span>{formatDate(event.startsAt)} — {formatDate(event.endsAt)}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xl font-bold text-[#1a1a1a] mb-3">
                      {event.title}
                    </div>
                    {getStatusBadge(registration.status)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
