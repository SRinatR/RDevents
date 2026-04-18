'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { FieldInput } from '@/components/ui/signal-primitives';
import type { AuthUser } from '@/hooks/useAuth';
import { ProfileSectionActions } from './ProfileSectionActions';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import type { ProfileSectionStatus } from './profile.types';

type ProfileContactsSectionProps = {
  locale: string;
  user: AuthUser;
  status: ProfileSectionStatus;
  saving: boolean;
  requiredFields: string[];
  eventTitle?: string;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function ProfileContactsSection({
  locale,
  user,
  status,
  saving,
  requiredFields,
  eventTitle,
  onSave,
}: ProfileContactsSectionProps) {
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');

  useEffect(() => {
    setPhone(user.phone ?? '');
    setTelegram(user.telegram ?? '');
  }, [user]);

  const isRequired = (field: string) => requiredFields.includes(field);

  return (
    <ProfileSectionLayout
      locale={locale}
      title={locale === 'ru' ? 'Контакты' : 'Contacts'}
      description={locale === 'ru' ? 'Способы связи для организаторов' : 'Ways organizers can reach you'}
      status={status}
    >
      <form
        className="signal-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ phone, telegram });
        }}
      >
        <div className="signal-two-col">
          <FieldBlock
            label={locale === 'ru' ? 'Телефон' : 'Phone'}
            required={isRequired('phone')}
            hint={requiredHint(locale, 'phone', requiredFields, eventTitle)}
          >
            <FieldInput
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={isRequired('phone') ? 'signal-field-required' : ''}
              placeholder="+998"
            />
          </FieldBlock>
          <FieldBlock
            label="Telegram"
            required={isRequired('telegram')}
            hint={requiredHint(locale, 'telegram', requiredFields, eventTitle)}
          >
            <FieldInput
              value={telegram}
              onChange={(event) => setTelegram(event.target.value)}
              className={isRequired('telegram') ? 'signal-field-required' : ''}
              placeholder="@username"
            />
          </FieldBlock>
        </div>

        <div className="profile-readonly-line">
          <span>{locale === 'ru' ? 'Email' : 'Email'}</span>
          <strong>{user.email}</strong>
        </div>

        <ProfileSectionActions locale={locale} saving={saving} />
      </form>
    </ProfileSectionLayout>
  );
}

function FieldBlock({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="signal-stack cabinet-field-block">
      <span className="cabinet-field-label">
        {label} {required ? <span className="cabinet-field-required">*</span> : null}
      </span>
      {children}
      {hint ? <span className="signal-muted signal-required-hint">{hint}</span> : null}
    </label>
  );
}

function requiredHint(locale: string, field: string, requiredFields: string[], eventTitle?: string) {
  if (!requiredFields.includes(field)) return null;
  return locale === 'ru'
    ? `Обязательно${eventTitle ? ` для "${eventTitle}"` : ''}.`
    : `Required${eventTitle ? ` for "${eventTitle}"` : ''}.`;
}
