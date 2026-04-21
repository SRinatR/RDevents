import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'ru'] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = 'ru';

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;

  const locale = hasLocale(locales, requestedLocale)
    ? requestedLocale
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});