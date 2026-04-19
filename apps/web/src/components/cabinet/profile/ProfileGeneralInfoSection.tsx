'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { referenceApi } from '@/lib/api';
import { EmptyState, FieldInput, FieldSelect, Notice } from '@/components/ui/signal-primitives';
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
  onDelete: () => Promise<void>;
};

export function ProfileGeneralInfoSection({ locale, user, status, saving, requiredFields, eventTitle, onSave, onUpload, onDelete }: Props) {
  const isRu = locale === 'ru';
  const extended = user.extendedProfile ?? {};
  const [countries, setCountries] = useState<ReferenceOption[]>([]);
  const [regions, setRegions] = useState<ReferenceOption[]>([]);
  const [districts, setDistricts] = useState<ReferenceOption[]>([]);
  const [settlements, setSettlements] = useState<ReferenceOption[]>([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    residenceCountryCode: extended.residenceCountryCode ?? 'UZ',
    regionId: extended.regionId ?? '',
    districtId: extended.districtId ?? '',
    settlementId: extended.settlementId ?? '',
    regionText: extended.regionText ?? user.city ?? '',
    districtText: extended.districtText ?? '',
    settlementText: extended.settlementText ?? user.city ?? '',
    street: extended.street ?? '',
    house: extended.house ?? '',
    apartment: extended.apartment ?? '',
    postalCode: extended.postalCode ?? '',
    nativeLanguage: user.nativeLanguage ?? '',
    communicationLanguage: user.communicationLanguage ?? '',
    consentClientRules: Boolean(user.consentClientRules),
  });

  useEffect(() => {
    Promise.all([referenceApi.countries(), referenceApi.uzRegions()])
      .then(([countriesResponse, regionsResponse]) => {
        setCountries(countriesResponse.data);
        setRegions(regionsResponse.data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!form.regionId) {
      setDistricts([]);
      return;
    }
    referenceApi.uzDistricts(form.regionId).then((response) => setDistricts(response.data)).catch(() => setDistricts([]));
  }, [form.regionId]);

  useEffect(() => {
    if (!form.districtId) {
      setSettlements([]);
      return;
    }
    referenceApi.uzSettlements(form.districtId).then((response) => setSettlements(response.data)).catch(() => setSettlements([]));
  }, [form.districtId]);

  const countryOptions = useMemo(() => countries.length ? countries : [
    { code: 'UZ', nameRu: 'Узбекистан', nameEn: 'Uzbekistan' },
    { code: 'RU', nameRu: 'Россия', nameEn: 'Russia' },
  ], [countries]);

  const isRequired = (field: string) => requiredFields.includes(field);
  const requiredClass = (field: string) => isRequired(field) ? 'signal-field-required' : '';
  const addressRequiredClass = (field: string) => isRequired('factualAddress') || isRequired(field) ? 'signal-field-required' : '';
  const isUz = form.residenceCountryCode === 'UZ';
  function setField(key: keyof typeof form, value: string | boolean) {
    setForm((previous) => ({ ...previous, [key]: value }));
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
      title={isRu ? 'Общая информация' : 'General information'}
      description={isRu ? 'Фото, адрес, языки и согласие с правилами платформы.' : 'Photo, address, languages, and platform rules consent.'}
      status={status}
    >
      {requiredFields.length > 0 ? <Notice tone="warning">{isRu ? `Эти данные нужны для заявки${eventTitle ? `: ${eventTitle}` : ''}.` : 'These data are required for your application.'}</Notice> : null}
      <form className="signal-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}>
        <div className="profile-photo-grid">
          <div className={`profile-upload-zone ${isRequired('avatarUrl') || isRequired('avatarAssetId') || isRequired('photo') ? 'signal-field-required' : ''}`}>
            <div className="profile-photo-preview">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{(user.name || user.email || '?').slice(0, 2).toUpperCase()}</span>}
            </div>
            <div className="profile-upload-copy">
              <strong>{isRu ? 'Фото профиля' : 'Profile photo'}</strong>
              <span>{isRu ? 'JPG, PNG или WebP до 3 МБ.' : 'JPG, PNG, or WebP up to 3 MB.'}</span>
            </div>
            <div className="profile-photo-actions">
              <label className="btn btn-secondary btn-sm">
                {uploading ? (isRu ? 'Загрузка...' : 'Uploading...') : (isRu ? 'Загрузить' : 'Upload')}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void handleFile(event.target.files?.[0])} />
              </label>
              {user.avatarUrl ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onDelete()}>{isRu ? 'Удалить' : 'Delete'}</button> : null}
            </div>
          </div>
          <div className="profile-requirements-panel">
            <h3>{isRu ? 'Готовность раздела' : 'Section readiness'}</h3>
            <ul>
              <li>{isRu ? 'Фото профиля' : 'Profile photo'}</li>
              <li>{isRu ? 'Адрес проживания' : 'Residence address'}</li>
              <li>{isRu ? 'Родной и коммуникационный язык' : 'Native and communication languages'}</li>
              <li>{isRu ? 'Согласие с правилами клиента' : 'Client rules consent'}</li>
            </ul>
          </div>
        </div>

        <div className="profile-form-three-col">
          <ProfileField label={isRu ? 'Страна проживания' : 'Residence country'} required>
            <FieldSelect className={requiredClass('residenceCountryCode')} value={form.residenceCountryCode} onChange={(event) => setField('residenceCountryCode', event.target.value)}>
              <option value="">{isRu ? 'Выберите' : 'Select'}</option>
              {countryOptions.map((country) => {
                const code = country.code ?? country.id ?? '';
                return <option key={code} value={code}>{isRu ? country.nameRu : country.nameEn}</option>;
              })}
            </FieldSelect>
          </ProfileField>
          {isUz ? (
            <>
              <ProfileField label={isRu ? 'Регион' : 'Region'} required><ReferenceSelect className={requiredClass('regionId')} locale={locale} value={form.regionId} options={regions} onChange={(value) => setForm((previous) => ({ ...previous, regionId: value, districtId: '', settlementId: '' }))} /></ProfileField>
              <ProfileField label={isRu ? 'Район' : 'District'} required><ReferenceSelect className={requiredClass('districtId')} locale={locale} value={form.districtId} options={districts} onChange={(value) => setForm((previous) => ({ ...previous, districtId: value, settlementId: '' }))} /></ProfileField>
            </>
          ) : (
            <>
              <ProfileField label={isRu ? 'Регион' : 'Region'} required><FieldInput className={requiredClass('regionText')} value={form.regionText} onChange={(event) => setField('regionText', event.target.value)} /></ProfileField>
              <ProfileField label={isRu ? 'Район' : 'District'}><FieldInput className={requiredClass('districtText')} value={form.districtText} onChange={(event) => setField('districtText', event.target.value)} /></ProfileField>
            </>
          )}
        </div>

        <div className="profile-form-three-col">
          {isUz ? (
            <ProfileField label={isRu ? 'Населённый пункт' : 'Settlement'} required><ReferenceSelect className={isRequired('city') || isRequired('settlementId') ? 'signal-field-required' : ''} locale={locale} value={form.settlementId} options={settlements} onChange={(value) => setField('settlementId', value)} /></ProfileField>
          ) : (
            <ProfileField label={isRu ? 'Город / населённый пункт' : 'City / locality'} required><FieldInput className={isRequired('city') || isRequired('settlementText') ? 'signal-field-required' : ''} value={form.settlementText} onChange={(event) => setField('settlementText', event.target.value)} /></ProfileField>
          )}
          <ProfileField label={isRu ? 'Улица' : 'Street'} required><FieldInput className={addressRequiredClass('street')} value={form.street} onChange={(event) => setField('street', event.target.value)} /></ProfileField>
          <ProfileField label={isRu ? 'Дом' : 'House'} required><FieldInput className={addressRequiredClass('house')} value={form.house} onChange={(event) => setField('house', event.target.value)} /></ProfileField>
        </div>

        <div className="profile-form-three-col">
          <ProfileField label={isRu ? 'Квартира' : 'Apartment'}><FieldInput className={requiredClass('apartment')} value={form.apartment} onChange={(event) => setField('apartment', event.target.value)} /></ProfileField>
          <ProfileField label={isRu ? 'Почтовый индекс' : 'Postal code'} required><FieldInput className={addressRequiredClass('postalCode')} value={form.postalCode} onChange={(event) => setField('postalCode', event.target.value)} /></ProfileField>
          <ProfileField label={isRu ? 'Родной язык' : 'Native language'} required><FieldInput className={requiredClass('nativeLanguage')} value={form.nativeLanguage} onChange={(event) => setField('nativeLanguage', event.target.value)} /></ProfileField>
        </div>

        <div className="profile-form-three-col">
          <ProfileField label={isRu ? 'Язык коммуникации' : 'Communication language'} required><FieldInput className={requiredClass('communicationLanguage')} value={form.communicationLanguage} onChange={(event) => setField('communicationLanguage', event.target.value)} /></ProfileField>
        </div>
        <label className="profile-consent-row"><input type="checkbox" checked={form.consentClientRules} onChange={(event) => setField('consentClientRules', event.target.checked)} /><span>{isRu ? 'Согласен с правилами платформы и клиента' : 'I agree to platform and client rules'}</span></label>
        {isUz && form.regionId && districts.length === 0 ? <EmptyState title={isRu ? 'Справочник районов пуст' : 'No districts'} description={isRu ? 'Выберите другой регион или обновите справочник.' : 'Choose another region or update reference data.'} /> : null}
        <ProfileSectionActions locale={locale} saving={saving} />
      </form>
    </ProfileSectionLayout>
  );
}

function ReferenceSelect({ locale, value, options, className, onChange }: { locale: string; value: string; options: ReferenceOption[]; className?: string; onChange: (value: string) => void }) {
  return (
    <FieldSelect className={className} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{locale === 'ru' ? 'Выберите' : 'Select'}</option>
      {options.map((option) => <option key={option.id ?? option.code} value={option.id ?? option.code}>{locale === 'ru' ? option.nameRu : option.nameEn}</option>)}
    </FieldSelect>
  );
}

function ProfileField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="cabinet-field-block"><span className="cabinet-field-label">{label}{required ? <b className="signal-field-required">*</b> : null}</span>{children}</label>;
}
