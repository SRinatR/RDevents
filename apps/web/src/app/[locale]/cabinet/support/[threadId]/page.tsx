import { redirect } from 'next/navigation';

export default async function LegacyCabinetSupportThreadPage({
  params,
}: { params: Promise<{ locale: string; threadId: string }> }) {
  const { locale, threadId } = await params;
  redirect(`/${locale}/cabinet/technical-support/${threadId}`);
}
