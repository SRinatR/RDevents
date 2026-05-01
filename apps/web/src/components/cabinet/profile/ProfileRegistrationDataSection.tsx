'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { referenceApi } from '@/lib/api';
import { FieldInput, FieldSelect, Notice } from '@/components/ui/signal-primitives';
import { ProfileSectionActions } from './ProfileSectionActions';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import type { ProfileSectionStatus, ReferenceOption } from './profile.types';

type Props = {
  locale: string;
  user: any;
  status: ProfileSectionStatus;
  saving: boolean;
  requiredFields: string[];
  eventTitle: string;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
};

export function ProfileRegistrationDataSection({ locale, user, status, saving, requiredFields, eventTitle, onSave, onUpload }: Props) {
  const isRu = locale === 'ru';
  const extended = user.extendedProfile ?? {};
  const [uploading, setUploading] = useState(false);
  const [countries, setCountries] = useState<ReferenceOption[]>([]);
  const [form, setForm] = useState({
    lastNameCyrillic: user.lastNameCyrillic ?? '',
    firstNameCyrillic: user.firstNameCyrillic ?? '',
    middleNameCyrillic: user.middleNameCyrillic ?? '',
    lastNameLatin: user.lastNameLatin ?? '',
    firstNameLatin: user.firstNameLatin ?? '',
    middleNameLatin: user.middleNameLatin ?? '',
    hasNoLastName: Boolean(user.hasNoLastName),
    hasNoFirstName: Boolean(user.hasNoFirstName),
    hasNoMiddleName: Boolean(user.hasNoMiddleName),
    birthDate: toDateInput(user.birthDate),
    gender: extended.gender ?? '',
    citizenshipCountryCode: extended.citizenshipCountryCode ?? '',
    residenceCountryCode: extended.residenceCountryCode ?? 'UZ',
    phone: user.phone ?? '',
    telegram: user.telegram ?? '',
    consentPersonalData: Boolean(user.consentPersonalData),
    consentMailing: Boolean(extended.consentMailing),
  });
  const [latinDirty, setLatinDirty] = useState(() => ({
    lastNameLatin: isManualLatin(user.lastNameCyrillic, user.lastNameLatin),
    firstNameLatin: isManualLatin(user.firstNameCyrillic, user.firstNameLatin),
    middleNameLatin: isManualLatin(user.middleNameCyrillic, user.middleNameLatin),
  }));

  useEffect(() => {
    referenceApi.countries().then((response) => setCountries(response.data)).catch(() => setCountries([]));
  }, []);

  const countryOptions = useMemo(() => countries.length ? countries : [
    { code: 'UZ', nameRu: 'Узбекистан', nameEn: 'Uzbekistan' },
    { code: 'RU', nameRu: 'Россия', nameEn: 'Russia' },
  ], [countries]);

  const isRequired = (field: string) => requiredFields.includes(field);
  const requiredClass = (field: string) => isRequired(field) ? 'signal-field-required' : '';
  const nameRequiredClass = (field: string) => isRequired('name') || isRequired(field) ? 'signal-field-required' : '';

  function setField(key: keyof typeof form, value: string | boolean) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function setCyrillicNameField(
    cyrillicKey: 'lastNameCyrillic' | 'firstNameCyrillic' | 'middleNameCyrillic',
    latinKey: 'lastNameLatin' | 'firstNameLatin' | 'middleNameLatin',
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [cyrillicKey]: value,
      ...(latinDirty[latinKey] ? {} : { [latinKey]: transliterateCyrillic(value) }),
    }));
  }

  function setLatinNameField(key: 'lastNameLatin' | 'firstNameLatin' | 'middleNameLatin', value: string) {
    setLatinDirty((previous) => ({ ...previous, [key]: true }));
    setField(key, value);
  }

  async function handleFile(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <ProfileSectionLayout
      locale={locale}
      title={isRu ? 'Регистрационные данные' : 'Registration data'}
      description={isRu ? 'Фото профиля, ФИО, гражданство, дата рождения, телефон и согласия.' : 'Profile photo, identity, citizenship, birth date, phone, and consent.'}
      status={status}
    >
      {requiredFields.length > 0 ? <Notice tone="warning">{isRu ? `Заполните поля для участия${eventTitle ? ` в "${eventTitle}"` : ''}.` : 'Complete the required fields to continue.'}</Notice> : null}
      <form className="signal-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}>
        <div className="profile-photo-grid">
          <div className={`profile-upload-zone ${isRequired('avatarUrl') || isRequired('avatarAssetId') || isRequired('photo') ? 'signal-field-required' : ''}`}>
            <div className="profile-photo-preview">
              {user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={120} height={120} style={{ objectFit: 'cover' }} /> : <span>{(user.name || user.email || '?').slice(0, 2).toUpperCase()}</span>}
            </div>
            <div className="profile-upload-copy">
              <strong>{isRu ? 'Фото профиля' : 'Profile photo'}</strong>
              <span>{isRu ? 'JPG, PNG или WebP до 3 МБ.' : 'JPG, PNG, or WebP up to 3 MB.'}</span>
            </div>
            <div className="profile-photo-actions">
              <label className="btn btn-secondary btn-sm">
                {uploading ? (isRu ? 'Загрузка...' : 'Uploading...') : (user.avatarUrl ? (isRu ? 'Изменить фото' : 'Change photo') : (isRu ? 'Загрузить' : 'Upload'))}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void handleFile(event.target.files?.[0])} />
              </label>
            </div>
          </div>
          <div className="profile-requirements-panel">
            <h3>{isRu ? 'Готовность раздела' : 'Section readiness'}</h3>
            <ul>
              <li>{isRu ? 'Фото профиля' : 'Profile photo'}</li>
              <li>{isRu ? 'ФИО (кириллица и латиница)' : 'Full name (Cyrillic and Latin)'}</li>
              <li>{isRu ? 'Дата рождения и пол' : 'Birth date and gender'}</li>
              <li>{isRu ? 'Гражданство и страна проживания' : 'Citizenship and residence country'}</li>
              <li>{isRu ? 'Телефон и Telegram' : 'Phone and Telegram'}</li>
              <li>{isRu ? 'Согласие на обработку данных' : 'Data processing consent'}</li>
            </ul>
          </div>
        </div>
        <div className="profile-form-three-col">
          <ProfileField label={isRu ? 'Фамилия кириллицей' : 'Last name Cyrillic'} required={!form.hasNoLastName}>
            <FieldInput className={nameRequiredClass('lastNameCyrillic')} disabled={form.hasNoLastName} value={form.lastNameCyrillic} onChange={(event) => setCyrillicNameField('lastNameCyrillic', 'lastNameLatin', event.target.value)} />
          </ProfileField>
          <ProfileField label={isRu ? 'Имя кириллицей' : 'First name Cyrillic'} required={!form.hasNoFirstName}>
            <FieldInput className={nameRequiredClass('firstNameCyrillic')} disabled={form.hasNoFirstName} value={form.firstNameCyrillic} onChange={(event) => setCyrillicNameField('firstNameCyrillic', 'firstNameLatin', event.target.value)} />
          </ProfileField>
          <ProfileField label={isRu ? 'Отчество кириллицей' : 'Middle name Cyrillic'} required={!form.hasNoMiddleName}>
            <FieldInput className={requiredClass('middleNameCyrillic')} disabled={form.hasNoMiddleName} value={form.middleNameCyrillic} onChange={(event) => setCyrillicNameField('middleNameCyrillic', 'middleNameLatin', event.target.value)} />
          </ProfileField>
        </div>
        <div className="profile-form-three-col">
          <ProfileField label={isRu ? 'Фамилия латиницей' : 'Last name Latin'} required={!form.hasNoLastName}>
            <FieldInput className={nameRequiredClass('lastNameLatin')} disabled={form.hasNoLastName} value={form.lastNameLatin} onChange={(event) => setLatinNameField('lastNameLatin', event.target.value)} />
          </ProfileField>
          <ProfileField label={isRu ? 'Имя латиницей' : 'First name Latin'} required={!form.hasNoFirstName}>
            <FieldInput className={nameRequiredClass('firstNameLatin')} disabled={form.hasNoFirstName} value={form.firstNameLatin} onChange={(event) => setLatinNameField('firstNameLatin', event.target.value)} />
          </ProfileField>
          <ProfileField label={isRu ? 'Отчество латиницей' : 'Middle name Latin'} required={!form.hasNoMiddleName}>
            <FieldInput className={requiredClass('middleNameLatin')} disabled={form.hasNoMiddleName} value={form.middleNameLatin} onChange={(event) => setLatinNameField('middleNameLatin', event.target.value)} />
          </ProfileField>
        </div>
        <div className="profile-form-three-col">
          <CheckboxRow label={isRu ? 'Нет фамилии' : 'No last name'} checked={form.hasNoLastName} onChange={(value) => setField('hasNoLastName', value)} />
          <CheckboxRow label={isRu ? 'Нет имени' : 'No first name'} checked={form.hasNoFirstName} onChange={(value) => setField('hasNoFirstName', value)} />
          <CheckboxRow label={isRu ? 'Нет отчества' : 'No middle name'} checked={form.hasNoMiddleName} onChange={(value) => setField('hasNoMiddleName', value)} />
        </div>
        <div className="profile-form-three-col">
          <ProfileField label="Email">
            <FieldInput value={user.email ?? ''} readOnly />
          </ProfileField>
          <ProfileField label={isRu ? 'Дата рождения' : 'Birth date'} required>
            <FieldInput className={requiredClass('birthDate')} type="date" value={form.birthDate} onChange={(event) => setField('birthDate', event.target.value)} />
          </ProfileField>
          <ProfileField label={isRu ? 'Пол' : 'Gender'} required>
            <FieldSelect className={requiredClass('gender')} value={form.gender} onChange={(event) => setField('gender', event.target.value)}>
              <option value="">{isRu ? 'Выберите' : 'Select'}</option>
              <option value="MALE">{isRu ? 'Мужской' : 'Male'}</option>
              <option value="FEMALE">{isRu ? 'Женский' : 'Female'}</option>
            </FieldSelect>
          </ProfileField>
        </div>
        <div className="profile-form-three-col">
          <ProfileField label={isRu ? 'Гражданство' : 'Citizenship'} required>
            <CountrySelect locale={locale} countries={countryOptions} value={form.citizenshipCountryCode} className={requiredClass('citizenshipCountryCode')} onChange={(value) => setField('citizenshipCountryCode', value)} />
          </ProfileField>
          <ProfileField label={isRu ? 'Страна проживания' : 'Residence country'} required>
            <CountrySelect locale={locale} countries={countryOptions} value={form.residenceCountryCode} className={requiredClass('residenceCountryCode')} onChange={(value) => setField('residenceCountryCode', value)} />
          </ProfileField>
          <ProfileField label={isRu ? 'Телефон' : 'Phone'} required>
            <FieldInput className={requiredClass('phone')} value={form.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="+998901234567" />
          </ProfileField>
        </div>
        <div className="profile-form-three-col">
          <ProfileField label="Telegram" required={isRequired('telegram')}>
            <FieldInput className={requiredClass('telegram')} value={form.telegram} onChange={(event) => setField('telegram', event.target.value)} placeholder="@username" />
          </ProfileField>
        </div>
        <CheckboxRow label={isRu ? 'Согласен на обработку персональных данных' : 'I consent to personal data processing'} checked={form.consentPersonalData} onChange={(value) => setField('consentPersonalData', value)} />
        <CheckboxRow label={isRu ? 'Хочу получать информационные рассылки' : 'I agree to receive informational mailings'} checked={form.consentMailing} onChange={(value) => setField('consentMailing', value)} />
        <ProfileSectionActions locale={locale} saving={saving} />
      </form>
    </ProfileSectionLayout>
  );
}

