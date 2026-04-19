import { cn } from '@/lib/utils';
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
  return (
    <nav className="profile-section-tabs" role="tablist" aria-label={locale === 'ru' ? 'Вкладки профиля' : 'Profile tabs'}>
      {sections.map((section) => {
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
            
          </button>
        );
      })}
    </nav>
  );
}
