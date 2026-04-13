import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: React.CSSProperties;
}

const colors: Record<BadgeVariant, { bg: string; color: string }> = {
  default: { bg: 'rgba(100,116,139,0.12)', color: 'var(--color-text-muted)' },
  success: { bg: 'rgba(22,163,74,0.12)', color: 'var(--color-success)' },
  warning: { bg: 'rgba(217,119,6,0.12)', color: 'var(--color-warning)' },
  danger: { bg: 'rgba(220,38,38,0.12)', color: 'var(--color-danger)' },
  info: { bg: 'rgba(2,132,199,0.12)', color: 'var(--color-info)' },
  accent: { bg: 'rgba(28,100,242,0.1)', color: 'var(--color-primary)' },
};

export function Badge({ children, variant = 'default', style }: BadgeProps) {
  const { bg, color } = colors[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 'var(--radius-lg)',
        fontSize: '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.02em',
        background: bg,
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
