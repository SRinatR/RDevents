import type { ReactNode } from 'react';

interface AdminToolbarProps {
  children: ReactNode;
  className?: string;
}

export function AdminToolbar({ children, className }: AdminToolbarProps) {
  return (
    <div className={`signal-toolbar-row admin-toolbar ${className ?? ''}`}>
      {children}
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
      className="signal-field admin-toolbar-search"
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
      className={`signal-field signal-select admin-toolbar-select ${className ?? ''}`}
    >
      {children}
    </select>
  );
}