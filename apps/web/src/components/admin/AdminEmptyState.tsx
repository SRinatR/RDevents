import type { ReactNode } from 'react';

interface AdminEmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AdminEmptyState({ title, description, icon, actions, className }: AdminEmptyStateProps) {
  return (
    <div className={`signal-empty-state admin-empty-state ${className ?? ''}`}>
      {icon && <div className="admin-empty-state-icon">{icon}</div>}
      <h3 className="admin-empty-state-title">{title}</h3>
      <p className="admin-empty-state-description">{description}</p>
      {actions && <div className="signal-empty-actions admin-empty-state-actions">{actions}</div>}
    </div>
  );
}

// Default icon for empty states (envelope icon)
export function AdminEmptyStateEmailIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

// Default icon for empty states (list icon)
export function AdminEmptyStateListIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}