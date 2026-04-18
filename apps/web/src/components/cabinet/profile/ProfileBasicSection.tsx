'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { FieldInput } from '@/components/ui/signal-primitives';
import type { AuthUser } from '@/hooks/useAuth';
import { ProfileSectionActions } from './ProfileSectionActions';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import type { ProfileSectionStatus } from './profile.types';

type ProfileBasicSectionProps = {
  locale: string;
  user: AuthUser;
  status: ProfileSectionStatus;
  saving: boolean;
  requiredFields: string[];
  eventTitle?: string;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function ProfileBasicSection({
  locale,
  user,
  status,
  saving,
  requiredFields,
  eventTitle,
  onSave,
}: ProfileBasicSectionProps) {
  const [lastNameCyrillic, setLastNameCyrillic] = useState('');
  const [firstNameCyrillic, setFirstNameCyrillic] = useState('');
  const [middleNameCyrillic, setMiddleNameCyrillic] = useState('');
  const [lastNameLatin, setLastNameLatin] = useState('');
  const [firstNameLatin, setFirstNameLatin] = useState('');
  const [middleNameLatin, setMiddleNameLatin] = useState('');
  const [birthDate, setBirthDate] = useState('');

  useEffect(() => {
    setLastNameCyrillic(user.lastNameCyrillic ?? '');
    setFirstNameCyrillic(user.firstNameCyrillic ?? '');
    setMiddleNameCyrillic(user.middleNameCyrillic ?? '');
    setLastNameLatin(user.lastNameLatin ?? '');
    setFirstNameLatin(user.firstNameLatin ?? '');
    setMiddleNameLatin(user.middleNameLatin ?? '');
    setBirthDate(formatDateInput(user.birthDate));
  }, [user]);

  const isRequired = (field: string) => requiredFields.includes(field);

  return (
    <ProfileSectionLayout
      locale={locale}
      title={locale === 'ru' ? 'Основное' : 'Basic'}
      description={locale === 'ru' ? 'ФИО и дата рождения для заявок' : 'Name and birth date for applications'}
      status={status}
    >
      <form
        className="signal-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({
            lastNameCyrillic,
            firstNameCyrillic,
            middleNameCyrillic,
            lastNameLatin,
            firstNameLatin,
            middleNameLatin,
            birthDate: toApiBirthDate(birthDate),
          });
        }}
      >
        <div className="signal-section-label">{locale === 'ru' ? 'Кириллица' : 'Cyrillic'}</div>
        <div className="profile-form-three-col">
          <FieldBlock
            label={locale === 'ru' ? 'Фамилия' : 'Last name'}
            required={isRequired('lastNameCyrillic')}
            hint={requiredHint(locale, 'lastNameCyrillic', requiredFields, eventTitle)}
          >
            <FieldInput value={lastNameCyrillic} onChange={(event) => setLastNameCyrillic(event.target.value)} />
          </FieldBlock>
          <FieldBlock
            label={locale === 'ru' ? 'Имя' : 'First name'}
            required
            hint={requiredHint(locale, 'firstNameCyrillic', requiredFields, eventTitle)}
          >
            <FieldInput
              value={firstNameCyrillic}
              onChange={(event) => setFirstNameCyrillic(event.target.value)}
              className={isRequired('firstNameCyrillic') ? 'signal-field-required' : ''}
            />
          </FieldBlock>
          <FieldBlock label={locale === 'ru' ? 'Отчество' : 'Patronymic'}>
            <FieldInput value={middleNameCyrillic} onChange={(event) => setMiddleNameCyrillic(event.target.value)} />
          </FieldBlock>
        </div>

        <div className="signal-section-label">{locale === 'ru' ? 'Латиница' : 'Latin'}</div>
        <div className="profile-form-three-col">
          <FieldBlock label={locale === 'ru' ? 'Фамилия' : 'Last name'}>
            <FieldInput value={lastNameLatin} onChange={(event) => setLastNameLatin(event.target.value)} />
          </FieldBlock>
          <FieldBlock label={locale === 'ru' ? 'Имя' : 'First name'}>
            <FieldInput value={firstNameLatin} onChange={(event) => setFirstNameLatin(event.target.value)} />
          </FieldBlock>
          <FieldBlock label={locale === 'ru' ? 'Отчество' : 'Patronymic'}>
            <FieldInput value={middleNameLatin} onChange={(event) => setMiddleNameLatin(event.target.value)} />
          </FieldBlock>
        </div>

        <div className="profile-form-narrow">
          <FieldBlock
            label={locale === 'ru' ? 'Дата рождения' : 'Birth date'}
            required
            hint={requiredHint(locale, 'birthDate', requiredFields, eventTitle)}
          >
            <FieldInput
              type="date"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              className={isRequired('birthDate') ? 'signal-field-required' : ''}
            />
          </FieldBlock>
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

function formatDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toApiBirthDate(value: string) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
