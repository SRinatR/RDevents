'use client';

import { AppImage } from './AppImage';

interface AvatarImageProps {
  src?: string | null;
  alt?: string;
  fallback: string;
  size?: number;
  className?: string;
}

export function AvatarImage({
  src,
  alt = '',
  fallback,
  size = 40,
  className,
}: AvatarImageProps) {
  if (!src) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--color-bg-secondary, #f3f4f6)',
          color: 'var(--color-text-secondary, #6b7280)',
          fontSize: size * 0.4,
          fontWeight: 600,
        }}
        aria-hidden="true"
      >
        {fallback.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
      }}
    >
      <AppImage
        src={src}
        alt={alt}
        width={size}
        height={size}
      />
    </span>
  );
}