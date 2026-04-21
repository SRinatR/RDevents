import { redirect } from 'next/navigation';

export default async function LegacyCabinetSupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/cabinet/technical-support`);
}
