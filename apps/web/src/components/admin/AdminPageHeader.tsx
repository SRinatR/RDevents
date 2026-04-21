import type { ReactNode } from 'react';

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AdminPageHeader({ title, subtitle, actions }: AdminPageHeaderProps) {
  return (
    <div className="signal-page-header admin-page-header">
      <div className="admin-page-header-content">
        <div>
          <h1 className="signal-page-title admin-page-title">{title}</h1>
          {subtitle && <p className="signal-page-subtitle admin-page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="signal-page-actions admin-page-actions">{actions}</div>}
      </div>
    </div>
  );
}