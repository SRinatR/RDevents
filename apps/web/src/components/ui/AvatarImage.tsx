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
      <span className={className} aria-hidden="true">
        {fallback.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <span className={className}>
      <AppImage src={src} alt={alt} width={size} height={size} />
    </span>
  );
}
