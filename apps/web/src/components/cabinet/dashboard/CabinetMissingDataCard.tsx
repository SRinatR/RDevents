'use client';

import Link from 'next/link';
import { Panel, SectionHeader, Notice } from '@/components/ui/signal-primitives';
import type { DashboardEventData } from './dashboard.types';

interface CabinetMissingDataCardProps {
  missingFields: string[];
  event: DashboardEventData;
  locale: string;
}

export function CabinetMissingDataCard({ missingFields, event, locale }: CabinetMissingDataCardProps) {
  const hasMissingFields = missingFields && missingFields.length > 0;

  return (
    <Panel className="missing-data-panel">
      <SectionHeader 
        title={locale === 'ru' ? 'Профиль' : 'Profile'}
        actions={
          hasMissingFields ? (
            <div className="missing-data-badge">
              <Notice tone="warning">
                {locale === 'ru' 
                  ? `Не хватает ${missingFields.length} полей` 
                  : `${missingFields.length} fields missing`}
              </Notice>
            </div>
          ) : null
        }
      />
      
      {hasMissingFields ? (
        <>
          <div className="missing-fields-list">
            {missingFields.slice(0, 3).map((field, idx) => (
              <div key={idx} className="missing-field-item">
                <span className="missing-field-name">{field}</span>
              </div>
            ))}
            {missingFields.length > 3 && (
              <p className="signal-muted missing-fields-more">
                +{missingFields.length - 3} {locale === 'ru' ? 'ещё' : 'more'}
              </p>
            )}
          </div>
          
          <Link 
            href={`/${locale}/cabinet/profile?event=${event.slug}`} 
            className="btn btn-primary btn-sm missing-data-action"
          >
            {locale === 'ru' ? 'Заполнить профиль' : 'Complete profile'}
          </Link>
        </>
      ) : (
        <>
          <Notice tone="success">
            {locale === 'ru' ? 'Профиль заполнен' : 'Profile is complete'}
          </Notice>
          <Link href={`/${locale}/cabinet/profile`} className="btn btn-secondary btn-sm missing-data-action">
            {locale === 'ru' ? 'Просмотр профиля' : 'View profile'}
          </Link>
        </>
      )}
    </Panel>
  );
}
