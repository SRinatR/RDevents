'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../../hooks/useAuth';
import { ApiError, eventsApi } from '../../../../../lib/api';
import { useRouteLocale } from '../../../../../hooks/useRouteParams';
import {
  EmptyState,
  FieldInput,
  FieldTextarea,
  LoadingLines,
  Notice,
  PageHeader,
  Panel,
  SectionHeader,
  ToolbarRow,
} from '@/components/ui/signal-primitives';
import {
  buildProfileRequirementUrl,
  filterEventFormMissingFields,
  filterProfileMissingFields,
  getProfileRequirementLabel,
  type RegistrationMissingField,
} from '@/components/cabinet/profile/profile.requirements';

const OPEN_INVITATION_STATUSES = new Set(['PENDING_ACCOUNT', 'PENDING_RESPONSE']);

export default function CabinetEventEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';

  const [event, setEvent] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [teamSlots, setTeamSlots] = useState<any>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [missingFields, setMissingFields] = useState<RegistrationMissingField[]>([]);
  const [registrationAnswers, setRegistrationAnswers] = useState<Record<string, unknown>>({});
  const [registrationFieldLabels, setRegistrationFieldLabels] = useState<Record<string, string>>({});
  const [pageLoading, setPageLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [slotEmails, setSlotEmails] = useState<Record<number, string>>({});

  const cabinetHref = `/${locale}/cabinet/events/${slug}`;

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${locale}/login?next=${encodeURIComponent(cabinetHref)}`);
    }
  }, [loading, user, router, locale, cabinetHref]);

  const loadWorkspace = useCallback(async () => {
    if (!user || !slug) return;
    setPageLoading(true);
    setError('');
    try {
      const { event: currentEvent } = await eventsApi.get(slug);
      setEvent(currentEvent);
      setRegistrationAnswers(currentEvent.registrationAnswers || {});
      setRegistrationFieldLabels(currentEvent.registrationFieldLabels || {});

      const [membershipResponse, invitationResponse] = await Promise.all([
        eventsApi.membership(currentEvent.id),
        eventsApi.myTeamInvitations(),
      ]);

      setMembership(membershipResponse.membership);
      const eventInvitations = (invitationResponse.invitations || []).filter((item: any) => item.eventId === currentEvent.id);
      setInvitations(eventInvitations);

      const participantMembership = getParticipantMembership(currentEvent, membershipResponse.membership);
      const isActiveParticipant = participantMembership?.status === 'ACTIVE';

      if (!isActiveParticipant) {
        try {
          const { precheck } = await eventsApi.registrationPrecheck(currentEvent.id, {});
          setMissingFields(precheck.missingFields || []);
          setRegistrationAnswers(precheck.answers || currentEvent.registrationAnswers || {});
          setRegistrationFieldLabels(precheck.registrationFieldLabels || currentEvent.registrationFieldLabels || {});
        } catch (err) {
          setMissingFields(extractMissingFields(err));
        }
        setTeamSlots(null);
        return;
      }

      setMissingFields([]);
      const teamId = membershipResponse.membership?.teamMembership?.team?.id ?? currentEvent.teamMembership?.team?.id;
      if (teamId) {
        const slots = await eventsApi.getTeamSlots(currentEvent.id, teamId);
        setTeamSlots(slots);
      } else {
        setTeamSlots(null);
      }
    } catch (err: any) {
      setError(err.message || (isRu ? 'Не удалось открыть мероприятие' : 'Failed to open event'));
    } finally {
      setPageLoading(false);
    }
  }, [user, slug, isRu]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const openInvitations = useMemo(
    () => invitations.filter((invitation) => OPEN_INVITATION_STATUSES.has(invitation.status)),
    [invitations],
  );
  const myTeam = teamSlots?.team ?? membership?.teamMembership?.team ?? null;
  const isCaptain = Boolean(myTeam && myTeam.captainUserId === user?.id);

  useEffect(() => {
    if (!myTeam) return;

    setTeamName(myTeam.name ?? '');
    setTeamDescription(myTeam.description ?? '');
  }, [myTeam?.id, myTeam?.name, myTeam?.description]);

  if (loading || !user) return null;
  if (pageLoading) {
    return (
      <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
        <Panel><LoadingLines rows={7} /></Panel>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
        <EmptyState title={isRu ? 'Мероприятие не открылось' : 'Event did not open'} description={error} actions={<Link href={`/${locale}/cabinet/events`} className="btn btn-secondary btn-sm">{isRu ? 'К каталогу' : 'To catalog'}</Link>} />
      </div>
    );
  }

  if (!event) return null;

  const participantMembership = getParticipantMembership(event, membership);
  const isActiveParticipant = participantMembership?.status === 'ACTIVE';

  async function handleJoinEvent() {
    setActionLoading('join-event');
    setError('');
    setSuccess('');
    try {
      await eventsApi.register(event.id, registrationAnswers);
      setSuccess(isRu ? 'Участие активировано.' : 'Participation activated.');
      await loadWorkspace();
    } catch (err: any) {
      const fields = extractMissingFields(err);
      if (fields.length > 0) {
        setMissingFields(fields);
        const profileFields = filterProfileMissingFields(fields);
        if (profileFields.length > 0) {
          router.push(buildProfileLink(locale, slug, event, profileFields));
          return;
        }
        setError(isRu ? 'Заполните обязательные поля анкеты мероприятия.' : 'Complete required event form fields.');
      } else {
        setError(err.message || (isRu ? 'Не удалось стать участником' : 'Failed to join event'));
      }
    } finally {
      setActionLoading('');
    }
  }

  async function handleCreateTeam() {
    if (!teamName.trim()) return;
    setActionLoading('create-team');
    setError('');
    setSuccess('');
    try {
      await eventsApi.createTeam(event.id, { name: teamName.trim(), description: teamDescription.trim() || undefined });
      setTeamName('');
      setTeamDescription('');
      setSuccess(isRu ? 'Команда создана. Заполните слоты участниками.' : 'Team created. Fill the slots with members.');
      await loadWorkspace();
    } catch (err: any) {
      setError(err.message || (isRu ? 'Не удалось создать команду' : 'Failed to create team'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleUpdateTeam() {
    if (!myTeam) return;

    const nextName = teamName.trim();
    const nextDescription = teamDescription.trim();
    const currentDescription = String(myTeam.description ?? '').trim();

    if (!nextName) {
      setError(isRu ? 'Укажите название команды.' : 'Enter team name.');
      return;
    }

    if (nextName === myTeam.name && nextDescription === currentDescription) {
      setSuccess(isRu ? 'Изменений нет.' : 'No changes to save.');
      return;
    }

    setActionLoading('update-team');
    setError('');
    setSuccess('');

    try {
      await eventsApi.updateTeam(event.id, myTeam.id, {
        name: nextName,
        description: nextDescription || undefined,
      });

      const teamRequiresApproval = event.requireAdminApprovalForTeams && myTeam.status === 'ACTIVE';
      setSuccess(
        teamRequiresApproval
          ? (isRu ? 'Изменения команды отправлены на согласование организатору.' : 'Team changes were sent for organizer approval.')
          : (isRu ? 'Данные команды обновлены.' : 'Team details updated.')
      );
      await loadWorkspace();
    } catch (err: any) {
      setError(err.message || (isRu ? 'Не удалось сохранить изменения команды' : 'Failed to save team changes'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleAcceptInvitation(invitationId: string) {
    setActionLoading(`accept:${invitationId}`);
    setError('');
    setSuccess('');
    try {
      await eventsApi.acceptTeamInvitation(invitationId);
      setSuccess(isRu ? 'Приглашение принято.' : 'Invitation accepted.');
      await loadWorkspace();
    } catch (err: any) {
      const fields = extractMissingFields(err);
      if (fields.length > 0) {
        setMissingFields(fields);
        const profileFields = filterProfileMissingFields(fields);
        if (profileFields.length > 0) {
          router.push(buildProfileLink(locale, slug, event, profileFields));
          return;
        }
        setError(isRu ? 'Сначала заполните обязательную анкету мероприятия.' : 'Complete required event form fields first.');
      } else {
        setError(err.message || (isRu ? 'Не удалось принять приглашение' : 'Failed to accept invitation'));
      }
    } finally {
      setActionLoading('');
    }
  }

  async function handleDeclineInvitation(invitationId: string) {
    setActionLoading(`decline:${invitationId}`);
    setError('');
    setSuccess('');
    try {
      await eventsApi.declineTeamInvitation(invitationId);
      setSuccess(isRu ? 'Приглашение отклонено.' : 'Invitation declined.');
      await loadWorkspace();
    } catch (err: any) {
      setError(err.message || (isRu ? 'Не удалось отклонить приглашение' : 'Failed to decline invitation'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleInvite(slotIndex: number) {
    if (!myTeam) return;
    const email = (slotEmails[slotIndex] ?? '').trim();
    if (!email) return;
    setActionLoading(`invite:${slotIndex}`);
    setError('');
    setSuccess('');
    try {
      await eventsApi.inviteToTeamByEmail(event.id, myTeam.id, { slotIndex, email });
      setSlotEmails((previous) => ({ ...previous, [slotIndex]: '' }));
      setSuccess(isRu ? 'Приглашение отправлено.' : 'Invitation sent.');
      await loadWorkspace();
    } catch (err: any) {
      setError(err.message || (isRu ? 'Не удалось отправить приглашение' : 'Failed to send invitation'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    if (!myTeam) return;
    setActionLoading(`cancel:${invitationId}`);
    setError('');
    setSuccess('');
    try {
      await eventsApi.cancelTeamInvitation(event.id, myTeam.id, invitationId);
      setSuccess(isRu ? 'Приглашение отменено.' : 'Invitation cancelled.');
      await loadWorkspace();
    } catch (err: any) {
      setError(err.message || (isRu ? 'Не удалось отменить приглашение' : 'Failed to cancel invitation'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleRemoveMember(member: any) {
    if (!myTeam || !member?.userId) return;
    const confirmed = window.confirm(isRu ? 'Удалить участника из команды?' : 'Remove this member from the team?');
    if (!confirmed) return;
    setActionLoading(`remove:${member.userId}`);
    setError('');
    setSuccess('');
    try {
      await eventsApi.removeTeamMember(event.id, myTeam.id, member.userId);
      setSuccess(isRu ? 'Участник удалён.' : 'Member removed.');
      await loadWorkspace();
    } catch (err: any) {
      setError(err.message || (isRu ? 'Не удалось удалить участника' : 'Failed to remove member'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleTransferCaptain(member: any) {
    if (!myTeam || !member?.userId) return;
    const confirmed = window.confirm(isRu ? 'Передать капитанство этому участнику?' : 'Transfer captain role to this member?');
    if (!confirmed) return;
    setActionLoading(`transfer:${member.userId}`);
    setError('');
    setSuccess('');
    try {
      await eventsApi.transferTeamCaptain(event.id, myTeam.id, member.userId);
      setSuccess(isRu ? 'Капитанство передано.' : 'Captain role transferred.');
      await loadWorkspace();
    } catch (err: any) {
      setError(err.message || (isRu ? 'Не удалось передать капитанство' : 'Failed to transfer captain role'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleSubmitTeam() {
    if (!myTeam) return;
    setActionLoading('submit-team');
    setError('');
    setSuccess('');
    try {
      await eventsApi.submitTeamForApproval(event.id, myTeam.id);
      setSuccess(isRu ? 'Команда отправлена на утверждение.' : 'Team submitted for approval.');
      await loadWorkspace();
    } catch (err: any) {
      setError(err.message || (isRu ? 'Не удалось отправить команду' : 'Failed to submit team'));
    } finally {
      setActionLoading('');
    }
  }

  const profileMissingFields = filterProfileMissingFields(missingFields);
  const eventFormMissingFields = filterEventFormMissingFields(missingFields);
  const profileLink = buildProfileLink(locale, slug, event, profileMissingFields);

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader
        title={event.title}
        subtitle={isRu ? 'Личный кабинет мероприятия' : 'Event cabinet'}
        actions={<Link href={`/${locale}/events/${event.slug}`} className="btn btn-secondary btn-sm">{isRu ? 'Публичная страница' : 'Public page'}</Link>}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <Panel variant="elevated" className="workspace-event-panel">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'center' }}>
          <div style={{ aspectRatio: '16 / 9', borderRadius: 8, overflow: 'hidden', background: 'var(--color-bg-subtle)' }}>
            {event.coverImageUrl ? <img src={event.coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
          </div>
          <div className="signal-stack">
            <SectionHeader title={isRu ? 'Статус участия' : 'Participation status'} subtitle={event.shortDescription} />
            <div className="workspace-status-strip workspace-status-strip-v2">
              <div className="workspace-status-card"><small>{isRu ? 'Участник' : 'Participant'}</small><strong>{formatParticipantStatus(participantMembership?.status, locale)}</strong></div>
              <div className="workspace-status-card"><small>{isRu ? 'Команда' : 'Team'}</small><strong>{myTeam ? myTeam.name : (isRu ? 'Не создана' : 'Not created')}</strong></div>
              <div className="workspace-status-card"><small>{isRu ? 'Формат' : 'Mode'}</small><strong>{event.teamJoinMode ?? 'OPEN'}</strong></div>
            </div>
          </div>
        </div>
      </Panel>

      {!isActiveParticipant ? (
        <Panel variant="elevated" className="workspace-event-panel">
          <SectionHeader title={isRu ? 'Стать участником' : 'Join as participant'} />
          {participantMembership?.status === 'PENDING' ? (
            <Notice tone="warning">{isRu ? 'Заявка участника ожидает решения организатора.' : 'Participant application is pending organizer review.'}</Notice>
          ) : missingFields.length > 0 ? (
            <div className="signal-stack">
              <Notice tone="warning">
                {isRu
                  ? 'Для регистрации не хватает конкретных данных. Профиль откроется сразу в нужном разделе, а недостающие поля будут подсвечены.'
                  : 'Registration needs specific data. The profile opens in the right section and missing fields are highlighted.'}
              </Notice>

              {profileMissingFields.length > 0 ? (
                <div className="registration-missing-block">
                  <strong>{isRu ? 'Заполнить в профиле' : 'Complete in profile'}</strong>
                  <div className="signal-stack">
                    {profileMissingFields.map((field) => (
                      <div key={field.key} className="signal-ranked-item">
                        <span>{getProfileRequirementLabel(field.key, locale, field.label)}</span>
                        <strong>{isRu ? 'Профиль' : 'Profile'}</strong>
                      </div>
                    ))}
                  </div>
                  <ToolbarRow>
                    <Link href={profileLink} className="btn btn-primary btn-sm">{isRu ? 'Перейти к полям профиля' : 'Go to profile fields'}</Link>
                  </ToolbarRow>
                </div>
              ) : null}

              {eventFormMissingFields.length > 0 ? (
                <div className="registration-missing-block">
                  <strong>{isRu ? 'Анкета этого мероприятия' : 'This event form'}</strong>
                  {profileMissingFields.length > 0 ? (
                    <Notice tone="info">
                      {isRu
                        ? `После профиля вернитесь сюда: нужно будет заполнить ${eventFormMissingFields.map((field) => getEventRequirementLabel(field, registrationFieldLabels, locale)).join(', ')}.`
                        : `After profile, return here to fill: ${eventFormMissingFields.map((field) => getEventRequirementLabel(field, registrationFieldLabels, locale)).join(', ')}.`}
                    </Notice>
                  ) : (
                    <>
                      <EventRegistrationAnswersForm
                        locale={locale}
                        fields={eventFormMissingFields}
                        labels={registrationFieldLabels}
                        answers={registrationAnswers}
                        onAnswerChange={(key, value) => setRegistrationAnswers((previous) => ({ ...previous, [key]: value }))}
                      />
                      <ToolbarRow>
                        <button onClick={handleJoinEvent} disabled={actionLoading === 'join-event'} className="btn btn-primary btn-sm">
                          {actionLoading === 'join-event' ? (isRu ? 'Проверяем...' : 'Checking...') : (isRu ? 'Заполнить и зарегистрироваться' : 'Complete and register')}
                        </button>
                      </ToolbarRow>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <ToolbarRow>
              <button onClick={handleJoinEvent} disabled={actionLoading === 'join-event'} className="btn btn-primary btn-sm">
                {actionLoading === 'join-event' ? (isRu ? 'Активируем...' : 'Joining...') : (isRu ? 'Участвовать' : 'Join')}
              </button>
            </ToolbarRow>
          )}
        </Panel>
      ) : !myTeam ? (
        <Panel variant="elevated" className="workspace-event-panel">
          <SectionHeader title={isRu ? 'Команда' : 'Team'} subtitle={isRu ? 'Создайте команду или ответьте на входящее приглашение.' : 'Create a team or respond to an incoming invitation.'} />
          <div className="signal-stack">
            {openInvitations.length > 0 ? (
              <IncomingInvitations
                locale={locale}
                invitations={openInvitations}
                actionLoading={actionLoading}
                onAccept={handleAcceptInvitation}
                onDecline={handleDeclineInvitation}
              />
            ) : null}
            <div className="signal-stack">
              <FieldInput value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder={isRu ? 'Название команды' : 'Team name'} />
              <FieldInput value={teamDescription} onChange={(event) => setTeamDescription(event.target.value)} placeholder={isRu ? 'Комментарий' : 'Comment'} />
              <ToolbarRow>
                <button onClick={handleCreateTeam} disabled={actionLoading === 'create-team' || !teamName.trim()} className="btn btn-primary btn-sm">
                  {actionLoading === 'create-team' ? (isRu ? 'Создаём...' : 'Creating...') : (isRu ? 'Создать команду' : 'Create team')}
                </button>
                <Link href={`/${locale}/cabinet/team-invitations`} className="btn btn-secondary btn-sm">{isRu ? 'Все приглашения' : 'All invitations'}</Link>
              </ToolbarRow>
            </div>
          </div>
        </Panel>
      ) : (
        <TeamSlotsWorkspace
          locale={locale}
          userId={user.id}
          event={event}
          teamSlots={teamSlots}
          isCaptain={isCaptain}
          actionLoading={actionLoading}
          teamName={teamName}
          teamDescription={teamDescription}
          slotEmails={slotEmails}
          onTeamNameChange={setTeamName}
          onTeamDescriptionChange={setTeamDescription}
          onSlotEmailChange={(slotIndex, value) => setSlotEmails((previous) => ({ ...previous, [slotIndex]: value }))}
          onInvite={handleInvite}
          onCancelInvitation={handleCancelInvitation}
          onRemoveMember={handleRemoveMember}
          onTransferCaptain={handleTransferCaptain}
          onUpdateTeam={handleUpdateTeam}
          onSubmitTeam={handleSubmitTeam}
        />
      )}
    </div>
  );
}

function IncomingInvitations({ locale, invitations, actionLoading, onAccept, onDecline }: {
  locale: string;
  invitations: any[];
  actionLoading: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const isRu = locale === 'ru';
  return (
    <div className="signal-stack">
      {invitations.map((invitation) => (
        <div key={invitation.id} className="signal-ranked-item">
          <span>{isRu ? 'Вас пригласили в команду' : 'You were invited to team'} {invitation.team?.name}</span>
          <ToolbarRow>
            <button onClick={() => onAccept(invitation.id)} disabled={Boolean(actionLoading)} className="btn btn-primary btn-sm">
              {actionLoading === `accept:${invitation.id}` ? '...' : (isRu ? 'Принять' : 'Accept')}
            </button>
            <button onClick={() => onDecline(invitation.id)} disabled={Boolean(actionLoading)} className="btn btn-secondary btn-sm">
              {actionLoading === `decline:${invitation.id}` ? '...' : (isRu ? 'Отклонить' : 'Decline')}
            </button>
          </ToolbarRow>
        </div>
      ))}
    </div>
  );
}

function TeamSlotsWorkspace({
  locale,
  userId,
  event,
  teamSlots,
  isCaptain,
  actionLoading,
  teamName,
  teamDescription,
  slotEmails,
  onTeamNameChange,
  onTeamDescriptionChange,
  onSlotEmailChange,
  onInvite,
  onCancelInvitation,
  onRemoveMember,
  onTransferCaptain,
  onUpdateTeam,
  onSubmitTeam,
}: {
  locale: string;
  userId: string;
  event: any;
  teamSlots: any;
  isCaptain: boolean;
  actionLoading: string;
  teamName: string;
  teamDescription: string;
  slotEmails: Record<number, string>;
  onTeamNameChange: (value: string) => void;
  onTeamDescriptionChange: (value: string) => void;
  onSlotEmailChange: (slotIndex: number, value: string) => void;
  onInvite: (slotIndex: number) => void;
  onCancelInvitation: (invitationId: string) => void;
  onRemoveMember: (member: any) => void;
  onTransferCaptain: (member: any) => void;
  onUpdateTeam: () => void;
  onSubmitTeam: () => void;
}) {
  const isRu = locale === 'ru';
  const team = teamSlots?.team;
  const slots = teamSlots?.slots ?? [];
  const progress = teamSlots?.progress ?? { active: 0, max: event.maxTeamSize ?? 5 };
  const editable = isCaptain && (['DRAFT', 'REJECTED'].includes(team?.status) || (!event.requireAdminApprovalForTeams && team?.status === 'ACTIVE'));
  const canSubmit = isCaptain && ['DRAFT', 'REJECTED'].includes(team?.status) && Boolean(teamSlots?.canSubmit);
  const canEditTeamDetails = isCaptain && ['DRAFT', 'REJECTED', 'ACTIVE'].includes(team?.status);
  const editButtonLabel = team?.status === 'ACTIVE' && event.requireAdminApprovalForTeams
    ? (isRu ? 'Отправить изменения' : 'Submit changes')
    : (isRu ? 'Сохранить изменения' : 'Save changes');

  return (
    <Panel variant="elevated" className="workspace-event-panel">
      <SectionHeader
        title={team?.name ?? (isRu ? 'Команда' : 'Team')}
        subtitle={`${isRu ? 'Статус' : 'Status'}: ${formatTeamStatus(team?.status, locale)} · ${progress.active}/${progress.max}`}
      />
      <div className="signal-stack">
        {team?.changeRequests?.[0] ? (
          <Notice tone="warning">{isRu ? 'Команда ждёт решения организатора.' : 'Team is waiting for organizer decision.'}</Notice>
        ) : null}
        {canEditTeamDetails ? (
          <div className="signal-stack">
            <SectionHeader
              title={isRu ? 'Редактирование команды' : 'Edit team'}
              subtitle={
                team?.status === 'ACTIVE' && event.requireAdminApprovalForTeams
                  ? (isRu ? 'После сохранения изменения уйдут организатору на согласование.' : 'After saving, changes will be sent to organizer approval.')
                  : (isRu ? 'Измените название и описание команды.' : 'Update team name and description.')
              }
            />
            <FieldInput
              value={teamName}
              onChange={(event) => onTeamNameChange(event.target.value)}
              placeholder={isRu ? 'Название команды' : 'Team name'}
            />
            <FieldTextarea
              value={teamDescription}
              onChange={(event) => onTeamDescriptionChange(event.target.value)}
              placeholder={isRu ? 'Описание команды' : 'Team description'}
              rows={3}
            />
            <ToolbarRow>
              <button onClick={onUpdateTeam} disabled={actionLoading === 'update-team'} className="btn btn-secondary btn-sm">
                {actionLoading === 'update-team' ? (isRu ? 'Сохраняем...' : 'Saving...') : editButtonLabel}
              </button>
            </ToolbarRow>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          {slots.map((slot: any) => (
            <SlotCard
              key={slot.slotIndex}
              locale={locale}
              userId={userId}
              slot={slot}
              editable={editable}
              isCaptain={isCaptain}
              actionLoading={actionLoading}
              emailValue={slotEmails[slot.slotIndex] ?? ''}
              onEmailChange={(value) => onSlotEmailChange(slot.slotIndex, value)}
              onInvite={() => onInvite(slot.slotIndex)}
              onCancelInvitation={onCancelInvitation}
              onRemoveMember={onRemoveMember}
              onTransferCaptain={onTransferCaptain}
            />
          ))}
        </div>
        <ToolbarRow>
          <button onClick={onSubmitTeam} disabled={!canSubmit || actionLoading === 'submit-team'} className="btn btn-primary btn-sm">
            {actionLoading === 'submit-team' ? (isRu ? 'Отправляем...' : 'Submitting...') : (isRu ? 'Подать заявку команды' : 'Submit team')}
          </button>
          {!teamSlots?.canSubmit ? <span className="signal-muted">{isRu ? 'Доступно при 5/5 активных участниках.' : 'Available at 5/5 active members.'}</span> : null}
        </ToolbarRow>
        {teamSlots?.history?.length ? (
          <div className="signal-stack">
            <SectionHeader title={isRu ? 'История приглашений' : 'Invitation history'} />
            {teamSlots.history.map((invitation: any) => (
              <div key={invitation.id} className="signal-ranked-item">
                <span>{invitation.inviteeEmail}</span>
                <strong>{formatInvitationStatus(invitation.status, locale)}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function SlotCard({
  locale,
  userId,
  slot,
  editable,
  isCaptain,
  actionLoading,
  emailValue,
  onEmailChange,
  onInvite,
  onCancelInvitation,
  onRemoveMember,
  onTransferCaptain,
}: {
  locale: string;
  userId: string;
  slot: any;
  editable: boolean;
  isCaptain: boolean;
  actionLoading: string;
  emailValue: string;
  onEmailChange: (value: string) => void;
  onInvite: () => void;
  onCancelInvitation: (invitationId: string) => void;
  onRemoveMember: (member: any) => void;
  onTransferCaptain: (member: any) => void;
}) {
  const isRu = locale === 'ru';
  const cardTone = slot.kind === 'EMPTY' ? 'var(--color-bg-subtle)' : slot.kind === 'INVITATION' ? '#fffbeb' : '#f0fdf4';
  const border = slot.kind === 'INVITATION' ? '#f59e0b' : slot.kind === 'MEMBER' || slot.kind === 'CAPTAIN' ? '#86efac' : 'var(--color-border)';
  const user = slot.user ?? slot.member?.user;
  const member = slot.member;
  const invitation = slot.invitation;

  return (
    <div style={{ border: `1px solid ${border}`, background: cardTone, borderRadius: 8, padding: 12, display: 'grid', gap: 10, minHeight: 160 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong>{isRu ? 'Слот' : 'Slot'} {slot.slotIndex}</strong>
        <span className="signal-muted">{slot.kind === 'CAPTAIN' ? (isRu ? 'Капитан' : 'Captain') : formatInvitationStatus(slot.status, locale)}</span>
      </div>

      {slot.kind === 'EMPTY' ? (
        editable ? (
          <div className="signal-stack">
            <FieldInput type="email" value={emailValue} onChange={(event) => onEmailChange(event.target.value)} placeholder="participant@example.com" />
            <button onClick={onInvite} disabled={!emailValue.trim() || Boolean(actionLoading)} className="btn btn-primary btn-sm">
              {actionLoading === `invite:${slot.slotIndex}` ? '...' : (isRu ? 'Пригласить' : 'Invite')}
            </button>
          </div>
        ) : (
          <span className="signal-muted">{isRu ? 'Пустой слот' : 'Empty slot'}</span>
        )
      ) : null}

      {slot.kind === 'INVITATION' ? (
        <div className="signal-stack">
          <span>{slot.email}</span>
          <strong>{formatInvitationStatus(slot.status, locale)}</strong>
          {editable && invitation?.id ? (
            <button onClick={() => onCancelInvitation(invitation.id)} disabled={Boolean(actionLoading)} className="btn btn-secondary btn-sm">
              {actionLoading === `cancel:${invitation.id}` ? '...' : (isRu ? 'Отменить' : 'Cancel')}
            </button>
          ) : null}
        </div>
      ) : null}

      {slot.kind === 'MEMBER' || slot.kind === 'CAPTAIN' ? (
        <div className="signal-stack">
          <div>
            <strong>{user?.name ?? user?.email ?? '—'}</strong>
            <div className="signal-muted">{user?.email}{user?.id === userId ? ` · ${isRu ? 'вы' : 'you'}` : ''}</div>
          </div>
          {isCaptain && slot.kind === 'MEMBER' ? (
            <ToolbarRow>
              <button onClick={() => onRemoveMember(member)} disabled={Boolean(actionLoading)} className="btn btn-ghost btn-sm">
                {actionLoading === `remove:${member?.userId}` ? '...' : (isRu ? 'Удалить' : 'Remove')}
              </button>
              <button onClick={() => onTransferCaptain(member)} disabled={Boolean(actionLoading)} className="btn btn-secondary btn-sm">
                {actionLoading === `transfer:${member?.userId}` ? '...' : (isRu ? 'Сделать капитаном' : 'Make captain')}
              </button>
            </ToolbarRow>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EventRegistrationAnswersForm({
  locale,
  fields,
  labels,
  answers,
  onAnswerChange,
}: {
  locale: string;
  fields: RegistrationMissingField[];
  labels: Record<string, string>;
  answers: Record<string, unknown>;
  onAnswerChange: (key: string, value: string) => void;
}) {
  const isRu = locale === 'ru';
  return (
    <div className="registration-event-form">
      {fields.map((field) => {
        const label = getEventRequirementLabel(field, labels, locale);
        const value = answers[field.key] == null ? '' : String(answers[field.key]);
        const useTextarea = ['motivation', 'experience', 'specialRequirements', 'teamPreference'].includes(field.key);
        return (
          <label key={field.key} className="cabinet-field-block">
            <span className="cabinet-field-label">{label}</span>
            {useTextarea ? (
              <FieldTextarea
                value={value}
                onChange={(event) => onAnswerChange(field.key, event.target.value)}
                placeholder={isRu ? 'Заполните ответ' : 'Enter your answer'}
                className="signal-field-required"
                rows={4}
              />
            ) : (
              <FieldInput
                value={value}
                onChange={(event) => onAnswerChange(field.key, event.target.value)}
                placeholder={isRu ? 'Заполните значение' : 'Enter value'}
                className="signal-field-required"
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

function getParticipantMembership(event: any, membership: any) {
  return membership?.memberships?.find((item: any) => item.role === 'PARTICIPANT')
    ?? event?.memberships?.find((item: any) => item.role === 'PARTICIPANT')
    ?? null;
}

function extractMissingFields(error: unknown) {
  if (error instanceof ApiError && Array.isArray((error.details as any)?.missingFields)) {
    return (error.details as any).missingFields as RegistrationMissingField[];
  }
  return [];
}

function buildProfileLink(locale: string, slug: string, event: any, missingFields: RegistrationMissingField[]) {
  return buildProfileRequirementUrl({
    locale,
    requiredFields: missingFields.map((field) => field.key),
    eventTitle: event?.title,
    returnTo: `/${locale}/cabinet/events/${slug}`,
  });
}

const EVENT_REQUIREMENT_LABELS: Record<string, Record<'ru' | 'en', string>> = {
  motivation: { ru: 'Мотивация', en: 'Motivation' },
  experience: { ru: 'Опыт', en: 'Experience' },
  teamPreference: { ru: 'Пожелания по команде', en: 'Team preference' },
  tshirtSize: { ru: 'Размер футболки', en: 'T-shirt size' },
  emergencyContact: { ru: 'Экстренный контакт', en: 'Emergency contact' },
  preferredSlot: { ru: 'Предпочтительный слот', en: 'Preferred slot' },
  specialRequirements: { ru: 'Особые требования', en: 'Special requirements' },
  university: { ru: 'Университет', en: 'University' },
  faculty: { ru: 'Факультет', en: 'Faculty' },
  course: { ru: 'Курс', en: 'Course' },
};

function getEventRequirementLabel(field: RegistrationMissingField, labels: Record<string, string>, locale: string) {
  return EVENT_REQUIREMENT_LABELS[field.key]?.[locale === 'ru' ? 'ru' : 'en'] ?? labels[field.key] ?? field.label ?? field.key;
}

function formatParticipantStatus(status: string | null | undefined, locale: string) {
  const ru: Record<string, string> = {
    ACTIVE: 'Активен',
    PENDING: 'На рассмотрении',
    REJECTED: 'Отклонён',
    RESERVE: 'В резерве',
    CANCELLED: 'Отменён',
  };
  const en: Record<string, string> = {
    ACTIVE: 'Active',
    PENDING: 'Pending',
    REJECTED: 'Rejected',
    RESERVE: 'Reserve',
    CANCELLED: 'Cancelled',
  };
  return (locale === 'ru' ? ru : en)[status ?? ''] ?? (locale === 'ru' ? 'Не участник' : 'Not joined');
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

function formatInvitationStatus(status: string | null | undefined, locale: string) {
  const ru: Record<string, string> = {
    EMPTY: 'Пусто',
    ACTIVE: 'Активен',
    PENDING_ACCOUNT: 'Ожидает регистрации',
    PENDING_RESPONSE: 'Ожидает ответа',
    ACCEPTED: 'Принято',
    DECLINED: 'Отказано',
    CANCELLED: 'Отменено',
    EXPIRED: 'Истекло',
    REMOVED: 'Удалено',
  };
  const en: Record<string, string> = {
    EMPTY: 'Empty',
    ACTIVE: 'Active',
    PENDING_ACCOUNT: 'Waiting for account',
    PENDING_RESPONSE: 'Waiting for response',
    ACCEPTED: 'Accepted',
    DECLINED: 'Declined',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
    REMOVED: 'Removed',
  };
  return (locale === 'ru' ? ru : en)[status ?? ''] ?? (status ?? '—');
}
