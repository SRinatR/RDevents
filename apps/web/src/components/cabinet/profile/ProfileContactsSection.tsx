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
    setPhone(formatUzbekPhone(user.phone ?? ''));
    setTelegram(formatTelegramUsername(user.telegram ?? ''));
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
          void onSave({ phone: normalizeUzbekPhone(phone), telegram: formatTelegramUsername(telegram) });
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
                onChange={(event) => setPhone(formatUzbekPhone(event.target.value))}
                className={isRequired('phone') ? 'signal-field-required' : ''}
                placeholder="+998 90 123 45 67"
                inputMode="tel"
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
                onBlur={() => setTelegram(formatTelegramUsername(telegram))}
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
                ? 'Email подтверждается кодом при регистрации. Телефон и Telegram пока сохраняются как контакты без проверки.'
                : 'Email is confirmed with a code during signup. Phone and Telegram are saved as contacts without verification for now.'}
            </p>
            <VerificationRow
              locale={locale}
              label="Email"
              value={user.email}
              verifiedAt={user.emailVerifiedAt}
            />
            <VerificationRow
              locale={locale}
              label={locale === 'ru' ? 'Телефон' : 'Phone'}
              value={phone}
              verifiedAt={null}
              unavailable
            />
            <VerificationRow
              locale={locale}
              label="Telegram"
              value={telegram}
              verifiedAt={null}
              unavailable
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
  verifiedAt,
  unavailable,
}: {
  locale: string;
  label: string;
  value: string;
  verifiedAt?: string | null;
  unavailable?: boolean;
}) {
  const hasValue = value.trim().length > 0;
  const isVerified = Boolean(verifiedAt) && hasValue && !unavailable;

  return (
    <div className="profile-verification-row">
      <div>
        <strong>{label}</strong>
        <span className={isVerified ? 'verified' : 'unverified'}>
          {unavailable
            ? (locale === 'ru' ? 'Без проверки' : 'Not verified')
            : isVerified
              ? (locale === 'ru' ? 'Подтверждён' : 'Confirmed')
              : (locale === 'ru' ? 'Не подтверждён' : 'Not confirmed')}
        </span>
        {unavailable ? (
          <small>{locale === 'ru' ? 'SMS/Telegram OTP ещё не подключены.' : 'SMS/Telegram OTP is not connected yet.'}</small>
        ) : null}
      </div>
    </div>
  );
}

function normalizeUzbekPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  const withoutPrefix = digits.startsWith('998') ? digits.slice(3) : digits;
  const local = withoutPrefix.slice(0, 9);
  return local.length ? `+998${local}` : '';
}

function formatUzbekPhone(value: string) {
  const normalized = normalizeUzbekPhone(value);
  const local = normalized.replace('+998', '');
  if (!local) return '';
  return [
    '+998',
    local.slice(0, 2),
    local.slice(2, 5),
    local.slice(5, 7),
    local.slice(7, 9),
  ].filter(Boolean).join(' ');
}

function formatTelegramUsername(value: string) {
  const cleaned = value
    .trim()
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '')
    .replace(/^t\.me\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()
    .slice(0, 32);
  return cleaned ? `@${cleaned}` : '';
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
