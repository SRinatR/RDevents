import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AdminDataTableProps {
  children: ReactNode;
  className?: string;
  minWidth?: number;
}

export function AdminDataTable({ children, className, minWidth = 860 }: AdminDataTableProps) {
  return (
    <div className={cn('admin-data-table admin-table-scroll', className)}>
      <table className="signal-table admin-table" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

interface AdminDataTableHeaderProps {
  columns: Array<{ label: string; align?: 'left' | 'right' | 'center'; width?: string }>;
}

export function AdminDataTableHeader({ columns }: AdminDataTableHeaderProps) {
  return (
    <thead>
      <tr>
        {columns.map((col, index) => (
          <th
            key={`${col.label}-${index}`}
            className={col.align ? `align-${col.align}` : undefined}
            style={col.width ? { width: col.width } : undefined}
          >
            {col.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

interface AdminDataTableBodyProps {
  children: ReactNode;
}

export function AdminDataTableBody({ children }: AdminDataTableBodyProps) {
  return <tbody>{children}</tbody>;
}

interface AdminDataTableRowProps {
  children: ReactNode;
  onClick?: () => void;
}

export function AdminDataTableRow({ children, onClick }: AdminDataTableRowProps) {
  return (
    <tr onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {children}
    </tr>
  );
}

interface AdminDataTableCellProps {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  truncate?: boolean;
  className?: string;
}

export function AdminDataTableCell({ children, align, truncate, className }: AdminDataTableCellProps) {
  return (
    <td
      className={cn(
        truncate && 'admin-table-truncate',
        align && `align-${align}`,
        className,
      )}
    >
      {children}
    </td>
  );
}

export function AdminTableCellMain({
  title,
  subtitle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="admin-table-cell-main">
      <div className="admin-table-cell-title">{title}</div>
      {subtitle ? <div className="admin-table-cell-subtitle">{subtitle}</div> : null}
    </div>
  );
}

export function AdminTableActions({ children }: { children: ReactNode }) {
  return <div className="admin-table-actions">{children}</div>;
}
