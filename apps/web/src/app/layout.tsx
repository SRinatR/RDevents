import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Русский Дом — Найди и создай мероприятия',
    template: '%s · Русский Дом',
  },
  description: 'Платформа для поиска и организации мероприятий. Публичный каталог, регистрация участников, аналитика и панель управления в одном продукте.',
  keywords: ['мероприятия', 'русский дом', 'регистрация', 'события', 'аналитика'],
  authors: [{ name: 'Русский Дом' }],
  openGraph: {
    title: 'Русский Дом — Найди и создай мероприятия',
    description: 'Платформа для поиска и организации мероприятий.',
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
    <html lang="ru" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
