import type { ReactNode } from 'react';
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
  const percent = Math.round((completed / total) * 100);

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
          <div className="profile-progress-card" aria-label={locale === 'ru' ? 'Готовность профиля' : 'Profile readiness'}>
            <div className="profile-progress-ring" style={{ background: `conic-gradient(var(--color-primary) ${percent}%, rgba(209, 218, 234, 0.9) 0)` }}>
              <div>
                <strong>{completed}/{total}</strong>
                <span>{percent}%</span>
              </div>
            </div>
            <div className="profile-progress-copy">
              <strong>{locale === 'ru' ? 'Готовность профиля' : 'Profile readiness'}</strong>
              <span>{locale === 'ru' ? 'разделов готово' : 'sections ready'}</span>
              <div className="profile-progress-track">
                <i style={{ width: `${percent}%` }} />
              </div>
            </div>
          </div>
        </header>

        <ProfileSectionNav
          locale={locale}
          sections={sections}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
        />

        <div className="profile-workspace-grid">
          <div className="profile-section-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
