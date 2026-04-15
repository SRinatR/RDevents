import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="admin-section-header">
      <span className="admin-section-title">{title}</span>
      {action}
    </div>
  );
}
