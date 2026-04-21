'use client';

import Link from 'next/link';
import { Panel, SectionHeader } from '@/components/ui/signal-primitives';

interface CabinetQuickLinksProps {
  locale: string;
}

const QUICK_LINKS = [
  { href: 'profile', labelKey: 'Профиль', labelKeyEn: 'Profile', icon: '👤' },
  { href: 'my-events', labelKey: 'Мои события', labelKeyEn: 'My events', icon: '📅' },
  { href: 'team-invitations', labelKey: 'Приглашения', labelKeyEn: 'Invitations', icon: '📬' },
  { href: 'support', labelKey: 'Поддержка', labelKeyEn: 'Support', icon: '💬' },
] as const;

export function CabinetQuickLinks({ locale }: CabinetQuickLinksProps) {
  return (
    <Panel className="quick-links-panel">
      <SectionHeader title={locale === 'ru' ? 'Быстрые ссылки' : 'Quick links'} />
      
      <div className="quick-links-grid">
        {QUICK_LINKS.map((link) => (
          <Link 
            key={link.href} 
            href={`/${locale}/cabinet/${link.href}`} 
            className="quick-link-item"
          >
            <span>{link.icon}</span>
            <span>{locale === 'ru' ? link.labelKey : link.labelKeyEn}</span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}
