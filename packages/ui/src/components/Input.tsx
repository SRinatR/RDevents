import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, style, ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '0.9rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...rest}
        style={{
          width: '100%',
          height: 44,
          padding: '0 14px',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
          background: 'var(--color-surface-strong)',
          color: 'var(--color-text-primary)',
          fontSize: '1rem',
          outline: 'none',
          transition: 'border-color var(--transition-fast)',
          ...style,
        }}
      />
      {error && (
        <span style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>{error}</span>
      )}
      {hint && !error && (
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{hint}</span>
      )}
    </div>
  );
}
