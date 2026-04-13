import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  icon?: string;
  accent?: boolean;
}

export function StatCard({ label, value, delta, icon, accent = false }: StatCardProps) {
  return (
    <div
      style={{
        padding: 22,
        borderRadius: 'var(--radius-2xl)',
        border: '1px solid var(--color-border)',
        background: accent
          ? 'linear-gradient(135deg, rgba(28,100,242,0.08), rgba(220,38,38,0.05))'
          : 'var(--color-surface)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
          {label}
        </span>
        {icon && (
          <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{icon}</span>
        )}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: '2rem',
          fontWeight: 900,
          letterSpacing: 0,
          color: 'var(--color-text-primary)',
        }}
      >
        {value}
      </div>
      {delta && (
        <div style={{ marginTop: 6, fontSize: '0.85rem', color: 'var(--color-success)' }}>
          {delta}
        </div>
      )}
    </div>
  );
}
