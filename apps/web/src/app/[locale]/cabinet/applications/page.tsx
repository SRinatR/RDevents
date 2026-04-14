'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';

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
        setTeams(teamResult.teams);
        setVolunteerApplications(volunteerResult.applications);
      })
      .catch(() => setError('Не удалось загрузить заявки. Попробуйте обновить страницу.'))
      .finally(() => setLoadingData(false));
  }, [user]);

  if (loading || !user) return null;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 900, letterSpacing: 0 }}>
        Мои заявки
      </h1>

      {loadingData ? (
        <div style={{ color: 'var(--color-text-muted)' }}>Загрузка...</div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <div style={{ display: 'grid', gap: 28 }}>
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 14, alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Команды</h2>
              <span className="badge badge-primary">{teams.length}</span>
            </div>

            {teams.length === 0 ? (
              <EmptyState text="Вы пока не состоите в командах." href={`/${locale}/events`} action="Найти командное событие" />
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {teams.map((membership: any) => (
                  <Link key={membership.id} href={`/${locale}/events/${membership.team.event.slug}`} className="table-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>{membership.team.name}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
                        {membership.team.event.title} · {membership.role}
                      </div>
                    </div>
                    <span className={`badge ${membership.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                      {membership.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 14, alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Волонтёрство</h2>
              <span className="badge badge-primary">{volunteerApplications.length}</span>
            </div>

            {volunteerApplications.length === 0 ? (
              <EmptyState text="Заявок на волонтёрство пока нет." href={`/${locale}/events`} action="Выбрать событие" />
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {volunteerApplications.map((application: any) => (
                  <Link key={application.id} href={`/${locale}/events/${application.event.slug}`} className="table-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>{application.event.title}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
                        {application.event.location} · {new Date(application.assignedAt).toLocaleDateString()}
                      </div>
                      {application.notes && (
                        <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.88rem' }}>{application.notes}</p>
                      )}
                    </div>
                    <span className={`badge ${application.status === 'REJECTED' ? 'badge-danger' : application.status === 'PENDING' ? 'badge-warning' : 'badge-success'}`}>
                      {application.status}
                    </span>
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

function EmptyState({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <div style={{ padding: 28, border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-xl)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
      <p style={{ margin: '0 0 14px' }}>{text}</p>
      <Link href={href} className="btn btn-primary btn-sm">{action}</Link>
    </div>
  );
}
