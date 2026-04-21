import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--color-primary)',
    color: '#fff',
    border: '1px solid color-mix(in srgb, var(--color-primary) 72%, #ffffff 28%)',
  },
  secondary: {
    background: 'color-mix(in srgb, var(--color-surface-elevated) 88%, #ffffff 12%)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-soft)',
  },
  danger: {
    background: 'var(--color-danger)',
    color: '#fff',
    border: '1px solid color-mix(in srgb, var(--color-danger) 76%, #ffffff 24%)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    border: '1px solid transparent',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { minHeight: 34, padding: '0 14px', fontSize: '0.825rem' },
  md: { minHeight: 44, padding: '0 20px', fontSize: '0.94rem' },
  lg: { minHeight: 52, padding: '0 28px', fontSize: '0.99rem' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 'var(--radius-lg)',
        fontWeight: 680,
        letterSpacing: '0.01em',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        transition: 'transform var(--transition-fast), background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast)',
        boxShadow: variant === 'primary' ? 'var(--shadow-primary)' : 'var(--shadow-xs)',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
    >
      {loading ? '...' : children}
    </button>
  );
}
