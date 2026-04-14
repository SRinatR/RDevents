'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { Button } from '@/components/ui/button';

export default function CabinetApplicationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [teams, setTeams] = useState<any[]>([]);
  const [volunteerApplications, setVolunteerApplications] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    setError('');
    Promise.all([
      eventsApi.myTeams(),
      eventsApi.myVolunteerApplications(),
    ])
      .then(([teamResult, volunteerResult]) => {
        setTeams(teamResult.teams || []);
        setVolunteerApplications(volunteerResult.applications || []);
      })
      .catch(() => setError(locale === 'ru' ? 'Не удалось загрузить заявки. Попробуйте обновить страницу.' : 'Failed to load applications. Try refreshing the page.'))
      .finally(() => setLoadingData(false));
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
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', label: locale === 'ru' ? 'Активна' : 'Active' },
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: locale === 'ru' ? 'На рассмотрении' : 'Pending' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: locale === 'ru' ? 'Отклонена' : 'Rejected' },
      ACCEPTED: { bg: 'bg-green-100', text: 'text-green-700', label: locale === 'ru' ? 'Принята' : 'Accepted' },
    };
    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm">
      <h1 className="text-3xl font-bold mb-8 text-[#1a1a1a]">
        {locale === 'ru' ? 'Мои заявки' : 'My Applications'}
      </h1>

      {loadingData ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-gray-600">
            {locale === 'ru' ? 'Загрузка...' : 'Loading...'}
          </div>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 mb-6">
          {error}
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#1a1a1a]">
                {locale === 'ru' ? 'Команды' : 'Teams'}
              </h2>
              <span className="bg-gradient-to-r from-[#E84393] to-[#E55C94] text-white px-4 py-1 rounded-full text-sm font-semibold">
                {teams.length}
              </span>
            </div>

            {teams.length === 0 ? (
              <div className="bg-[#FAF8F7] rounded-2xl p-16 text-center border-2 border-dashed border-gray-200">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-gray-600 mb-6">
                  {locale === 'ru' ? 'Вы пока не состоите в командах.' : 'You are not part of any teams yet.'}
                </p>
                <Link href={`/${locale}/events`}>
                  <Button className="bg-gradient-to-r from-[#E84393] to-[#E55C94] hover:opacity-90 text-white font-bold">
                    {locale === 'ru' ? 'Найти командное событие' : 'Find Team Event'}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {teams.map((membership: any) => (
                  <Link
                    key={membership.id}
                    href={`/${locale}/events/${membership.team?.event?.slug || ''}`}
                    className="block bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-3 text-[#1a1a1a] leading-tight">
                          {membership.team?.name || 'Team'}
                        </h3>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <span>📅</span>
                            <span>{membership.team?.event?.title || 'Event'} · {membership.role || 'Member'}</span>
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(membership.status)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#1a1a1a]">
                {locale === 'ru' ? 'Волонтёрство' : 'Volunteering'}
              </h2>
              <span className="bg-gradient-to-r from-[#E84393] to-[#E55C94] text-white px-4 py-1 rounded-full text-sm font-semibold">
                {volunteerApplications.length}
              </span>
            </div>

            {volunteerApplications.length === 0 ? (
              <div className="bg-[#FAF8F7] rounded-2xl p-16 text-center border-2 border-dashed border-gray-200">
                <div className="text-6xl mb-4">🎯</div>
                <p className="text-gray-600 mb-6">
                  {locale === 'ru' ? 'Заявок на волонтёрство пока нет.' : 'No volunteer applications yet.'}
                </p>
                <Link href={`/${locale}/events`}>
                  <Button className="bg-gradient-to-r from-[#E84393] to-[#E55C94] hover:opacity-90 text-white font-bold">
                    {locale === 'ru' ? 'Выбрать событие' : 'Choose Event'}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {volunteerApplications.map((application: any) => (
                  <Link
                    key={application.id}
                    href={`/${locale}/events/${application.event?.slug || ''}`}
                    className="block bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-3 text-[#1a1a1a] leading-tight">
                          {application.event?.title || 'Event'}
                        </h3>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <span>📍</span>
                            <span>{application.event?.location || 'Location'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>📅</span>
                            <span>{formatDate(application.assignedAt || new Date().toISOString())}</span>
                          </div>
                          {application.notes && (
                            <p className="text-gray-500 text-sm mt-2">{application.notes}</p>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(application.status)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
