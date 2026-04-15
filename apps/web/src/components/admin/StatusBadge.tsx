type StatusVariant = 'PUBLISHED' | 'DRAFT' | 'CANCELLED' | 'COMPLETED' | string;

const statusMap: Record<string, { cls: string; label: string }> = {
  PUBLISHED: { cls: 'status-published',  label: 'Published'  },
  DRAFT:     { cls: 'status-draft',      label: 'Draft'      },
  CANCELLED: { cls: 'status-cancelled',  label: 'Cancelled'  },
  COMPLETED: { cls: 'status-completed',  label: 'Completed'  },
};

interface StatusBadgeProps {
  status: StatusVariant;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { cls, label } = statusMap[status] ?? { cls: 'status-draft', label: status };
  return (
    <span className={`status-badge ${cls}`}>
      <span className="status-dot" />
      {label}
    </span>
  );
}
