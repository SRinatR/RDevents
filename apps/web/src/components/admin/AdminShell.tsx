import { AdminSidebar } from './AdminSidebar';
import type { ReactNode } from 'react';

interface AdminShellProps {
  locale: string;
  children: ReactNode;
}

export function AdminShell({ locale, children }: AdminShellProps) {
  return (
    <div className="admin-frame">
      <AdminSidebar locale={locale} />
      <div className="admin-content">
        {children}
      </div>
    </div>
  );
}
