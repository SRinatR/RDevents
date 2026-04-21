'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { FieldSelect } from '@/components/ui/signal-primitives';
import type { AuthUser } from '@/hooks/useAuth';
import { ProfileSectionActions } from './ProfileSectionActions';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import type { ProfileSectionStatus } from './profile.types';

const LANGUAGE_OPTIONS = [
  { value: '', ru: 'Выберите язык', en: 'Choose language' },
  { value: 'uz', ru: 'Узбекский', en: 'Uzbek' },
  { value: 'ru', ru: 'Русский', en: 'Russian' },
  { value: 'en', ru: 'Английский', en: 'English' },
  { value: 'kaa', ru: 'Каракалпакский', en: 'Karakalpak' },
  { value: 'tg', ru: 'Таджикский', en: 'Tajik' },
  { value: 'kk', ru: 'Казахский', en: 'Kazakh' },
];

type ProfileLanguagesSectionProps = {
  locale: string;
  user: AuthUser;
  status: ProfileSectionStatus;
  saving: boolean;
  requiredFields: string[];
  eventTitle?: string;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function ProfileLanguagesSection({
  locale,
  user,
  status,
  saving,
  requiredFields,
  eventTitle,
  onSave,
}: ProfileLanguagesSectionProps) {
  const [nativeLanguage, setNativeLanguage] = useState('');
  const [communicationLanguage, setCommunicationLanguage] = useState('');

  useEffect(() => {
    setNativeLanguage(user.nativeLanguage ?? '');
    setCommunicationLanguage(user.communicationLanguage ?? '');
  }, [user]);

  const isRequired = (field: string) => requiredFields.includes(field);

  return (
    <ProfileSectionLayout
      locale={locale}
      title={locale === 'ru' ? 'Языки и коммуникация' : 'Languages and communication'}
      description={locale === 'ru' ? 'Язык общения для рабочих сообщений' : 'Preferred language for working messages'}
      status={status}
    >
      <form
        className="signal-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ nativeLanguage, communicationLanguage });
        }}
      >
        <div className="signal-two-col">
          <FieldBlock
            label={locale === 'ru' ? 'Родной язык' : 'Native language'}
            required={isRequired('nativeLanguage')}
            hint={requiredHint(locale, 'nativeLanguage', requiredFields, eventTitle)}
          >
            <FieldSelect
              value={nativeLanguage}
              onChange={(event) => setNativeLanguage(event.target.value)}
              className={isRequired('nativeLanguage') ? 'signal-field-required' : ''}
            >
              {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{locale === 'ru' ? option.ru : option.en}</option>)}
            </FieldSelect>
          </FieldBlock>
          <FieldBlock
            label={locale === 'ru' ? 'Язык коммуникации' : 'Communication language'}
            required={isRequired('communicationLanguage')}
            hint={requiredHint(locale, 'communicationLanguage', requiredFields, eventTitle)}
          >
            <FieldSelect
              value={communicationLanguage}
              onChange={(event) => setCommunicationLanguage(event.target.value)}
              className={isRequired('communicationLanguage') ? 'signal-field-required' : ''}
            >
              {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{locale === 'ru' ? option.ru : option.en}</option>)}
            </FieldSelect>
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
