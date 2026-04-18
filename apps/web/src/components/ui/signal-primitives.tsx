import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type HeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="signal-page-header">
      <div>
        <h1 className="signal-page-title">{title}</h1>
        {subtitle ? <p className="signal-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="signal-page-actions">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="signal-section-header signal-section-header-block">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="signal-page-actions">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  className,
  children,
  variant = 'default',
  ...props
}: {
  className?: string;
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'subtle';
} & HTMLAttributes<HTMLElement>) {
  return <section className={cn('signal-panel', `signal-panel-${variant}`, className)} {...props}>{children}</section>;
}

export function MetricCard({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }) {
  return (
    <div className={cn('signal-metric-card', `tone-${tone}`)}>
      <div className="signal-metric-label">{label}</div>
      <div className="signal-metric-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function ToolbarRow({ children }: { children: ReactNode }) {
  return <div className="signal-toolbar-row">{children}</div>;
}

export function FieldInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('signal-field', props.className)} />;
}

export function FieldTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('signal-field signal-textarea', props.className)} />;
}

export function FieldSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn('signal-field signal-select', props.className)} />;
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="signal-table-shell">{children}</div>;
}

export function LoadingLines({ rows = 4 }: { rows?: number }) {
  return (
    <div className="signal-loading-lines motion-fade-up-fast" role="status" aria-live="polite" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="signal-loading-line" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="signal-empty-state motion-fade-up-fast">
      <h3>{title}</h3>
      <p>{description}</p>
      {actions ? <div className="signal-empty-actions">{actions}</div> : null}
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: Exclude<StatusTone, 'neutral'> }) {
  return <div className={cn('signal-notice motion-fade-up-fast', `tone-${tone}`)} role={tone === 'danger' ? 'alert' : 'status'}>{children}</div>;
}
