import { StatusBadge } from '@/components/ui/signal-primitives';
import { cn } from '@/lib/utils';
import { PROFILE_STATUS_COPY, getLocaleKey } from './profile.config';
import type { ProfileSectionKey, ProfileSectionState } from './profile.types';

type ProfileSectionNavProps = {
  locale: string;
  sections: ProfileSectionState[];
  activeSection: ProfileSectionKey;
  onSectionChange: (section: ProfileSectionKey) => void;
};

export function ProfileSectionNav({
  locale,
  sections,
  activeSection,
  onSectionChange,
}: ProfileSectionNavProps) {
  const localeKey = getLocaleKey(locale);

  return (
    <nav className="profile-section-tabs" role="tablist" aria-label={locale === 'ru' ? 'Вкладки профиля' : 'Profile tabs'}>
      {sections.map((section) => {
        const statusCopy = PROFILE_STATUS_COPY[section.status];
        const isActive = activeSection === section.key;
        return (
          <button
            key={section.key}
            type="button"
            role="tab"
            className={cn('profile-section-tab', isActive && 'active')}
            onClick={() => onSectionChange(section.key)}
            aria-selected={isActive}
          >
            <strong className="profile-section-tab-title">{section.title}</strong>
            <StatusBadge tone={statusCopy.tone} size="sm">{statusCopy.label[localeKey]}</StatusBadge>
          </button>
        );
      })}
    </nav>
  );
}
