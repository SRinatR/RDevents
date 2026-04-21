import { cn } from '@/lib/utils';
import type { ProfileSectionKey, ProfileSectionState } from './profile.types';

type ProfileSectionNavProps = {
  locale: string;
  sections: ProfileSectionState[];
  activeSection: ProfileSectionKey;
  requiredSectionCounts?: Partial<Record<ProfileSectionKey, number>>;
  onSectionChange: (section: ProfileSectionKey) => void;
};

export function ProfileSectionNav({
  locale,
  sections,
  activeSection,
  requiredSectionCounts,
  onSectionChange,
}: ProfileSectionNavProps) {
  return (
    <nav className="profile-section-tabs" role="tablist" aria-label={locale === 'ru' ? 'Вкладки профиля' : 'Profile tabs'}>
      {sections.map((section) => {
        const isActive = activeSection === section.key;
        const requiredCount = requiredSectionCounts?.[section.key] ?? 0;
        return (
          <button
            key={section.key}
            type="button"
            role="tab"
            className={cn('profile-section-tab', isActive && 'active', requiredCount > 0 && 'has-required')}
            onClick={() => onSectionChange(section.key)}
            aria-selected={isActive}
          >
            <strong className="profile-section-tab-title">{section.title}</strong>
            {requiredCount > 0 ? (
              <span className="profile-section-required-badge">
                {locale === 'ru' ? `Нужно: ${requiredCount}` : `Required: ${requiredCount}`}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
