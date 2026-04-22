'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { RoleBadge, StatusBadge } from './status-badge';

interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatar?: string;
}

interface TeamCardProps {
  team: {
    id: string;
    name: string;
    status: string;
    isCaptain: boolean;
    membersCount: number;
    maxMembers?: number;
    members?: TeamMember[];
    pendingInvites?: number;
    canEdit: boolean;
  } | null;
  eventSlug: string;
  locale: string;
  registrationStatus?: string;
}

function Avatar({ name, src }: { name: string; src?: string }) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return (
      <Image 
        src={src} 
        alt={name} 
        width={40}
        height={40}
        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
      />
    );
  }

  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm border-2 border-white shadow-sm">
      {initials}
    </div>
  );
}

export function TeamCard({ team, eventSlug, locale, registrationStatus }: TeamCardProps) {
  const t = useTranslations();

  if (!team) {
    return (
      <div className="dashboard-card-empty">
        <div className="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <h3 className="empty-state-title">
          {locale === 'ru' ? 'Вы пока не состоите в команде' : 'You are not in a team yet'}
        </h3>
        <p className="empty-state-description">
          {locale === 'ru' 
            ? 'Создайте команду или вступите по приглашению' 
            : 'Create a team or join via invitation'}
        </p>
        <div className="empty-state-actions">
          <Link href={`/${locale}/events/${eventSlug}?action=create-team`} className="btn btn-primary">
            {locale === 'ru' ? 'Создать команду' : 'Create team'}
          </Link>
          <Link href={`/${locale}/events/${eventSlug}?action=join-team`} className="btn btn-secondary">
            {locale === 'ru' ? 'Присоединиться' : 'Join team'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card-full">
      <div className="card-header">
        <div className="card-title-group">
          <h3 className="card-title">
            {locale === 'ru' ? 'Моя команда' : 'My team'}
          </h3>
          <span className="team-name-large">{team.name}</span>
        </div>
        <div className="card-status-group">
          <StatusBadge status={team.status} type="team" size="sm" />
          <span className="members-count">
            {team.membersCount}{team.maxMembers ? ` / ${team.maxMembers}` : ''} {locale === 'ru' ? 'участников' : 'members'}
          </span>
        </div>
      </div>

      {team.members && team.members.length > 0 && (
        <div className="members-list">
          {team.members.map((member, idx) => (
            <div key={member.userId} className="member-row">
              <Avatar name={member.name} src={member.avatar} />
              <div className="member-info">
                <span className="member-name">{member.name}</span>
                <span className="member-status">{member.status}</span>
              </div>
              <div className="member-role">
                <RoleBadge role={member.role} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}

      {team.pendingInvites && team.pendingInvites > 0 && (
        <div className="pending-invites-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="23" y1="11" x2="17" y2="11" />
            <line x1="20" y1="8" x2="20" y2="14" />
          </svg>
          <span>
            {locale === 'ru' 
              ? `${team.pendingInvites} приглашение(й) ожидает ответа` 
              : `${team.pendingInvites} invitation(s) pending`}
          </span>
        </div>
      )}

      <div className="card-actions-grid">
        {team.canEdit && (
          <Link href={`/${locale}/cabinet/events/${eventSlug}/team`} className="btn btn-secondary">
            {locale === 'ru' ? 'Редактировать' : 'Edit'}
          </Link>
        )}
        <Link href={`/${locale}/events/${eventSlug}/team/${team.id}`} className="btn btn-secondary">
          {locale === 'ru' ? 'Открыть команду' : 'Open team'}
        </Link>
        {team.isCaptain && (
          <Link href={`/${locale}/events/${eventSlug}?action=invite`} className="btn btn-primary">
            {locale === 'ru' ? 'Пригласить' : 'Invite'}
          </Link>
        )}
      </div>
    </div>
  );
}