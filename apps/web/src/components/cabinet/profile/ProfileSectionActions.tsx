import type { ReactNode } from 'react';

type ProfileSectionActionsProps = {
  locale: string;
  saving?: boolean;
  disabled?: boolean;
  saveLabel?: string;
  children?: ReactNode;
};

export function ProfileSectionActions({
  locale,
  saving = false,
  disabled = false,
  saveLabel,
  children,
}: ProfileSectionActionsProps) {
  return (
    <div className="profile-section-actions">
      {children}
      <button type="submit" className="btn btn-primary" disabled={disabled || saving}>
        {saving
          ? (locale === 'ru' ? 'Сохранение...' : 'Saving...')
          : saveLabel ?? (locale === 'ru' ? 'Сохранить раздел' : 'Save section')}
      </button>
    </div>
  );
}
