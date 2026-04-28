import type { ReactNode } from 'react';
import { PublicShell } from '@/components/layout/PublicShell';

type PublicLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function PublicLayout({ children, params }: PublicLayoutProps) {
  const { locale } = await params;
  return <PublicShell locale={locale}>{children}</PublicShell>;
}
