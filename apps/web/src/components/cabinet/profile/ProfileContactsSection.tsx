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
  onVerifyContact: (channel: 'email' | 'phone' | 'telegram') => Promise<void>;
};

export function ProfileContactsSection({
  locale,
  user,
  status,
  saving,
  requiredFields,
  eventTitle,
  onSave,
  onVerifyContact,
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
        <div className="profile-contacts-grid">
          <div className="profile-contact-form">
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
            <div className="profile-readonly-line">
              <span>{locale === 'ru' ? 'Email' : 'Email'}</span>
              <strong>{user.email}</strong>
            </div>
          </div>

          <aside className="profile-verification-panel">
            <h3>{locale === 'ru' ? 'Подтверждение' : 'Confirmation'}</h3>
            <p>
              {locale === 'ru'
                ? 'Статус хранится в профиле. Если контакт изменён, подтверждение нужно пройти снова.'
                : 'Status is stored in your profile. If a contact changes, confirmation is required again.'}
            </p>
            <VerificationRow
              locale={locale}
              label="Email"
              value={user.email}
              verifiedAt={user.emailVerifiedAt}
              saving={saving}
              onVerify={() => onVerifyContact('email')}
            />
            <VerificationRow
              locale={locale}
              label={locale === 'ru' ? 'Телефон' : 'Phone'}
              value={phone}
              savedValue={user.phone ?? ''}
              verifiedAt={user.phoneVerifiedAt}
              saving={saving}
              onVerify={() => onVerifyContact('phone')}
            />
            <VerificationRow
              locale={locale}
              label="Telegram"
              value={telegram}
              savedValue={user.telegram ?? ''}
              verifiedAt={user.telegramVerifiedAt}
              saving={saving}
              onVerify={() => onVerifyContact('telegram')}
            />
          </aside>
        </div>

        <ProfileSectionActions locale={locale} saving={saving} />
      </form>
    </ProfileSectionLayout>
  );
}

function VerificationRow({
  locale,
  label,
  value,
  savedValue,
  verifiedAt,
  saving,
  onVerify,
}: {
  locale: string;
  label: string;
  value: string;
  savedValue?: string;
  verifiedAt?: string | null;
  saving: boolean;
  onVerify: () => Promise<void>;
}) {
  const hasValue = value.trim().length > 0;
  const hasUnsavedChange = savedValue !== undefined && value.trim() !== savedValue.trim();
  const isVerified = Boolean(verifiedAt) && hasValue && !hasUnsavedChange;
  const disabled = saving || !hasValue || hasUnsavedChange || isVerified;

  return (
    <div className="profile-verification-row">
      <div>
        <strong>{label}</strong>
        <span className={isVerified ? 'verified' : 'unverified'}>
          {isVerified
            ? (locale === 'ru' ? 'Подтверждён' : 'Confirmed')
            : (locale === 'ru' ? 'Не подтверждён' : 'Not confirmed')}
        </span>
        {hasUnsavedChange ? (
          <small>{locale === 'ru' ? 'Сначала сохраните изменение' : 'Save the change first'}</small>
        ) : null}
      </div>
      <button type="button" className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => void onVerify()}>
        {isVerified ? (locale === 'ru' ? 'Готово' : 'Done') : (locale === 'ru' ? 'Подтвердить' : 'Confirm')}
      </button>
    </div>
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
