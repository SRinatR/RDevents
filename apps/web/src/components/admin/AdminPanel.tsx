import type { ReactNode } from 'react';

interface AdminPanelProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  noPad?: boolean;
}

export function AdminPanel({ title, action, children, noPad }: AdminPanelProps) {
  return (
    <div className="admin-panel">
      {title && (
        <div className="admin-panel-header">
          <span className="admin-panel-title">{title}</span>
          {action}
        </div>
      )}
      {noPad ? children : <div className="admin-panel-body">{children}</div>}
    </div>
  );
}
