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

function TeamAvatar({ name, src }: { name: string; src?: string | null }) {
  const initials = name
    .split(' ')
    .map(n => n[0])
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

  const displayedMembers = team.members.slice(0, 5);
  const remainingCount = team.members.length - 5;

  return (
    <div className="team-members-list">
      {displayedMembers.map((member) => (
        <div key={member.userId} className="team-member-row">
          <TeamAvatar name={member.name} src={member.avatar} />
          <div className="team-member-info">
            <span className="team-member-name">{member.name || member.email}</span>
            <RoleBadge role={member.role} size="sm" />
          </div>
        </div>
      ))}
      {remainingCount > 0 && (
        <p className="signal-muted team-members-more">
          +{remainingCount} {locale === 'ru' ? 'ещё' : 'more'}
        </p>
      )}
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
          
          {team.pendingInvites && team.pendingInvites > 0 && (
            <Notice tone="warning">
              {locale === 'ru' 
                ? `${team.pendingInvites} приглашение(й) ожидает ответа` 
                : `${team.pendingInvites} invitation(s) pending`}
            </Notice>
          )}
          
          <div className="team-actions">
            {team.canEdit && (
              <Link href={`/${locale}/cabinet/events/${event.slug}`} className="btn btn-secondary btn-sm">
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
