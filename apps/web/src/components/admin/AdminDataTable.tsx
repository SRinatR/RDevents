import type { ReactNode } from 'react';

interface AdminDataTableProps {
  children: ReactNode;
  className?: string;
}

export function AdminDataTable({ children, className }: AdminDataTableProps) {
  return (
    <div className={`signal-table-shell admin-data-table ${className ?? ''}`}>
      <table className="signal-table admin-table">
        {children}
      </table>
    </div>
  );
}

interface AdminDataTableHeaderProps {
  columns: Array<{ label: string; align?: 'left' | 'right' | 'center' }>;
}

export function AdminDataTableHeader({ columns }: AdminDataTableHeaderProps) {
  return (
    <thead>
      <tr>
        {columns.map((col, index) => (
          <th key={index} className={col.align ? `align-${col.align}` : undefined}>
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
}

export function AdminDataTableCell({ children, align, truncate }: AdminDataTableCellProps) {
  return (
    <td className={`${truncate ? 'signal-overflow-ellipsis' : ''} ${align ? `align-${align}` : ''}`}>
      {children}
    </td>
  );
}