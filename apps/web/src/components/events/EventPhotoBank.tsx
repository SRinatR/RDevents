'use client';

import { EventMediaBank } from './EventMediaBank';

type PhotoBankEvent = {
  id: string;
  slug: string;
  title: string;
};

type EventPhotoBankProps = {
  event: PhotoBankEvent;
  locale: string;
  user: { id: string } | null;
  isParticipant: boolean;
  variant?: 'default' | 'quest';
};

export function EventPhotoBank({ event, locale, user, isParticipant, variant = 'default' }: EventPhotoBankProps) {
  return (
    <EventMediaBank
      event={event}
      locale={locale}
      user={user}
      canUpload={isParticipant}
      variant={variant}
    />
  );
}

export { EventMediaBank };
