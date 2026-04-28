import type { ReactNode } from 'react';
import { CabinetShell } from '@/components/layout/CabinetShell';

type CabinetLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function CabinetLayout({ children, params }: CabinetLayoutProps) {
  const { locale } = await params;
  return <CabinetShell locale={locale}>{children}</CabinetShell>;
}
