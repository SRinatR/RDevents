'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { FieldInput, FieldTextarea } from '@/components/ui/signal-primitives';
import type { AuthUser } from '@/hooks/useAuth';
import { ProfileSectionActions } from './ProfileSectionActions';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import type { ProfileSectionStatus } from './profile.types';

type ProfileAddressSectionProps = {
  locale: string;
  user: AuthUser;
  status: ProfileSectionStatus;
  saving: boolean;
  requiredFields: string[];
  eventTitle?: string;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function ProfileAddressSection({
  locale,
  user,
  status,
  saving,
  requiredFields,
  eventTitle,
  onSave,
}: ProfileAddressSectionProps) {
  const [city, setCity] = useState('');
  const [factualAddress, setFactualAddress] = useState('');

  useEffect(() => {
    setCity(user.city ?? '');
    setFactualAddress(user.factualAddress ?? '');
  }, [user]);

  const isRequired = (field: string) => requiredFields.includes(field);

  return (
    <ProfileSectionLayout
      locale={locale}
      title={locale === 'ru' ? 'Адрес и проживание' : 'Address and residence'}
      description={locale === 'ru' ? 'Город и фактический адрес' : 'City and factual address'}
      status={status}
    >
      <form
        className="signal-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ city, factualAddress });
        }}
      >
        <div className="profile-address-grid">
          <FieldBlock
            className="profile-address-field profile-address-field-city"
            label={locale === 'ru' ? 'Город' : 'City'}
            required={isRequired('city')}
            hint={requiredHint(locale, 'city', requiredFields, eventTitle)}
          >
            <FieldInput
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className={isRequired('city') ? 'signal-field-required' : ''}
            />
          </FieldBlock>
          <FieldBlock
            className="profile-address-field profile-address-field-factual"
            label={locale === 'ru' ? 'Фактический адрес' : 'Factual address'}
            required={isRequired('factualAddress')}
            hint={requiredHint(locale, 'factualAddress', requiredFields, eventTitle)}
          >
            <FieldTextarea
              value={factualAddress}
              onChange={(event) => setFactualAddress(event.target.value)}
              className={isRequired('factualAddress') ? 'signal-field-required' : ''}
            />
          </FieldBlock>
        </div>

        <ProfileSectionActions locale={locale} saving={saving} />
      </form>
    </ProfileSectionLayout>
  );
}

function FieldBlock({
  className,
  label,
  required,
  hint,
  children,
}: {
  className?: string;
  label: string;
  required?: boolean;
  hint?: string | null;
  children: ReactNode;
}) {
  return (
    <label className={`signal-stack cabinet-field-block ${className ?? ''}`}>
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
