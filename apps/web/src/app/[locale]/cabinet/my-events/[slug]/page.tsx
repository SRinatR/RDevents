'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../../hooks/useAuth';
import { eventsApi } from '../../../../../lib/api';
import { useRouteLocale } from '../../../../../hooks/useRouteParams';
import { EmptyState, FieldInput, Notice, PageHeader, Panel, SectionHeader, ToolbarRow } from '@/components/ui/signal-primitives';

export default function CabinetEventDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const { slug } = use(params);

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
    if (!user || !slug) return;
    eventsApi.get(slug)
      .then((response) => setEvent(response.event))
      .catch(() => router.push(`/${locale}/cabinet/my-events`))
      .finally(() => setEventLoading(false));
  }, [user, slug, router, locale]);

  if (loading || !user) return null;
  if (eventLoading) return <div className="signal-page-shell"><Panel><SectionHeader title={locale === 'ru' ? 'Загрузка мероприятия...' : 'Loading event...'} /></Panel></div>;
  if (!event) return null;

  const myTeam = event.teamMembership?.team;
  const isVolunteer = event.memberships?.find((membership: any) => membership.role === 'VOLUNTEER');
  const isActiveParticipation = event.isRegistered || Boolean(myTeam);

  async function handleCreateTeam() {
    if (!user) return;
    setActionLoading(true);
    setTeamError('');
    try {
      const result = await eventsApi.createTeam(event.id, { name: teamName });
      setEvent((previous: any) => ({ ...previous, teamMembership: { team: result.team, role: 'CAPTAIN', status: 'ACTIVE' } }));
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
      const { member } = await eventsApi.joinTeamByCode(event.id, joinCode);
      const { team } = await eventsApi.getTeam(event.id, member.teamId);
      setEvent((previous: any) => ({ ...previous, teamMembership: { team, role: 'MEMBER', status: member.status } }));
      setTeamState('IDLE');
    } catch (err: any) {
      setTeamError(err.message || 'Ошибка вступления');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader title={event.title} subtitle={locale === 'ru' ? 'Персональное рабочее пространство события' : 'Personal event workspace'} actions={<Link href={`/${locale}/cabinet/my-events`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Назад' : 'Back'}</Link>} />

      <div className="workspace-status-strip workspace-status-strip-v2">
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Статус участия' : 'Participation status'}</small><strong>{isActiveParticipation ? (locale === 'ru' ? 'Активно' : 'Active') : (locale === 'ru' ? 'Ожидает действий' : 'Action required')}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Командный модуль' : 'Team module'}</small><strong>{event.isTeamBased ? (locale === 'ru' ? 'Включён' : 'Enabled') : (locale === 'ru' ? 'Не требуется' : 'Not required')}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Волонтёрский трек' : 'Volunteer track'}</small><strong>{isVolunteer ? isVolunteer.status : (locale === 'ru' ? 'Не активирован' : 'Not active')}</strong></div>
      </div>

      <div className="workspace-tab-row">
        <button onClick={() => setActiveTab('info')} className={`signal-chip-link ${activeTab === 'info' ? 'active' : ''}`}>{locale === 'ru' ? 'Обзор' : 'Overview'}</button>
        {event.isTeamBased ? <button onClick={() => setActiveTab('team')} className={`signal-chip-link ${activeTab === 'team' ? 'active' : ''}`}>{locale === 'ru' ? 'Команда' : 'Team'}</button> : null}
        <button onClick={() => setActiveTab('volunteer')} className={`signal-chip-link ${activeTab === 'volunteer' ? 'active' : ''}`}>{locale === 'ru' ? 'Волонтёрство' : 'Volunteer'}</button>
      </div>

      {activeTab === 'info' ? (
        <Panel variant="elevated" className="workspace-event-panel">
          <SectionHeader title={locale === 'ru' ? 'Описание и параметры' : 'Description and parameters'} />
          <p className="signal-muted cabinet-info-copy">{event.fullDescription || event.shortDescription}</p>
          <div className="signal-two-col">
            <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Дата' : 'Date'}</span><strong>{new Date(event.startsAt).toLocaleDateString()}</strong></div>
            <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Локация' : 'Location'}</span><strong>{event.location}</strong></div>
          </div>
        </Panel>
      ) : null}

      {activeTab === 'team' && event.isTeamBased ? (
        <Panel variant="elevated" className="workspace-event-panel">
          <SectionHeader title={locale === 'ru' ? 'Командный модуль' : 'Team module'} />
          {myTeam ? (
            <div className="signal-stack">
              <Notice tone="success">{locale === 'ru' ? 'Вы состоите в команде' : 'You are in team'}: {myTeam.name}</Notice>
              <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Код приглашения' : 'Invite code'}</span></div>
            </div>
          ) : (
            <div className="signal-stack">
              {teamState === 'IDLE' ? (
                <ToolbarRow>
                  <button onClick={() => setTeamState('CREATING')} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Создать команду' : 'Create team'}</button>
                  <button onClick={() => setTeamState('JOINING')} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Вступить по коду' : 'Join by code'}</button>
                </ToolbarRow>
              ) : null}

              {teamState === 'CREATING' ? (
                <div className="signal-stack">
                  <FieldInput value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder={locale === 'ru' ? 'Название команды' : 'Team name'} />
                  <ToolbarRow>
                    <button onClick={handleCreateTeam} disabled={actionLoading || !teamName.trim()} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Создать' : 'Create'}</button>
                    <button onClick={() => setTeamState('IDLE')} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Отмена' : 'Cancel'}</button>
                  </ToolbarRow>
                </div>
              ) : null}

              {teamState === 'JOINING' ? (
                <div className="signal-stack">
                  <FieldInput value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder={locale === 'ru' ? 'Код приглашения' : 'Join code'} />
                  <ToolbarRow>
                    <button onClick={handleJoinTeam} disabled={actionLoading || !joinCode.trim()} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Вступить' : 'Join'}</button>
                    <button onClick={() => setTeamState('IDLE')} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Отмена' : 'Cancel'}</button>
                  </ToolbarRow>
                </div>
              ) : null}

              {teamError ? <Notice tone="danger">{teamError}</Notice> : null}
            </div>
          )}
        </Panel>
      ) : null}

      {activeTab === 'volunteer' ? (
        <Panel variant="elevated" className="workspace-event-panel">
          <SectionHeader title={locale === 'ru' ? 'Волонтёрский статус' : 'Volunteer status'} />
          {isVolunteer ? (
            <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Текущий статус' : 'Current status'}</span></div>
          ) : (
            <EmptyState title={locale === 'ru' ? 'Заявка не подана' : 'No volunteer request'} description={locale === 'ru' ? 'Подайте заявку на публичной странице мероприятия.' : 'Apply from the public event page.'} actions={<Link href={`/${locale}/events/${event.slug}`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Открыть страницу события' : 'Open event page'}</Link>} />
          )}
        </Panel>
      ) : null}
    </div>
  );
}
