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
    <nav className="profile-section-nav" aria-label={locale === 'ru' ? 'Разделы профиля' : 'Profile sections'}>
      {sections.map((section) => {
        const statusCopy = PROFILE_STATUS_COPY[section.status];
        const isActive = activeSection === section.key;
        return (
          <button
            key={section.key}
            type="button"
            className={cn('profile-section-nav-item', isActive && 'active')}
            onClick={() => onSectionChange(section.key)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span>
              <strong>{section.title}</strong>
              {section.description ? <small>{section.description}</small> : null}
            </span>
            <StatusBadge tone={statusCopy.tone} size="sm">{statusCopy.label[localeKey]}</StatusBadge>
          </button>
        );
      })}
    </nav>
  );
}