function ProfileField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="cabinet-field-block"><span className="cabinet-field-label">{label}{required ? <b className="signal-field-required">*</b> : null}</span>{children}</label>;
}

function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="profile-consent-row"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function CountrySelect({ locale, countries, value, className, onChange }: { locale: string; countries: ReferenceOption[]; value: string; className?: string; onChange: (value: string) => void }) {
  return (
    <FieldSelect className={className} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{locale === 'ru' ? 'Выберите страну' : 'Select country'}</option>
      {countries.map((country) => {
        const code = country.code ?? country.id ?? '';
        return <option key={code} value={code}>{locale === 'ru' ? country.nameRu : country.nameEn}</option>;
      })}
    </FieldSelect>
  );
}

function toDateInput(value: string | Date | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function isManualLatin(cyrillic: string | null | undefined, latin: string | null | undefined) {
  const current = String(latin ?? '').trim();
  if (!current) return false;
  return current !== transliterateCyrillic(String(cyrillic ?? ''));
}

function transliterateCyrillic(value: string) {
  const map: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'yo',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'kh',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ы: 'y',
    э: 'e',
    ю: 'yu',
    я: 'ya',
    ъ: '',
    ь: '',
  };
  return value
    .split('')
    .map((char) => {
      const lower = char.toLowerCase();
      const next = map[lower] ?? char;
      return char === lower ? next : next.charAt(0).toUpperCase() + next.slice(1);
    })
    .join('')
    .replace(/[^a-zA-Z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
