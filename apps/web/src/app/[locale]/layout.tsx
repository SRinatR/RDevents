import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AuthProvider } from '../../hooks/useAuth';
import { Navbar } from '../../components/layout/Navbar';
import { FloatingSupportLauncher } from '../../components/layout/FloatingSupportLauncher';

const SUPPORTED_LOCALES = ['en', 'ru'] as const;

type LocaleLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(SUPPORTED_LOCALES, locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthProvider>
        <div className="app-shell app-shell-public" data-shell="public">
          <Navbar locale={locale} />
          <div className="app-shell-main app-shell-main-public">{children}</div>
          <FloatingSupportLauncher locale={locale} />
        </div>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
