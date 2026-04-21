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

export function CabinetTeamCard({ team, event, locale }: CabinetTeamCardProps) {
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
            <span className="signal-muted team-count">
              {team.membersCount}
              {team.maxMembers ? ` / ${team.maxMembers}` : ''} 
              {' '}
              {locale === 'ru' ? 'участников' : 'members'}
            </span>
          </div>
          
          <TeamMembersList team={team} locale={locale} />
          
          {typeof team.pendingInvites === 'number' && team.pendingInvites > 0 && (
            <Notice tone="warning">
              {locale === 'ru' 
                ? `${team.pendingInvites} приглашение(й) ожидает ответа` 
                : `${team.pendingInvites} invitation(s) pending`}
            </Notice>
          )}
          
          <div className="team-actions">
            {team.canEdit && (
              <Link href={getTeamEditHref(event, locale)} className="btn btn-secondary btn-sm">
                {locale === 'ru' ? 'Редактировать' : 'Edit'}
              </Link>
            )}
            <Link href={`/${locale}/events/${event.slug}/team/${team.id}`} className="btn btn-secondary btn-sm">
              {locale === 'ru' ? 'Открыть' : 'Open'}
            </Link>
            {team.isCaptain && (
              <Link href={`/${locale}/events/${event.slug}?action=invite`} className="btn btn-primary btn-sm">
                {locale === 'ru' ? 'Пригласить' : 'Invite'}
              </Link>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
