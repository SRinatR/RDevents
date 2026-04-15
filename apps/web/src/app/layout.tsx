import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'EventPlatform — Find & Create Amazing Events',
    template: '%s · EventPlatform',
  },
  description: 'Discover, join, and manage events with ease. EventPlatform combines public listings, registration, analytics, and an admin panel in one product.',
  keywords: ['events', 'platform', 'registration', 'community', 'analytics'],
  authors: [{ name: 'EventPlatform Team' }],
  openGraph: {
    title: 'EventPlatform — Find & Create Amazing Events',
    description: 'Discover, join, and manage events with ease.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
