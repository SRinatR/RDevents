import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/ui/signal-primitives';
import { ProfileSectionNav } from './ProfileSectionNav';
import type { ProfileSectionKey, ProfileSectionState } from './profile.types';

type ProfileWorkspaceShellProps = {
  locale: string;
  sections: ProfileSectionState[];
  activeSection: ProfileSectionKey;
  onSectionChange: (section: ProfileSectionKey) => void;
  children: ReactNode;
};

export function ProfileWorkspaceShell({
  locale,
  sections,
  activeSection,
  onSectionChange,
  children,
}: ProfileWorkspaceShellProps) {
  const completed = sections.filter((section) => section.status === 'COMPLETED').length;
  const total = sections.length || 1;

  return (
    <div className="profile-workspace">
      <div className="profile-canvas">
        <header className="profile-workspace-topbar">
          <div>
            <h1 className="profile-workspace-title">{locale === 'ru' ? 'Профиль' : 'Profile'}</h1>
            <p className="profile-workspace-subtitle">
              {locale === 'ru'
                ? 'Личные данные, документы и готовность к участию'
                : 'Personal data, documents, and participation readiness'}
            </p>
          </div>
          <div className="profile-readiness-card" aria-label={locale === 'ru' ? 'Готовность профиля' : 'Profile readiness'}>
            <strong>{completed}/{total}</strong>
            <span>{locale === 'ru' ? 'разделов готово' : 'sections ready'}</span>
            <StatusBadge tone={completed === total ? 'success' : 'info'} size="sm">
              {Math.round((completed / total) * 100)}%
            </StatusBadge>
          </div>
        </header>

        <div className="profile-workspace-grid">
          <ProfileSectionNav
            locale={locale}
            sections={sections}
            activeSection={activeSection}
            onSectionChange={onSectionChange}
          />
          <div className="profile-section-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
