'use client';

import Link from 'next/link';
import { Panel, SectionHeader } from '@/components/ui/signal-primitives';
import type { InvitationData } from './dashboard.types';

interface CabinetInvitationsCardProps {
  invitations?: InvitationData[];
  locale: string;
}

export function CabinetInvitationsCard({ invitations, locale }: CabinetInvitationsCardProps) {
  if (!invitations || invitations.length === 0) {
    return null;
  }

  return (
    <Panel className="invitations-panel">
      <SectionHeader 
        title={locale === 'ru' ? 'Приглашения' : 'Invitations'}
        actions={
          <span className="badge-count">{invitations.length}</span>
        }
      />
      
      <div className="invitations-list">
        {invitations.map((inv) => (
          <div key={inv.id} className="invitation-item">
            <div className="invitation-icon">📬</div>
            <div className="invitation-content">
              <span className="invitation-team">{inv.teamName}</span>
              <span className="invitation-meta">
                {locale === 'ru' ? 'от' : 'from'} {inv.invitedBy}
              </span>
            </div>
            <Link 
              href={`/${locale}/cabinet/team-invitations?accept=${inv.id}`}
              className="btn btn-primary btn-sm"
            >
              {locale === 'ru' ? 'Принять' : 'Accept'}
            </Link>
          </div>
        ))}
      </div>
    </Panel>
  );
}
