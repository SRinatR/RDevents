import type { ReactNode } from 'react';
import type { ProfileSectionStatus } from './profile.types';

type ProfileSectionLayoutProps = {
  locale: string;
  title: string;
  description: string;
  status?: ProfileSectionStatus;
  children: ReactNode;
};

export function ProfileSectionLayout({
  title,
  description,
  children,
}: ProfileSectionLayoutProps) {
  return (
    <section className="profile-section-panel">
      <header className="profile-section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}
