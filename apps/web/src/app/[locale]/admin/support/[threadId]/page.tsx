import { redirect } from 'next/navigation';

export default async function LegacyAdminSupportThreadPage({
  params,
}: { params: Promise<{ locale: string; threadId: string }> }) {
  const { locale, threadId } = await params;
  redirect(`/${locale}/admin/technical-support/${threadId}`);
}
