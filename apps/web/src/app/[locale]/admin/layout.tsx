import { AdminShell } from '../../../components/admin/AdminShell';
import type { ReactNode } from 'react';

type AdminLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params;
  return (
    <AdminShell locale={locale}>
      {children}
    </AdminShell>
  );
}
