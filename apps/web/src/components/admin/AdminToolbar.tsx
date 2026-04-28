import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AdminToolbarProps {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AdminToolbar({ children, actions, className }: AdminToolbarProps) {
  return (
    <div className={cn('admin-toolbar', className)}>
      {children}
      {actions ? <div className="admin-toolbar-actions">{actions}</div> : null}
    </div>
  );
}

// Helper components for toolbar
export function AdminToolbarSearch({
  value,
  onChange,
  placeholder = 'Search...',
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="signal-field admin-toolbar-search admin-filter-search"
    />
  );
}

export function AdminToolbarSelect({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={cn('signal-field signal-select admin-toolbar-select admin-filter-select', className)}
    >
      {children}
    </select>
  );
}
