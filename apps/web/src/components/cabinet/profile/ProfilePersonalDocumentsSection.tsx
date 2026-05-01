'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { EmptyState, FieldInput, FieldSelect, Notice, ToolbarRow } from '@/components/ui/signal-primitives';
import { ProfileSectionActions } from './ProfileSectionActions';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import type { ProfileDocument, ProfileSectionStatus } from './profile.types';

type Props = {
  locale: string;
  user: any;
  status: ProfileSectionStatus;
  saving: boolean;
  requiredFields: string[];
  eventTitle: string;
  documents: ProfileDocument[];
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onDelete: (assetId: string) => Promise<void>;
};

export function ProfilePersonalDocumentsSection({ locale, user, status, saving, requiredFields, eventTitle, documents, onSave, onUpload, onDelete }: Props) {
  const isRu = locale === 'ru';
  const extended = user.extendedProfile ?? {};
  const domestic = user.identityDocument ?? {};
  const intl = user.internationalPassport ?? {};
  const additionalByType = new Map((user.additionalDocuments ?? []).map((item: any) => [item.type, item.assetId]));
  const [uploading, setUploading] = useState(false);
  const [citizenship, setCitizenship] = useState(domestic.citizenshipCountryCode ?? extended.citizenshipCountryCode ?? '');
  const [domesticForm, setDomesticForm] = useState({
    documentType: domestic.documentType ?? 'PASSPORT',
    documentSeries: domestic.documentSeries ?? '',
    documentNumber: domestic.documentNumber ?? '',
    pinfl: domestic.pinfl ?? '',
    passportSeries: domestic.passportSeries ?? '',
    passportNumber: domestic.passportNumber ?? '',
    issueDate: toDateInput(domestic.issueDate),
    expiryDate: toDateInput(domestic.expiryDate),
    issuedBy: domestic.issuedBy ?? '',
    issueCountryCode: domestic.issueCountryCode ?? citizenship,
    placeOfBirth: domestic.placeOfBirth ?? '',
    subdivisionCode: domestic.subdivisionCode ?? '',
    snils: domestic.snils ?? '',
    scanAssetId: domestic.scanAssetId ?? '',
  });
  const [internationalForm, setInternationalForm] = useState({
    countryCode: intl.countryCode ?? citizenship,
    series: intl.series ?? '',
    number: intl.number ?? '',
    issueDate: toDateInput(intl.issueDate),
    expiryDate: toDateInput(intl.expiryDate),
    issuedBy: intl.issuedBy ?? '',
    scanAssetId: intl.scanAssetId ?? '',
  });
  const [additional, setAdditional] = useState({
    SCHOOL_PROOF: String(additionalByType.get('SCHOOL_PROOF') ?? ''),
    STUDENT_PROOF: String(additionalByType.get('STUDENT_PROOF') ?? ''),
    BIRTH_CERTIFICATE: String(additionalByType.get('BIRTH_CERTIFICATE') ?? ''),
  });
  const domesticRequired = requiredFields.includes('personalDocumentsComplete') || requiredFields.includes('domesticDocumentComplete');
  const internationalRequired = requiredFields.includes('personalDocumentsComplete') || requiredFields.includes('internationalPassportComplete');
  const domesticRequiredClass = domesticRequired ? 'signal-field-required' : '';
  const internationalRequiredClass = internationalRequired ? 'signal-field-required' : '';

  async function handleUpload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  }

  function save() {
    return onSave({
      domesticDocument: {
        citizenshipCountryCode: citizenship,
        ...domesticForm,
      },
      internationalPassport: internationalForm,
      additionalDocuments: Object.entries(additional)
        .filter(([, assetId]) => assetId)
        .map(([type, assetId]) => ({ type, assetId })),
    });
  }

  return (
    <ProfileSectionLayout
      locale={locale}
      title={isRu ? 'Личные документы' : 'Personal documents'}
      description={isRu ? 'Внутренний документ по гражданству, загранпаспорт и подтверждающие файлы.' : 'Citizenship-specific domestic document, international passport, and supporting files.'}
      status={status}
    >
      {requiredFields.length > 0 ? <Notice tone="warning">{isRu ? `Эти документы нужны для заявки${eventTitle ? `: ${eventTitle}` : ''}.` : 'These documents are required for your application.'}</Notice> : null}
      <form className="signal-stack" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="profile-document-upload">
          <div>
            <strong>{isRu ? 'Загрузка документов' : 'Document upload'}</strong>
            <span>{isRu ? 'PDF, Word или изображение. После загрузки выберите файл в нужном поле ниже.' : 'PDF, Word, or image. After upload, select the file below.'}</span>
          </div>
          <label className="btn btn-secondary btn-sm">
            {uploading ? (isRu ? 'Загрузка...' : 'Uploading...') : (isRu ? 'Загрузить файл' : 'Upload file')}
            <input type="file" hidden onChange={(event) => void handleUpload(event.target.files?.[0])} />
          </label>
        </div>

        {documents.length > 0 ? (
          <div className="profile-document-list">
            {documents.map((document) => (
              <div key={document.id} className="profile-document-row">
                <div>
                  <strong>{document.originalFilename}</strong>
                  <span>{Math.ceil(document.sizeBytes / 1024)} KB</span>
                </div>
                <div className="profile-document-actions">
                  {document.publicUrl ? <a className="btn btn-ghost btn-sm" href={document.publicUrl} target="_blank" rel="noreferrer">{isRu ? 'Открыть' : 'Open'}</a> : null}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void onDelete(document.id)}>{isRu ? 'Удалить' : 'Delete'}</button>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title={isRu ? 'Файлы не загружены' : 'No files uploaded'} description={isRu ? 'Загрузите сканы, чтобы привязать их к документам.' : 'Upload scans to attach them to document records.'} />}

        <Notice tone="info">{isRu ? 'Тип внутреннего документа меняется по гражданству: Узбекистан, Россия или другой документ.' : 'Domestic document fields change by citizenship: Uzbekistan, Russia, or another document.'}</Notice>
        <div className="profile-form-three-col">
          <ProfileField label={isRu ? 'Гражданство документа' : 'Document citizenship'} required>
            <FieldSelect className={domesticRequiredClass} value={citizenship} onChange={(event) => setCitizenship(event.target.value)}>
              <option value="">{isRu ? 'Выберите' : 'Select'}</option>
              <option value="UZ">{isRu ? 'Узбекистан' : 'Uzbekistan'}</option>
              <option value="RU">{isRu ? 'Россия' : 'Russia'}</option>
              <option value="OTHER">{isRu ? 'Другое' : 'Other'}</option>
            </FieldSelect>
          </ProfileField>
          <ProfileField label={isRu ? 'Дата выдачи' : 'Issue date'} required><FieldInput className={domesticRequiredClass} type="date" value={domesticForm.issueDate} onChange={(event) => setDomesticForm((previous) => ({ ...previous, issueDate: event.target.value }))} /></ProfileField>
          <ProfileField label={isRu ? 'Кем выдан' : 'Issued by'} required><FieldInput className={domesticRequiredClass} value={domesticForm.issuedBy} onChange={(event) => setDomesticForm((previous) => ({ ...previous, issuedBy: event.target.value }))} /></ProfileField>
        </div>

        {citizenship === 'RU' ? (
          <div className="profile-form-three-col">
            <ProfileField label={isRu ? 'Серия паспорта РФ' : 'RU passport series'} required><FieldInput className={domesticRequiredClass} value={domesticForm.passportSeries} onChange={(event) => setDomesticForm((previous) => ({ ...previous, passportSeries: event.target.value }))} /></ProfileField>
            <ProfileField label={isRu ? 'Номер паспорта РФ' : 'RU passport number'} required><FieldInput className={domesticRequiredClass} value={domesticForm.passportNumber} onChange={(event) => setDomesticForm((previous) => ({ ...previous, passportNumber: event.target.value }))} /></ProfileField>
            <ProfileField label="СНИЛС" required><FieldInput className={domesticRequiredClass} value={domesticForm.snils} onChange={(event) => setDomesticForm((previous) => ({ ...previous, snils: event.target.value }))} /></ProfileField>
            <ProfileField label={isRu ? 'Код подразделения' : 'Subdivision code'} required><FieldInput className={domesticRequiredClass} value={domesticForm.subdivisionCode} onChange={(event) => setDomesticForm((previous) => ({ ...previous, subdivisionCode: event.target.value }))} /></ProfileField>
            <ProfileField label={isRu ? 'Место рождения' : 'Place of birth'} required><FieldInput className={domesticRequiredClass} value={domesticForm.placeOfBirth} onChange={(event) => setDomesticForm((previous) => ({ ...previous, placeOfBirth: event.target.value }))} /></ProfileField>
            <ProfileField label={isRu ? 'Скан внутреннего паспорта' : 'Domestic scan'} required><DocumentSelect className={domesticRequiredClass} locale={locale} documents={documents} value={domesticForm.scanAssetId} onChange={(scanAssetId) => setDomesticForm((previous) => ({ ...previous, scanAssetId }))} /></ProfileField>
          </div>
        ) : (
          <div className="profile-form-three-col">
            <ProfileField label={isRu ? 'Тип документа' : 'Document type'} required>
              <FieldSelect className={domesticRequiredClass} value={domesticForm.documentType} onChange={(event) => setDomesticForm((previous) => ({ ...previous, documentType: event.target.value }))}>
                <option value="PASSPORT">Passport</option>
                <option value="ID_CARD">ID card</option>
                <option value="RESIDENCE_PERMIT">Residence permit</option>
                <option value="OTHER">Other</option>
              </FieldSelect>
            </ProfileField>
            <ProfileField label={isRu ? 'Серия' : 'Series'} required={citizenship === 'UZ'}><FieldInput className={domesticRequiredClass} value={domesticForm.documentSeries} onChange={(event) => setDomesticForm((previous) => ({ ...previous, documentSeries: event.target.value }))} /></ProfileField>
            <ProfileField label={isRu ? 'Номер' : 'Number'} required><FieldInput className={domesticRequiredClass} value={domesticForm.documentNumber} onChange={(event) => setDomesticForm((previous) => ({ ...previous, documentNumber: event.target.value }))} /></ProfileField>
            {citizenship === 'UZ' ? <ProfileField label="ПИНФЛ" required><FieldInput className={domesticRequiredClass} value={domesticForm.pinfl} onChange={(event) => setDomesticForm((previous) => ({ ...previous, pinfl: event.target.value }))} /></ProfileField> : null}
            <ProfileField label={isRu ? 'Срок действия' : 'Expiry date'} required={citizenship === 'UZ'}><FieldInput className={domesticRequiredClass} type="date" value={domesticForm.expiryDate} onChange={(event) => setDomesticForm((previous) => ({ ...previous, expiryDate: event.target.value }))} /></ProfileField>
            <ProfileField label={isRu ? 'Место рождения' : 'Place of birth'} required={citizenship !== 'UZ'}><FieldInput className={domesticRequiredClass} value={domesticForm.placeOfBirth} onChange={(event) => setDomesticForm((previous) => ({ ...previous, placeOfBirth: event.target.value }))} /></ProfileField>
            <ProfileField label={isRu ? 'Скан документа' : 'Document scan'} required><DocumentSelect className={domesticRequiredClass} locale={locale} documents={documents} value={domesticForm.scanAssetId} onChange={(scanAssetId) => setDomesticForm((previous) => ({ ...previous, scanAssetId }))} /></ProfileField>
          </div>
        )}

        <div className="profile-latin-heading"><span className="signal-section-label">{isRu ? 'Заграничный паспорт' : 'International passport'}</span></div>
        <div className="profile-form-three-col">
          <ProfileField label={isRu ? 'Страна выдачи' : 'Country'} required><FieldInput className={internationalRequiredClass} value={internationalForm.countryCode} onChange={(event) => setInternationalForm((previous) => ({ ...previous, countryCode: event.target.value.toUpperCase() }))} /></ProfileField>
          <ProfileField label={isRu ? 'Серия' : 'Series'}><FieldInput value={internationalForm.series} onChange={(event) => setInternationalForm((previous) => ({ ...previous, series: event.target.value }))} /></ProfileField>
          <ProfileField label={isRu ? 'Номер' : 'Number'} required><FieldInput className={internationalRequiredClass} value={internationalForm.number} onChange={(event) => setInternationalForm((previous) => ({ ...previous, number: event.target.value }))} /></ProfileField>
          <ProfileField label={isRu ? 'Дата выдачи' : 'Issue date'} required><FieldInput className={internationalRequiredClass} type="date" value={internationalForm.issueDate} onChange={(event) => setInternationalForm((previous) => ({ ...previous, issueDate: event.target.value }))} /></ProfileField>
          <ProfileField label={isRu ? 'Срок действия' : 'Expiry date'} required><FieldInput className={internationalRequiredClass} type="date" value={internationalForm.expiryDate} onChange={(event) => setInternationalForm((previous) => ({ ...previous, expiryDate: event.target.value }))} /></ProfileField>
          <ProfileField label={isRu ? 'Кем выдан' : 'Issued by'} required><FieldInput className={internationalRequiredClass} value={internationalForm.issuedBy} onChange={(event) => setInternationalForm((previous) => ({ ...previous, issuedBy: event.target.value }))} /></ProfileField>
          <ProfileField label={isRu ? 'Скан загранпаспорта' : 'Passport scan'} required><DocumentSelect className={internationalRequiredClass} locale={locale} documents={documents} value={internationalForm.scanAssetId} onChange={(scanAssetId) => setInternationalForm((previous) => ({ ...previous, scanAssetId }))} /></ProfileField>
        </div>

        <div className="profile-latin-heading"><span className="signal-section-label">{isRu ? 'Дополнительные документы' : 'Additional documents'}</span></div>
        <div className="profile-form-three-col">
          <ProfileField label={isRu ? 'Справка школы' : 'School proof'}><DocumentSelect locale={locale} documents={documents} value={additional.SCHOOL_PROOF} onChange={(assetId) => setAdditional((previous) => ({ ...previous, SCHOOL_PROOF: assetId }))} /></ProfileField>
          <ProfileField label={isRu ? 'Справка студента' : 'Student proof'}><DocumentSelect locale={locale} documents={documents} value={additional.STUDENT_PROOF} onChange={(assetId) => setAdditional((previous) => ({ ...previous, STUDENT_PROOF: assetId }))} /></ProfileField>
          <ProfileField label={isRu ? 'Свидетельство о рождении' : 'Birth certificate'}><DocumentSelect locale={locale} documents={documents} value={additional.BIRTH_CERTIFICATE} onChange={(assetId) => setAdditional((previous) => ({ ...previous, BIRTH_CERTIFICATE: assetId }))} /></ProfileField>
        </div>
        <ToolbarRow><ProfileSectionActions locale={locale} saving={saving} /></ToolbarRow>
      </form>
    </ProfileSectionLayout>
  );
}

function DocumentSelect({ locale, documents, value, className, onChange }: { locale: string; documents: ProfileDocument[]; value: string; className?: string; onChange: (assetId: string) => void }) {
  return (
    <FieldSelect className={className} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{locale === 'ru' ? 'Выберите файл' : 'Select file'}</option>
      {documents.map((document) => <option key={document.id} value={document.id}>{document.originalFilename}</option>)}
    </FieldSelect>
  );
}

function ProfileField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="cabinet-field-block"><span className="cabinet-field-label">{label}{required ? <b className="signal-field-required">*</b> : null}</span>{children}</label>;
}

function toDateInput(value: string | Date | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}
