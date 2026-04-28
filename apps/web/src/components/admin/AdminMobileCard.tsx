import type { ReactNode } from 'react';

type AdminMobileCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  meta?: Array<{ label: ReactNode; value: ReactNode }>;
  actions?: ReactNode;
};

export function AdminMobileCard({
  title,
  subtitle,
  badge,
  meta = [],
  actions,
}: AdminMobileCardProps) {
  return (
    <article className="admin-mobile-card">
      <div className="admin-mobile-card-header">
        <div>
          <div className="admin-mobile-card-title">{title}</div>
          {subtitle ? <div className="admin-mobile-card-subtitle">{subtitle}</div> : null}
        </div>
        {badge ? <div>{badge}</div> : null}
      </div>

      {meta.length > 0 ? (
        <div className="admin-mobile-card-meta">
          {meta.map((item, index) => (
            <div className="admin-mobile-card-meta-row" key={index}>
              <span className="admin-mobile-card-meta-label">{item.label}</span>
              <span className="admin-mobile-card-meta-value">{item.value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {actions ? <div className="admin-mobile-card-actions">{actions}</div> : null}
    </article>
  );
}

export function AdminMobileList({ children }: { children: ReactNode }) {
  return <div className="admin-mobile-list">{children}</div>;
}
