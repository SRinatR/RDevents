'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { resolveMediaUrl, shouldDisableNextImageOptimization } from '@/lib/media-url';

type MediaPreviewProps = {
  publicUrl?: string | null;
  storageKey?: string | null;
  kind: 'image' | 'video';
  alt: string;
  className?: string;
  sizes?: string;
  controls?: boolean;
  onOpen?: () => void;
};

export function MediaPreview({
  publicUrl,
  storageKey,
  kind,
  alt,
  className,
  sizes = '320px',
  controls = true,
  onOpen,
}: MediaPreviewProps) {
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => resolveMediaUrl(publicUrl, storageKey), [publicUrl, storageKey]);

  if (!src || failed) {
    return (
      <div className={className ?? 'media-preview-fallback'}>
        <div className="media-preview-fallback-inner">
          <strong>Превью недоступно</strong>
          <span>{alt}</span>
          {src ? (
            <a href={src} target="_blank" rel="noreferrer">
              Открыть файл
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <video
        className={className}
        src={src}
        controls={controls}
        preload="metadata"
        onError={() => setFailed(true)}
        aria-label={alt}
      />
    );
  }

  const image = (
    <Image
      className={className}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      unoptimized={shouldDisableNextImageOptimization(src)}
      onError={() => setFailed(true)}
      style={{ objectFit: 'cover' }}
    />
  );

  if (!onOpen) return image;

  return (
    <button className="media-preview-open-button" type="button" onClick={onOpen} aria-label={alt}>
      {image}
    </button>
  );
}
