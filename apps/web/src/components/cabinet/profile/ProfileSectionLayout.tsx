import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/ui/signal-primitives';
import { PROFILE_STATUS_COPY, getLocaleKey } from './profile.config';
import type { ProfileSectionStatus } from './profile.types';

type ProfileSectionLayoutProps = {
  locale: string;
  title: string;
  description: string;
  status?: ProfileSectionStatus;
  children: ReactNode;
};

export function ProfileSectionLayout({
  locale,
  title,
  description,
  status = 'NOT_STARTED',
  children,
}: ProfileSectionLayoutProps) {
  const localeKey = getLocaleKey(locale);
  const statusCopy = PROFILE_STATUS_COPY[status];

  return (
    <section className="profile-section-panel">
      <header className="profile-section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <StatusBadge tone={statusCopy.tone}>{statusCopy.label[localeKey]}</StatusBadge>
      </header>
      {children}
    </section>
  );
}
