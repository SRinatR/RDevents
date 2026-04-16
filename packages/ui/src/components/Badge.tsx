import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: React.CSSProperties;
}

const colors: Record<BadgeVariant, { bg: string; color: string }> = {
  default: { bg: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' },
  success: { bg: 'var(--color-success-subtle)', color: 'var(--color-success)' },
  warning: { bg: 'var(--color-warning-subtle)', color: 'var(--color-warning)' },
  danger: { bg: 'var(--color-danger-subtle)', color: 'var(--color-danger)' },
  info: { bg: 'var(--color-info-subtle)', color: 'var(--color-info)' },
  accent: { bg: 'var(--color-primary-subtle)', color: 'var(--color-primary)' },
};

export function Badge({ children, variant = 'default', style }: BadgeProps) {
  const { bg, color } = colors[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 'var(--radius-full)',
        border: '1px solid color-mix(in srgb, currentColor 18%, #ffffff 82%)',
        fontSize: '0.74rem',
        fontWeight: 680,
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
