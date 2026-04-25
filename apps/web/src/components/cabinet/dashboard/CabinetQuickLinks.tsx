'use client';

import Link from 'next/link';
import { Panel, SectionHeader } from '@/components/ui/signal-primitives';

interface CabinetQuickLinksProps {
  locale: string;
}

const QUICK_LINKS = [
  { href: 'profile', labelKey: 'Профиль', labelKeyEn: 'Profile', icon: 'profile' },
  { href: 'applications', labelKey: 'Заявки', labelKeyEn: 'Applications', icon: 'applications' },
  { href: 'events', labelKey: 'Каталог', labelKeyEn: 'Catalog', icon: 'catalog' },
  { href: 'my-events', labelKey: 'Мои события', labelKeyEn: 'My events', icon: 'events' },
  { href: 'volunteer', labelKey: 'Волонтёрство', labelKeyEn: 'Volunteer', icon: 'volunteer' },
  { href: 'team-invitations', labelKey: 'Приглашения', labelKeyEn: 'Invitations', icon: 'invitations' },
  { href: 'support', labelKey: 'Поддержка', labelKeyEn: 'Support', icon: 'support' },
] as const;

function QuickLinkIcon({ name }: { name: typeof QUICK_LINKS[number]['icon'] }) {
  switch (name) {
    case 'profile':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>;
    case 'applications':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l2 2h3v16H4V5h3z" /><path d="M8 12h8" /><path d="M8 16h6" /></svg>;
    case 'catalog':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" /></svg>;
    case 'events':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M3 11h18" /></svg>;
    case 'volunteer':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.4-9-9.2C1.5 8 3.5 5 6.8 5c2 0 3.4 1.1 5.2 3.1C13.8 6.1 15.2 5 17.2 5c3.3 0 5.3 3 3.8 6.8C19 16.6 12 21 12 21z" /></svg>;
    case 'invitations':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></svg>;
    case 'support':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    default:
      return null;
  }
}

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
            <span className="quick-link-icon"><QuickLinkIcon name={link.icon} /></span>
            <span>{locale === 'ru' ? link.labelKey : link.labelKeyEn}</span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}
