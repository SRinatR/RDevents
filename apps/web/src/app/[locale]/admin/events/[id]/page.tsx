import { redirect } from 'next/navigation';

export default async function AdminEventEntryPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  redirect(`/${locale}/admin/events/${id}/overview`);
}
