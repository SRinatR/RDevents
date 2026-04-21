'use client';

import Link from 'next/link';
import { Panel, SectionHeader } from '@/components/ui/signal-primitives';
import { QUICK_ACTION_CONFIG, getQuickActionLabel, getQuickActionIcon } from './dashboard.formatters';
import type { DashboardEventData, QuickAction } from './dashboard.types';

interface CabinetQuickActionsProps {
  quickActions: QuickAction[];
  event: DashboardEventData;
  locale: string;
}

function getActionHref(action: QuickAction, event: DashboardEventData, locale: string): string {
  switch (action) {
    case 'OPEN_PROFILE_REQUIREMENTS':
      return `/${locale}/cabinet/profile?event=${event.slug}`;
    case 'COMPLETE_EVENT_FORM':
      return `/${locale}/cabinet/events/${event.slug}/application`;
    case 'ACCEPT_TEAM_INVITATION':
      return `/${locale}/cabinet/team-invitations`;
    case 'CREATE_OR_JOIN_TEAM':
      return `/${locale}/events/${event.slug}?action=join-team`;
    case 'OPEN_TEAM':
      return event.team ? `/${locale}/events/${event.slug}/team/${event.team.id}` : '#';
    case 'EDIT_TEAM':
      return `/${locale}/cabinet/events/${event.slug}?team=edit`;
    case 'OPEN_CALENDAR':
      return `/api/events/${event.slug}/ics`;
    case 'OPEN_SUPPORT':
      return `/${locale}/cabinet/support`;
    default:
      return '#';
  }
}

function isHighPriority(action: QuickAction): boolean {
  return (
    action === 'OPEN_PROFILE_REQUIREMENTS' ||
    action === 'COMPLETE_EVENT_FORM' ||
    action === 'ACCEPT_TEAM_INVITATION' ||
    action === 'CREATE_OR_JOIN_TEAM'
  );
}

export function CabinetQuickActions({ quickActions, event, locale }: CabinetQuickActionsProps) {
  if (!quickActions || quickActions.length === 0) {
    return null;
  }

  return (
    <Panel className="quick-actions-panel">
      <SectionHeader title={locale === 'ru' ? 'Что сделать' : 'What to do'} />
      
      <div className="quick-actions-list">
        {quickActions.map((action) => {
          const label = getQuickActionLabel(action, locale);
          const icon = getQuickActionIcon(action);
          const href = getActionHref(action, event, locale);
          const isCalendar = action === 'OPEN_CALENDAR';
          const priority = isHighPriority(action) ? 'priority-high' : '';
          
          const linkProps = isCalendar 
            ? { target: '_blank' as const, rel: 'noopener noreferrer' as const }
            : {};

          return (
            <Link 
              key={action}
              href={href}
              className={`quick-action-item ${priority}`}
              {...linkProps}
            >
              <span className="quick-action-icon">{icon}</span>
              <span className="quick-action-label">{label}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="quick-action-arrow">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}
