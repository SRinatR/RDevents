import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

function DefaultIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="32" height="24" rx="3" />
      <path d="M14 20h12M14 26h6" />
    </svg>
  );
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="admin-empty">
      <div className="admin-empty-icon">
        {icon ?? <DefaultIcon />}
      </div>
      <p className="admin-empty-title">{title}</p>
      {description && <p className="admin-empty-desc">{description}</p>}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}
