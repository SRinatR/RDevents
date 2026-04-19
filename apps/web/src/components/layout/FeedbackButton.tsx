'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export function FeedbackButton({ locale }: { locale: string }) {
  const { user } = useAuth();
  const supportPath = `/${locale}/cabinet/support?new=1`;
  const href = user
    ? supportPath
    : `/${locale}/login?next=${encodeURIComponent(supportPath)}`;

  return (
    <Link href={href} className="btn btn-secondary btn-sm public-footer-feedback">
      {locale === 'ru' ? 'Обратная связь' : 'Feedback'}
    </Link>
  );
}
