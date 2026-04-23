import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import { getWebReleaseSha } from '@/lib/release';

export const metadata: Metadata = {
  title: {
    default: 'Русский Дом в Ташкенте',
    template: '%s · Русский Дом',
  },
  description: 'Платформа для поиска и организации мероприятий. Публичный каталог, регистрация участников, аналитика и панель управления в одном продукте.',
  keywords: ['мероприятия', 'русский дом', 'регистрация', 'события', 'аналитика'],
  authors: [{ name: 'Русский Дом' }],
  openGraph: {
    title: 'Русский Дом в Ташкенте',
    description: 'Платформа для поиска и организации мероприятий.',
    type: 'website',
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
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
  const releaseSha = getWebReleaseSha();

  return (
    <html lang="ru" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="app-release-sha" content={releaseSha} />
      </head>
      <body>{children}</body>
    </html>
  );
}
