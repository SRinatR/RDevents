'use client';

import Link from 'next/link';
import { Panel, SectionHeader, EmptyState, Notice } from '@/components/ui/signal-primitives';
import { StatusBadge, RoleBadge } from '@/components/ui/status-badge';
import { formatTeamStatus } from './dashboard.formatters';
import type { DashboardEventData, TeamData } from './dashboard.types';

interface CabinetTeamCardProps {
  team: TeamData | null;
  event: DashboardEventData;
  locale: string;
}

function getTeamEditHref(event: DashboardEventData, locale: string): string {
  return `/${locale}/cabinet/events/${event.slug}?team=edit`;
}

function TeamAvatar({ name, src }: { name: string; src?: string | null }) {
  const safeName = name.trim() || 'U';
  const initials = safeName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return (
      <img 
        src={src} 
        alt={name} 
        className="team-member-avatar" 
      />
    );
  }

  return (
    <div className="team-member-avatar team-member-avatar-placeholder">
      {initials}
    </div>
  );
}

function NoTeamState({ event, locale }: { event: DashboardEventData; locale: string }) {
  return (
    <EmptyState
      title={locale === 'ru' ? 'Вы не состоите в команде' : 'Not in a team'}
      description={locale === 'ru' 
        ? 'Создайте команду или вступите по приглашению' 
        : 'Create a team or join via invitation'
      }
      actions={
        <div className="no-team-actions">
          <Link href={`/${locale}/events/${event.slug}?action=create-team`} className="btn btn-primary btn-sm">
            {locale === 'ru' ? 'Создать команду' : 'Create team'}
          </Link>
          <Link href={`/${locale}/events/${event.slug}?action=join-team`} className="btn btn-secondary btn-sm">
            {locale === 'ru' ? 'Вступить' : 'Join'}
          </Link>
        </div>
      }
    />
  );
}

function TeamMembersList({ team, locale }: { team: TeamData; locale: string }) {
  if (!team.members || team.members.length === 0) return null;

  const members = [...team.members].sort((left, right) => {
    if (left.role === right.role) {
      return left.name.localeCompare(right.name, locale === 'ru' ? 'ru' : 'en');
    }

    if (left.role === 'CAPTAIN') return -1;
    if (right.role === 'CAPTAIN') return 1;
    return 0;
  });

  return (
    <div className="team-members-list">
      {members.map((member) => {
        const memberName = member.name || member.email;

        return (
        <div key={member.userId} className="team-member-row">
          <TeamAvatar name={memberName} src={member.avatar} />
          <div className="team-member-info">
            <span className="team-member-name">{memberName}</span>
            {member.email && member.email !== memberName ? (
              <span className="signal-muted">{member.email}</span>
            ) : null}
            <RoleBadge role={member.role} size="sm" />
          </div>
        </div>
        );
      })}
    </div>
  );
}

function TeamActionNotice({ team, locale }: { team: TeamData; locale: string }) {
  if (team.isPendingReview) {
    return (
      <Notice tone="warning">
        {locale === 'ru'
          ? 'Команда сейчас на проверке организатором. Редактирование временно недоступно до решения.'
          : 'The team is currently under organizer review. Editing is temporarily unavailable until a decision is made.'}
      </Notice>
    );
  }

  if (team.requiresApprovalAfterEdit) {
    return (
      <Notice tone="info">
        {locale === 'ru'
          ? 'Изменения состава или данных команды после сохранения уйдут организатору на согласование.'
          : 'After saving, team changes will be sent to the organizer for approval.'}
      </Notice>
    );
  }

  if (typeof team.pendingInvites === 'number' && team.pendingInvites > 0) {
    return (
      <Notice tone="warning">
        {locale === 'ru'
          ? `${team.pendingInvites} приглашение(й) ожидает ответа.`
          : `${team.pendingInvites} invitation(s) are waiting for a response.`}
      </Notice>
    );
  }

  return null;
}

export function CabinetTeamCard({ team, event, locale }: CabinetTeamCardProps) {
  const teamEditHref = getTeamEditHref(event, locale);
  const teamOpenHref = `/${locale}/cabinet/events/${event.slug}`;
  const memberTarget = team?.requiredActiveMembers ?? team?.maxMembers ?? team?.membersCount ?? 0;
  const teamSummary = team
    ? [
        {
          label: locale === 'ru' ? 'Статус' : 'Status',
          value: formatTeamStatus(team.status, locale),
        },
        {
          label: locale === 'ru' ? 'Состав' : 'Roster',
          value:
            locale === 'ru'
              ? `${team.membersCount}${memberTarget ? ` из ${memberTarget}` : ''} участников`
              : `${team.membersCount}${memberTarget ? ` of ${memberTarget}` : ''} members`,
        },
        {
          label: locale === 'ru' ? 'Капитан' : 'Captain',
          value: team.isCaptain
            ? (locale === 'ru' ? 'Вы управляете командой' : 'You manage the team')
            : (locale === 'ru' ? 'Вы участник команды' : 'You are a team member'),
        },
      ]
    : [];

  return (
    <Panel className="team-card-panel">
      <SectionHeader 
        title={locale === 'ru' ? 'Моя команда' : 'My team'}
        actions={
          team ? <StatusBadge status={team.status} type="team" size="sm" /> : null
        }
      />
      
      {!team ? (
        <NoTeamState event={event} locale={locale} />
      ) : (
        <>
          <div className="team-info">
            <h3 className="team-name">{team.name}</h3>
            <span className="signal-muted team-count">{formatTeamStatus(team.status, locale)}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {teamSummary.map((item) => (
              <div
                key={item.label}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: 12,
                  background: 'var(--color-bg-subtle)',
                }}
              >
                <div className="signal-muted" style={{ marginBottom: 4 }}>{item.label}</div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <TeamActionNotice team={team} locale={locale} />
          <TeamMembersList team={team} locale={locale} />

          <div className="team-actions">
            {team.canEdit ? (
              <Link href={teamEditHref} className="btn btn-primary btn-sm">
                {locale === 'ru' ? 'Редактировать команду' : 'Edit team'}
              </Link>
            ) : null}
            <Link href={teamOpenHref} className="btn btn-secondary btn-sm">
              {locale === 'ru' ? 'Открыть рабочую область' : 'Open workspace'}
            </Link>
            {team.isCaptain && team.canManageMembers ? (
              <Link href={teamEditHref} className="btn btn-secondary btn-sm">
                {locale === 'ru' ? 'Управлять составом' : 'Manage roster'}
              </Link>
            ) : null}
          </div>
        </>
      )}
    </Panel>
  );
}
