'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../../hooks/useAuth';
import { eventsApi } from '../../../../../lib/api';
import { useRouteLocale } from '../../../../../hooks/useRouteParams';

export default function CabinetEventDashboard({ params }: { params: { slug: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [event, setEvent] = useState<any>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  const [teamState, setTeamState] = useState<'IDLE' | 'CREATING' | 'JOINING'>('IDLE');
  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [teamError, setTeamError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  useEffect(() => {
    if (!user || !params.slug) return;
    eventsApi.get(params.slug)
      .then(r => setEvent(r.event))
      .catch(() => router.push(`/${locale}/cabinet/my-events`))
      .finally(() => setEventLoading(false));
  }, [user, params.slug, router, locale]);

  if (loading || !user) return null;
  if (eventLoading) return <div style={{ color: 'var(--color-text-muted)' }}>Загрузка мероприятия...</div>;
  if (!event) return null;

  const myTeam = event.teamMembership?.team;
  const isVolunteer = event.memberships?.find((m: any) => m.role === 'VOLUNTEER');

  async function handleCreateTeam() {
    if (!user) return;
    setActionLoading(true);
    setTeamError('');
    try {
      const res = await eventsApi.createTeam(event.id, { name: teamName });
      setEvent((prev: any) => ({
        ...prev,
        teamMembership: { team: res.team, role: 'CAPTAIN', status: 'ACTIVE' }
      }));
      setTeamState('IDLE');
    } catch (err: any) {
      setTeamError(err.message || 'Ошибка создания команды');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleJoinTeam() {
    if (!user) return;
    setActionLoading(true);
    setTeamError('');
    try {
      const res = await eventsApi.listTeams(event.id);
      const team = res.teams.find((t: any) => t.joinCode === joinCode);
      if (!team) throw new Error('Неверный код или команда не найдена');
      
      await eventsApi.joinTeam(event.id, team.id, joinCode);
      setEvent((prev: any) => ({
        ...prev,
        teamMembership: { team, role: 'MEMBER', status: 'ACTIVE' }
      }));
      setTeamState('IDLE');
    } catch (err: any) {
      setTeamError(err.message || 'Ошибка вступления');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div>
      <Link href={`/${locale}/cabinet/my-events`} style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-block', marginBottom: 16 }}>
        ← Назад к списку
      </Link>
      <h1 style={{ margin: '0 0 24px', fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        {event.title}
      </h1>

      <div className="cabinet-tabs">
        <button onClick={() => setActiveTab('info')} className={`cabinet-tab ${activeTab === 'info' ? 'active' : ''}`} style={{ background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', paddingBottom: 12 }}>
          Инфо
        </button>
        {event.isTeamBased && (
          <button onClick={() => setActiveTab('team')} className={`cabinet-tab ${activeTab === 'team' ? 'active' : ''}`} style={{ background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', paddingBottom: 12 }}>
            Моя команда
          </button>
        )}
        <button onClick={() => setActiveTab('volunteer')} className={`cabinet-tab ${activeTab === 'volunteer' ? 'active' : ''}`} style={{ background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', paddingBottom: 12 }}>
          Волонтёрство
        </button>
      </div>

      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        {activeTab === 'info' && (
          <div>
            <div style={{ fontSize: '0.95rem', color: 'var(--color-text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              {event.fullDescription || event.shortDescription}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-subtle)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Дата</div>
                <div style={{ fontWeight: 700 }}>{new Date(event.startsAt).toLocaleDateString()}</div>
              </div>
              <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-subtle)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Локация</div>
                <div style={{ fontWeight: 700 }}>{event.location}</div>
              </div>
              <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-subtle)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Статус регистрации</div>
                <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>Подтвержден</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'team' && event.isTeamBased && (
          <div>
            {myTeam ? (
              <div style={{ padding: 24, borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-success)', background: 'rgba(22,163,74,0.05)', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🛡️</div>
                <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: 800 }}>Вы в команде: {myTeam.name}</h2>
                <div style={{ padding: '8px 16px', background: '#fff', border: '1px dashed var(--color-primary)', display: 'inline-block', borderRadius: 'var(--radius-md)', fontWeight: 700, letterSpacing: 1 }}>
                  Код приглашения: {myTeam.joinCode}
                </div>
                <p style={{ marginTop: 16, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Поделитесь этим кодом с друзьями, чтобы они могли вступить в вашу команду!</p>
              </div>
            ) : (
              <div style={{ maxWidth: 400 }}>
                {teamState === 'IDLE' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ color: 'var(--color-text-muted)', margin: '0 0 8px' }}>Вам необходимо присоединиться к команде или создать новую.</p>
                    <button onClick={() => setTeamState('CREATING')} className="btn btn-primary">Создать команду</button>
                    <button onClick={() => setTeamState('JOINING')} className="btn btn-secondary">Вступить в готовую по коду</button>
                  </div>
                )}

                {teamState === 'CREATING' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <input type="text" className="input-field" placeholder="Название команды" value={teamName} onChange={e => setTeamName(e.target.value)} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleCreateTeam} disabled={actionLoading || !teamName.trim()} className="btn btn-primary" style={{ flex: 1 }}>Создать</button>
                      <button onClick={() => setTeamState('IDLE')} className="btn btn-ghost">Отмена</button>
                    </div>
                  </div>
                )}

                {teamState === 'JOINING' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <input type="text" className="input-field" placeholder="Код приглашения (например, T1T4N5)" value={joinCode} onChange={e => setJoinCode(e.target.value)} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleJoinTeam} disabled={actionLoading || !joinCode.trim()} className="btn btn-primary" style={{ flex: 1 }}>Вступить</button>
                      <button onClick={() => setTeamState('IDLE')} className="btn btn-ghost">Отмена</button>
                    </div>
                  </div>
                )}

                {teamError && <div style={{ color: 'var(--color-danger)', marginTop: 12, fontWeight: 600 }}>{teamError}</div>}
              </div>
            )}
          </div>
        )}

        {activeTab === 'volunteer' && (
          <div>
            {isVolunteer ? (
              <div style={{ padding: 24, borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-primary-glow)', background: 'var(--color-primary-subtle)', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🙋</div>
                <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800 }}>Статус волонтерской заявки:</h2>
                <span className={`badge ${isVolunteer.status === 'PENDING' ? 'badge-muted' : isVolunteer.status === 'ACTIVE' || isVolunteer.status === 'APPROVED' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '1rem', padding: '6px 16px' }}>
                  {isVolunteer.status}
                </span>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-xl)' }}>
                <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)' }}>Вы не подавали заявку на волонтёрство для этого мероприятия.</p>
                <Link href={`/${locale}/events/${event.slug}`} className="btn btn-ghost btn-sm">Перейти на страницу подачи заявки</Link>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
