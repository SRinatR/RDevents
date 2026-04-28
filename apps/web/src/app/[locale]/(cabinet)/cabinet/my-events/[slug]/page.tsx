'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, eventsApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, Notice, PageHeader, Panel, SectionHeader, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';
import { EventGalleryCard } from '@/components/event-gallery/EventGalleryCard';
import { EventGalleryUploadPanel } from '@/components/event-gallery/EventGalleryUploadPanel';

export default function CabinetEventDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const { slug } = use(params);

  const [event, setEvent] = useState<any>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [accessError, setAccessError] = useState('');
  const [activeTab, setActiveTab] = useState('info');

  const [teamState, setTeamState] = useState<'IDLE' | 'CREATING' | 'JOINING'>('IDLE');
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [teamError, setTeamError] = useState('');
  const [teamSuccess, setTeamSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [memberActionKey, setMemberActionKey] = useState('');
  const [gallery, setGallery] = useState<any>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [gallerySource, setGallerySource] = useState<'ALL' | 'OFFICIAL' | 'PARTICIPANT'>('ALL');
  const [galleryType, setGalleryType] = useState<'ALL' | 'PHOTO' | 'VIDEO'>('ALL');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  useEffect(() => {
    if (!user || !slug) return;
    setAccessError('');
    eventsApi.myEventWorkspace(slug)
      .then((response) => setEvent(response.event))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setAccessError(locale === 'ru'
            ? 'Рабочее пространство события откроется после одобрения заявки организатором.'
            : 'The event workspace opens after organizer approval.');
          return;
        }
        router.push(`/${locale}/cabinet/my-events`);
      })
      .finally(() => setEventLoading(false));
  }, [user, slug, router, locale]);

  useEffect(() => {
    if (!user || !event?.slug) return;

    let active = true;
    setGalleryLoading(true);
    setGalleryError('');

    eventsApi.myEventGallery(event.slug, {
      page: 1,
      limit: 6,
      source: gallerySource,
      type: galleryType,
    })
      .then((result) => {
        if (!active) return;
        setGallery(result);
      })
      .catch((err: any) => {
        if (!active) return;
        setGallery(null);
        setGalleryError(err.message || (locale === 'ru' ? 'Не удалось загрузить фотобанк' : 'Failed to load gallery'));
      })
      .finally(() => {
        if (active) setGalleryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, event?.slug, gallerySource, galleryType, locale]);

  if (loading || !user) return null;
  if (eventLoading) return <div className="signal-page-shell"><Panel><SectionHeader title={locale === 'ru' ? 'Загрузка мероприятия...' : 'Loading event...'} /></Panel></div>;
  if (accessError) {
    return (
      <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
        <EmptyState
          title={locale === 'ru' ? 'Workspace пока закрыт' : 'Workspace is locked'}
          description={accessError}
          actions={<Link href={`/${locale}/cabinet/applications`} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Проверить заявки' : 'Check applications'}</Link>}
        />
      </div>
    );
  }
  if (!event) return null;

  const myTeam = event.teamMembership?.team;
  const isCaptain = Boolean(myTeam && user && myTeam.captainUserId === user.id);
  const isVolunteer = event.memberships?.find((membership: any) => membership.role === 'VOLUNTEER');
  const volunteerTrackAvailable = Boolean(event.volunteerApplicationsEnabled || isVolunteer);
  const participantMembership = event.participantMembership ?? event.memberships?.find((membership: any) => membership.role === 'PARTICIPANT');
  const isActiveParticipation = participantMembership?.status === 'ACTIVE';
  const eventEnded = event.endsAt ? new Date(event.endsAt).getTime() <= Date.now() : false;

  async function refreshTeamState(teamId: string) {
    if (!user) return;
    const { team } = await eventsApi.getTeam(event.id, teamId);
    const myMembership = team.members?.find((member: any) => member.userId === user.id);

    setEvent((previous: any) => ({
      ...previous,
      teamMembership: myMembership
        ? { ...previous.teamMembership, team, role: myMembership.role, status: myMembership.status }
        : null,
    }));
  }

  async function reloadGallery() {
    if (!event?.slug) return;
    setGalleryLoading(true);
    setGalleryError('');

    try {
      const result = await eventsApi.myEventGallery(event.slug, {
        page: 1,
        limit: 6,
        source: gallerySource,
        type: galleryType,
      });
      setGallery(result);
    } catch (err: any) {
      setGalleryError(err.message || (locale === 'ru' ? 'Не удалось загрузить фотобанк' : 'Failed to load gallery'));
    } finally {
      setGalleryLoading(false);
    }
  }

  async function handleLoadMoreGallery() {
    if (!event?.slug || !gallery?.meta?.hasMore || galleryLoading) return;
    setGalleryLoading(true);
    setGalleryError('');

    try {
      const nextPage = Number(gallery?.meta?.page ?? 1) + 1;
      const result = await eventsApi.myEventGallery(event.slug, {
        page: nextPage,
        limit: Number(gallery?.meta?.limit ?? 6),
        source: gallerySource,
        type: galleryType,
      });

      setGallery((previous: any) => ({
        ...result,
        items: [...(previous?.items ?? []), ...(result.items ?? [])],
      }));
    } catch (err: any) {
      setGalleryError(err.message || (locale === 'ru' ? 'Не удалось загрузить ещё материалы' : 'Failed to load more media'));
    } finally {
      setGalleryLoading(false);
    }
  }

  async function handleUploadGalleryAsset(file: File, caption: string) {
    if (!event?.slug) return;
    await eventsApi.uploadMyEventGalleryAsset(event.slug, file, caption);
    await reloadGallery();
  }

  async function handleDeleteMyGalleryAsset(assetId: string) {
    if (!event?.slug) return;
    const confirmed = window.confirm(
      locale === 'ru'
        ? 'Удалить этот файл из ваших загрузок?'
        : 'Remove this file from your uploads?'
    );
    if (!confirmed) return;

    await eventsApi.deleteMyEventGalleryAsset(event.slug, assetId);
    await reloadGallery();
  }

  async function handleCreateTeam() {
    if (!user) return;
    setActionLoading(true);
    setTeamError('');
    setTeamSuccess('');
    try {
      const result = await eventsApi.createTeam(event.id, { name: teamName, description: teamDescription });
      const { team } = await eventsApi.getTeam(event.id, result.team.id);
      setEvent((previous: any) => ({ ...previous, teamMembership: { team, role: 'CAPTAIN', status: 'ACTIVE' } }));
      setTeamName('');
      setTeamDescription('');
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
    setTeamSuccess('');
    try {
      const { member } = await eventsApi.joinTeamByCode(event.id, joinCode);
      const { team } = await eventsApi.getTeam(event.id, member.teamId);
      setEvent((previous: any) => member.isChangeRequest
        ? previous
        : ({ ...previous, teamMembership: { team, role: 'MEMBER', status: member.status } }));
      setTeamSuccess(member.isChangeRequest
        ? (locale === 'ru' ? 'Заявка на изменение состава отправлена администратору.' : 'Team roster change request sent to admin.')
        : (locale === 'ru' ? 'Вы вступили в команду. Если команда ещё не утверждена, капитан отправит состав на проверку.' : 'You joined the team. If it is not approved yet, captain will submit it for review.'));
      setTeamState('IDLE');
    } catch (err: any) {
      setTeamError(err.message || 'Ошибка вступления');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitTeam() {
    if (!user || !myTeam) return;
    setActionLoading(true);
    setTeamError('');
    setTeamSuccess('');
    try {
      await eventsApi.submitTeamForApproval(event.id, myTeam.id);
      const { team } = await eventsApi.getTeam(event.id, myTeam.id);
      setEvent((previous: any) => ({ ...previous, teamMembership: { ...(previous.teamMembership ?? {}), team } }));
      setTeamSuccess(locale === 'ru' ? 'Команда зафиксирована и отправлена администратору на утверждение.' : 'Team snapshot fixed and sent for admin approval.');
    } catch (err: any) {
      setTeamError(err.message || (locale === 'ru' ? 'Не удалось отправить команду' : 'Failed to submit team'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTeamChangeRequest() {
    if (!user || !myTeam) return;
    setActionLoading(true);
    setTeamError('');
    setTeamSuccess('');
    try {
      await eventsApi.updateTeam(event.id, myTeam.id, {
        name: teamName.trim() || myTeam.name,
        description: teamDescription,
      });
      const { team } = await eventsApi.getTeam(event.id, myTeam.id);
      setEvent((previous: any) => ({ ...previous, teamMembership: { ...(previous.teamMembership ?? {}), team } }));
      setTeamName('');
      setTeamDescription('');
      setTeamSuccess(locale === 'ru' ? 'Заявка на изменение команды отправлена администратору.' : 'Team change request sent to admin.');
    } catch (err: any) {
      setTeamError(err.message || (locale === 'ru' ? 'Не удалось отправить изменения' : 'Failed to submit changes'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemoveTeamMember(member: any) {
    if (!myTeam || !isCaptain) return;
    const memberName = member.user?.name ?? member.user?.email ?? '—';
    const confirmed = window.confirm(
      locale === 'ru'
        ? `Удалить участника ${memberName} из команды?`
        : `Remove ${memberName} from the team?`
    );
    if (!confirmed) return;

    setTeamError('');
    setTeamSuccess('');
    setMemberActionKey(`remove:${member.userId}`);
    try {
      await eventsApi.removeTeamMember(event.id, myTeam.id, member.userId);
      await refreshTeamState(myTeam.id);
      setTeamSuccess(locale === 'ru' ? 'Участник удалён из команды.' : 'Member removed from team.');
    } catch (err: any) {
      setTeamError(err.message || (locale === 'ru' ? 'Не удалось удалить участника' : 'Failed to remove member'));
    } finally {
      setMemberActionKey('');
    }
  }

  async function handleTransferCaptain(member: any) {
    if (!myTeam || !isCaptain) return;
    const memberName = member.user?.name ?? member.user?.email ?? '—';
    const confirmed = window.confirm(
      locale === 'ru'
        ? `Передать капитанство участнику ${memberName}?`
        : `Transfer captain role to ${memberName}?`
    );
    if (!confirmed) return;

    setTeamError('');
    setTeamSuccess('');
    setMemberActionKey(`transfer:${member.userId}`);
    try {
      await eventsApi.transferTeamCaptain(event.id, myTeam.id, member.userId);
      await refreshTeamState(myTeam.id);
      setTeamSuccess(locale === 'ru' ? 'Капитан команды успешно изменён.' : 'Team captain transferred successfully.');
    } catch (err: any) {
      setTeamError(err.message || (locale === 'ru' ? 'Не удалось передать капитанство' : 'Failed to transfer captain role'));
    } finally {
      setMemberActionKey('');
    }
  }

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader title={event.title} subtitle={locale === 'ru' ? 'Персональное рабочее пространство события' : 'Personal event workspace'} actions={<Link href={`/${locale}/cabinet/my-events`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Назад' : 'Back'}</Link>} />

      <div className="workspace-status-strip workspace-status-strip-v2">
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Статус участия' : 'Participation status'}</small><strong>{isActiveParticipation ? (locale === 'ru' ? 'Активно' : 'Active') : (locale === 'ru' ? 'Ожидает действий' : 'Action required')}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Командный модуль' : 'Team module'}</small><strong>{event.isTeamBased ? (locale === 'ru' ? 'Включён' : 'Enabled') : (locale === 'ru' ? 'Не требуется' : 'Not required')}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Волонтёрский трек' : 'Volunteer track'}</small><strong>{isVolunteer ? formatMemberStatus(isVolunteer.status, locale) : (locale === 'ru' ? 'Не активирован' : 'Not active')}</strong></div>
      </div>

      <div className="workspace-tab-row">
        <button onClick={() => setActiveTab('info')} className={`signal-chip-link ${activeTab === 'info' ? 'active' : ''}`}>{locale === 'ru' ? 'Обзор' : 'Overview'}</button>
        {event.isTeamBased ? <button onClick={() => setActiveTab('team')} className={`signal-chip-link ${activeTab === 'team' ? 'active' : ''}`}>{locale === 'ru' ? 'Команда' : 'Team'}</button> : null}
        {volunteerTrackAvailable ? <button onClick={() => setActiveTab('volunteer')} className={`signal-chip-link ${activeTab === 'volunteer' ? 'active' : ''}`}>{locale === 'ru' ? 'Волонтёрство' : 'Volunteer'}</button> : null}
        <button onClick={() => setActiveTab('history')} className={`signal-chip-link ${activeTab === 'history' ? 'active' : ''}`}>{locale === 'ru' ? 'История' : 'History'}</button>
        <button onClick={() => setActiveTab('media')} className={`signal-chip-link ${activeTab === 'media' ? 'active' : ''}`}>Media</button>
        <button onClick={() => setActiveTab('feedback')} className={`signal-chip-link ${activeTab === 'feedback' ? 'active' : ''}`}>{locale === 'ru' ? 'Отзыв' : 'Feedback'}</button>
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
              <Notice tone={myTeam.status === 'ACTIVE' ? 'success' : myTeam.status === 'PENDING' || myTeam.status === 'CHANGES_PENDING' ? 'warning' : 'info'}>
                {locale === 'ru' ? 'Команда' : 'Team'}: {myTeam.name} · {formatTeamStatus(myTeam.status, locale)}
              </Notice>
              <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Код приглашения' : 'Invite code'}</span><strong>{myTeam.joinCode ?? '—'}</strong></div>
              {myTeam.changeRequests?.[0] ? (
                <Notice tone="warning">
                  {locale === 'ru'
                    ? 'Есть заявка на утверждение. До решения администратора состав и параметры зафиксированы.'
                    : 'Approval request is pending. Roster and settings are locked until admin decision.'}
                </Notice>
              ) : null}
              {myTeam.members?.length ? (
                <div className="signal-stack">
                  {myTeam.members.map((member: any) => (
                    <div key={member.id} className="signal-ranked-item">
                      <span>
                        {member.user?.name ?? member.user?.email ?? '—'}
                        {member.userId === user.id ? ` (${locale === 'ru' ? 'Вы' : 'You'})` : ''}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <strong>{member.role} · {member.status}</strong>
                        {isCaptain && member.role !== 'CAPTAIN' ? (
                          <ToolbarRow>
                            <button
                              onClick={() => handleRemoveTeamMember(member)}
                              disabled={Boolean(memberActionKey)}
                              className="btn btn-ghost btn-sm"
                            >
                              {memberActionKey === `remove:${member.userId}`
                                ? (locale === 'ru' ? 'Удаляем...' : 'Removing...')
                                : (locale === 'ru' ? 'Удалить' : 'Remove')}
                            </button>
                            {member.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleTransferCaptain(member)}
                                disabled={Boolean(memberActionKey)}
                                className="btn btn-secondary btn-sm"
                              >
                                {memberActionKey === `transfer:${member.userId}`
                                  ? (locale === 'ru' ? 'Передаём...' : 'Transferring...')
                                  : (locale === 'ru' ? 'Сделать капитаном' : 'Make captain')}
                              </button>
                            ) : null}
                          </ToolbarRow>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {['DRAFT', 'REJECTED'].includes(myTeam.status) ? (
                <ToolbarRow>
                  <button onClick={handleSubmitTeam} disabled={actionLoading} className="btn btn-primary btn-sm">
                    {locale === 'ru' ? 'Команда готова, отправить на утверждение' : 'Team ready, submit for approval'}
                  </button>
                </ToolbarRow>
              ) : null}
              {myTeam.status === 'ACTIVE' ? (
                <div className="signal-stack">
                  <Notice tone="info">
                    {locale === 'ru'
                      ? 'Команда утверждена и заблокирована. Любое изменение отправляется как заявка, прежнее состояние сохраняется до решения администратора.'
                      : 'Team is approved and locked. Any edit is submitted as a request while the approved state stays unchanged.'}
                  </Notice>
                  <FieldInput value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder={locale === 'ru' ? 'Новое название команды' : 'New team name'} />
                  <FieldInput value={teamDescription} onChange={(event) => setTeamDescription(event.target.value)} placeholder={locale === 'ru' ? 'Комментарий к изменению' : 'Change comment'} />
                  <ToolbarRow>
                    <button onClick={handleTeamChangeRequest} disabled={actionLoading} className="btn btn-secondary btn-sm">
                      {locale === 'ru' ? 'Подать изменение' : 'Submit change request'}
                    </button>
                  </ToolbarRow>
                </div>
              ) : null}
              {teamSuccess ? <Notice tone="success">{teamSuccess}</Notice> : null}
              {teamError ? <Notice tone="danger">{teamError}</Notice> : null}
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
                  <FieldInput value={teamDescription} onChange={(event) => setTeamDescription(event.target.value)} placeholder={locale === 'ru' ? 'Описание / комментарий' : 'Description / comment'} />
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

              {teamSuccess ? <Notice tone="success">{teamSuccess}</Notice> : null}
              {teamError ? <Notice tone="danger">{teamError}</Notice> : null}
            </div>
          )}
        </Panel>
      ) : null}

      {activeTab === 'history' ? (
        <Panel variant="elevated" className="workspace-event-panel">
          <SectionHeader title={locale === 'ru' ? 'История участия' : 'Participation history'} />
          <div className="signal-stack">
            {event.memberships?.map((membership: any) => (
              <div key={membership.id ?? `${membership.role}-${membership.status}`} className="signal-ranked-item">
                <span>{membership.role} · {membership.status}</span>
                <strong>{membership.assignedAt ? new Date(membership.assignedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') : '—'}</strong>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {activeTab === 'media' ? (
        <div className="signal-stack">
          <EventGalleryUploadPanel
            locale={locale}
            title={locale === 'ru' ? 'Добавить фото или видео' : 'Upload photo or video'}
            subtitle={locale === 'ru'
              ? 'Ваши материалы попадут в очередь модерации и после проверки появятся в фотобанке.'
              : 'Your submission goes through moderation before it appears in the photobank.'}
            helper={locale === 'ru'
              ? `JPG, PNG, WebP до ${gallery?.permissions?.photoLimitMb ?? 12} МБ; MP4, WebM, MOV до ${gallery?.permissions?.videoLimitMb ?? 40} МБ.`
              : `JPG, PNG, WebP up to ${gallery?.permissions?.photoLimitMb ?? 12} MB; MP4, WebM, MOV up to ${gallery?.permissions?.videoLimitMb ?? 40} MB.`}
            buttonLabel={locale === 'ru' ? 'Загрузить в фотобанк' : 'Upload to photobank'}
            uploadingLabel={locale === 'ru' ? 'Загружаем...' : 'Uploading...'}
            successMessage={locale === 'ru'
              ? 'Файл отправлен на модерацию и скоро появится в вашем списке.'
              : 'The file was sent for moderation and will appear in your list shortly.'}
            onUpload={handleUploadGalleryAsset}
          />

          <Panel variant="elevated" className="workspace-event-panel event-gallery-panel">
            <SectionHeader
              title={locale === 'ru' ? 'Опубликованный фотобанк' : 'Published photobank'}
              subtitle={locale === 'ru'
                ? 'Официальные материалы и утверждённые публикации участников.'
                : 'Official media and approved participant contributions.'}
            />

            {(gallery?.summary?.total ?? 0) > 0 ? (
              <>
                <div className="event-gallery-summary-row">
                  <div className="event-gallery-summary-pill"><strong>{gallery.summary.total}</strong><span>{locale === 'ru' ? 'всего' : 'total'}</span></div>
                  <div className="event-gallery-summary-pill"><strong>{gallery.summary.official}</strong><span>{locale === 'ru' ? 'официальных' : 'official'}</span></div>
                  <div className="event-gallery-summary-pill"><strong>{gallery.summary.participant}</strong><span>{locale === 'ru' ? 'от участников' : 'participant'}</span></div>
                  <div className="event-gallery-summary-pill"><strong>{gallery.summary.videos}</strong><span>{locale === 'ru' ? 'видео' : 'videos'}</span></div>
                </div>

                <div className="event-gallery-filter-row">
                  <button type="button" className={`signal-chip-link ${gallerySource === 'ALL' ? 'active' : ''}`} onClick={() => setGallerySource('ALL')}>{locale === 'ru' ? 'Все материалы' : 'All media'}</button>
                  <button type="button" className={`signal-chip-link ${gallerySource === 'OFFICIAL' ? 'active' : ''}`} onClick={() => setGallerySource('OFFICIAL')}>{locale === 'ru' ? 'От организаторов' : 'Official'}</button>
                  <button type="button" className={`signal-chip-link ${gallerySource === 'PARTICIPANT' ? 'active' : ''}`} onClick={() => setGallerySource('PARTICIPANT')}>{locale === 'ru' ? 'От участников' : 'Participants'}</button>
                  <button type="button" className={`signal-chip-link ${galleryType === 'PHOTO' ? 'active' : ''}`} onClick={() => setGalleryType((value) => value === 'PHOTO' ? 'ALL' : 'PHOTO')}>{locale === 'ru' ? 'Только фото' : 'Photos only'}</button>
                  <button type="button" className={`signal-chip-link ${galleryType === 'VIDEO' ? 'active' : ''}`} onClick={() => setGalleryType((value) => value === 'VIDEO' ? 'ALL' : 'VIDEO')}>{locale === 'ru' ? 'Только видео' : 'Videos only'}</button>
                </div>
              </>
            ) : null}

            {galleryLoading && !(gallery?.items?.length > 0) ? <div className="signal-muted">{locale === 'ru' ? 'Загрузка фотобанка...' : 'Loading photobank...'}</div> : null}

            {!galleryLoading && (gallery?.items?.length ?? 0) === 0 ? (
              <EmptyState
                title={locale === 'ru' ? 'Опубликованных материалов пока нет' : 'No published media yet'}
                description={locale === 'ru'
                  ? 'Сюда попадают официальные публикации и подтверждённые фото или видео участников.'
                  : 'Official media and approved participant uploads will appear here.'}
              />
            ) : null}

            {(gallery?.items?.length ?? 0) > 0 ? (
              <>
                <div className="event-gallery-grid">
                  {gallery.items.map((item: any) => (
                    <EventGalleryCard key={item.id} item={item} locale={locale} />
                  ))}
                </div>
                {gallery?.meta?.hasMore ? (
                  <div className="event-gallery-loadmore">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleLoadMoreGallery} disabled={galleryLoading}>
                      {galleryLoading
                        ? (locale === 'ru' ? 'Загружаем...' : 'Loading...')
                        : (locale === 'ru' ? 'Показать ещё' : 'Load more')}
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            {galleryError ? <Notice tone="danger">{galleryError}</Notice> : null}
          </Panel>

          <Panel variant="elevated" className="workspace-event-panel event-gallery-panel">
            <SectionHeader
              title={locale === 'ru' ? 'Мои загрузки' : 'My uploads'}
              subtitle={locale === 'ru'
                ? 'Следите за статусом модерации своих публикаций.'
                : 'Track the moderation state of your submissions.'}
            />

            <div className="event-gallery-summary-row">
              <div className="event-gallery-summary-pill"><strong>{gallery?.mySummary?.total ?? 0}</strong><span>{locale === 'ru' ? 'всего' : 'total'}</span></div>
              <div className="event-gallery-summary-pill"><strong>{gallery?.mySummary?.pending ?? 0}</strong><span>{locale === 'ru' ? 'на проверке' : 'pending'}</span></div>
              <div className="event-gallery-summary-pill"><strong>{gallery?.mySummary?.published ?? 0}</strong><span>{locale === 'ru' ? 'опубликовано' : 'published'}</span></div>
              <div className="event-gallery-summary-pill"><strong>{gallery?.mySummary?.rejected ?? 0}</strong><span>{locale === 'ru' ? 'отклонено' : 'rejected'}</span></div>
            </div>

            {(gallery?.myUploads?.length ?? 0) === 0 ? (
              <EmptyState
                title={locale === 'ru' ? 'Вы ещё ничего не загрузили' : 'You have not uploaded anything yet'}
                description={locale === 'ru'
                  ? 'После загрузки здесь появятся ваши фото и видео с текущими статусами.'
                  : 'Your photo and video submissions appear here with their current statuses.'}
              />
            ) : (
              <div className="event-gallery-grid">
                {gallery.myUploads.map((item: any) => (
                  <EventGalleryCard
                    key={item.id}
                    item={item}
                    locale={locale}
                    showStatus
                    actions={(
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteMyGalleryAsset(item.id)}>
                        {locale === 'ru' ? 'Удалить' : 'Delete'}
                      </button>
                    )}
                  />
                ))}
              </div>
            )}
          </Panel>
        </div>
      ) : null}

      {activeTab === 'feedback' ? (
        <Panel variant="elevated" className="workspace-event-panel">
          <SectionHeader title={locale === 'ru' ? 'Отзыв участника' : 'Participant feedback'} />
          {eventEnded ? (
            <EmptyState title={locale === 'ru' ? 'Форма отзыва скоро появится' : 'Feedback form is coming soon'} description={locale === 'ru' ? 'Здесь будет post-event форма для оценки и комментариев.' : 'A post-event rating and comments form will live here.'} />
          ) : (
            <Notice tone="info">{locale === 'ru' ? 'Отзыв можно будет оставить после завершения события.' : 'Feedback opens after the event ends.'}</Notice>
          )}
        </Panel>
      ) : null}

      {activeTab === 'volunteer' ? (
        <Panel variant="elevated" className="workspace-event-panel">
          <SectionHeader title={locale === 'ru' ? 'Волонтёрский статус' : 'Volunteer status'} />
          {isVolunteer ? (
            <div className="signal-stack">
              <div className="signal-ranked-item">
                <span>{locale === 'ru' ? 'Текущий статус' : 'Current status'}</span>
                <StatusBadge tone={memberStatusTone(isVolunteer.status)}>{formatMemberStatus(isVolunteer.status, locale)}</StatusBadge>
              </div>
              <div className="signal-ranked-item">
                <span>{locale === 'ru' ? 'Дата заявки' : 'Application date'}</span>
                <strong>{isVolunteer.assignedAt ? new Date(isVolunteer.assignedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') : '—'}</strong>
              </div>
              {isVolunteer.volunteerCertificatePublicUrl ? (
                <>
                  <div className="signal-ranked-item">
                    <span>{locale === 'ru' ? 'Сертификат' : 'Certificate'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <StatusBadge tone="info">{locale === 'ru' ? 'Доступен' : 'Available'}</StatusBadge>
                      <a
                        href={isVolunteer.volunteerCertificatePublicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        {locale === 'ru' ? 'Открыть сертификат' : 'Open certificate'}
                      </a>
                    </div>
                  </div>
                  <div className="signal-ranked-item">
                    <span>{isVolunteer.volunteerCertificateOriginalFilename ?? (locale === 'ru' ? 'Файл сертификата' : 'Certificate file')}</span>
                    <strong>
                      {formatDocumentSize(isVolunteer.volunteerCertificateSizeBytes, locale)} · {isVolunteer.volunteerCertificateUploadedAt ? new Date(isVolunteer.volunteerCertificateUploadedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') : '—'}
                    </strong>
                  </div>
                </>
              ) : null}
              {isVolunteer.status === 'PENDING' ? (
                <Notice tone="warning">
                  {locale === 'ru'
                    ? 'Организатор ещё рассматривает волонтёрскую заявку. После решения статус обновится здесь и в разделе волонтёрства.'
                    : 'Organizer is still reviewing the volunteer application. The status updates here and in the volunteer center.'}
                </Notice>
              ) : null}
              {isVolunteer.status === 'ACTIVE' && !isVolunteer.volunteerCertificatePublicUrl ? (
                <Notice tone="info">
                  {locale === 'ru'
                    ? 'Как только организатор загрузит сертификат, он появится здесь и в вашем волонтёрском кабинете.'
                    : 'Once the organizer uploads the certificate, it will appear here and in your volunteer center.'}
                </Notice>
              ) : null}
            </div>
          ) : (
            <EmptyState title={locale === 'ru' ? 'Заявка не подана' : 'No volunteer request'} description={locale === 'ru' ? 'Подайте заявку из каталога кабинета, если организатор открыл набор волонтёров.' : 'Apply from the cabinet catalog if the organizer enabled volunteer recruitment.'} actions={<Link href={`/${locale}/cabinet/events?event=${event.slug}&openApplyChoice=1`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Открыть подачу заявки' : 'Open application'}</Link>} />
          )}
        </Panel>
      ) : null}
    </div>
  );
}

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

function memberStatusTone(status: string | null | undefined): StatusTone {
  if (!status) return 'neutral';
  if (['ACTIVE', 'APPROVED', 'CONFIRMED'].includes(status)) return 'success';
  if (['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_PENDING'].includes(status)) return 'warning';
  if (status === 'RESERVE') return 'info';
  if (['REJECTED', 'CANCELLED', 'REMOVED', 'WITHDRAWN'].includes(status)) return 'danger';
  return 'neutral';
}

function formatMemberStatus(status: string | null | undefined, locale: string) {
  const ru: Record<string, string> = {
    ACTIVE: 'Активно',
    APPROVED: 'Одобрено',
    PENDING: 'На рассмотрении',
    RESERVE: 'В резерве',
    REJECTED: 'Отклонено',
    CANCELLED: 'Отменено',
    REMOVED: 'Удалено',
    WITHDRAWN: 'Отозвано',
  };
  const en: Record<string, string> = {
    ACTIVE: 'Active',
    APPROVED: 'Approved',
    PENDING: 'Pending',
    RESERVE: 'Reserve',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    REMOVED: 'Removed',
    WITHDRAWN: 'Withdrawn',
  };

  return (locale === 'ru' ? ru : en)[status ?? ''] ?? (status ?? '—');
}

function formatTeamStatus(status: string | null | undefined, locale: string) {
  const ru: Record<string, string> = {
    DRAFT: 'Черновик',
    PENDING: 'На утверждении',
    CHANGES_PENDING: 'Изменения на утверждении',
    ACTIVE: 'Утверждена',
    REJECTED: 'Нужны правки',
    ARCHIVED: 'Архив',
  };
  const en: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING: 'Pending approval',
    CHANGES_PENDING: 'Changes pending',
    ACTIVE: 'Approved',
    REJECTED: 'Needs changes',
    ARCHIVED: 'Archived',
  };
  return (locale === 'ru' ? ru : en)[status ?? ''] ?? (status ?? '—');
}

function formatDocumentSize(value: number | null | undefined, locale: string) {
  if (!value || value <= 0) return locale === 'ru' ? 'Размер не указан' : 'Size unavailable';

  const units = locale === 'ru'
    ? ['Б', 'КБ', 'МБ', 'ГБ']
    : ['B', 'KB', 'MB', 'GB'];

  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const normalized = size >= 10 || unitIndex === 0 ? Math.round(size) : Number(size.toFixed(1));
  return `${normalized} ${units[unitIndex]}`;
}
