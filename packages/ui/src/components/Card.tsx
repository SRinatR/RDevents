import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  hoverable?: boolean;
  padding?: number | string;
}

export function Card({
  children,
  style,
  onClick,
  hoverable = false,
  padding = 24,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding,
        borderRadius: 'var(--radius-2xl)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-sm)',
        cursor: onClick ? 'pointer' : 'default',
        transition: hoverable ? 'transform 180ms ease, box-shadow 180ms ease' : undefined,
        ...style,
      }}
      onMouseEnter={hoverable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
      } : undefined}
      onMouseLeave={hoverable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
      } : undefined}
    >
      {children}
    </div>
  );
}
