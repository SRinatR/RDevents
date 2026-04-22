'use client';

import Image from 'next/image';

type AppImageProps =
  | {
      src: string;
      alt: string;
      width: number;
      height: number;
      className?: string;
      sizes?: string;
      priority?: boolean;
      unoptimized?: boolean;
    }
  | {
      src: string;
      alt: string;
      fill: true;
      className?: string;
      sizes?: string;
      priority?: boolean;
      unoptimized?: boolean;
    };

export function AppImage(props: AppImageProps) {
  return <Image {...props} />;
}
