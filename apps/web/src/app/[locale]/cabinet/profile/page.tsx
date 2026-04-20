'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingLines, Notice } from '@/components/ui/signal-primitives';
import { ProfileActivityInfoSection } from '@/components/cabinet/profile/ProfileActivityInfoSection';
import { ProfileContactDataSection } from '@/components/cabinet/profile/ProfileContactDataSection';
import { ProfileGeneralInfoSection } from '@/components/cabinet/profile/ProfileGeneralInfoSection';
import { ProfilePersonalDocumentsSection } from '@/components/cabinet/profile/ProfilePersonalDocumentsSection';
import { ProfileRegistrationDataSection } from '@/components/cabinet/profile/ProfileRegistrationDataSection';
import { ProfileWorkspaceShell } from '@/components/cabinet/profile/ProfileWorkspaceShell';
import { PROFILE_SECTION_ORDER } from '@/components/cabinet/profile/profile.config';
import type { ProfileSectionKey } from '@/components/cabinet/profile/profile.types';
import { useAuth } from '../../../../hooks/useAuth';
import { useProfileSections } from '../../../../hooks/useProfileSections';
import { useRouteLocale } from '../../../../hooks/useRouteParams';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const locale = useRouteLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requiredFields = useMemo(() => parseRequiredFields(searchParams.get('required')), [searchParams]);
  const eventTitle = searchParams.get('event') ?? '';
  const returnTo = searchParams.get('returnTo') ?? '';
  const activeSection = resolveInitialSectionFromQuery(searchParams);
  const {
    sections,
    documents,
    loading: sectionsLoading,
    savingSection,
    error,
    success,
    saveSection,
    uploadAvatar,
    deleteAvatar,
    uploadDocument,
    deleteDocument,
    fieldVisibility,
  } = useProfileSections(locale);
  const visibleRequiredFields = useMemo(() => {
    const visible = new Set(Object.values(fieldVisibility).flat());
    return requiredFields.filter((field) => visible.has(field));
  }, [fieldVisibility, requiredFields]);

  if (loading || !user) return null;

  const currentSectionState = sections.find((section) => section.key === activeSection);
  const currentStatus = currentSectionState?.status ?? 'NOT_STARTED';

  function handleSectionChange(section: ProfileSectionKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', section);
    router.replace(`/${locale}/cabinet/profile?${params.toString()}`);
  }

  async function saveSectionAndReturn(section: ProfileSectionKey, payload: Record<string, unknown>) {
    await saveSection(section, payload);
    if (isSafeReturnPath(returnTo, locale)) {
      router.push(returnTo);
    }
  }

  return (
    <ProfileWorkspaceShell
      locale={locale}
      sections={sections}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
    >
      {requiredFields.length > 0 ? (
        <Notice tone="warning">
          {locale === 'ru'
            ? `Чтобы завершить участие${eventTitle ? ` в "${eventTitle}"` : ''}, заполните нужные поля.`
            : `To complete participation${eventTitle ? ` in "${eventTitle}"` : ''}, fill the required fields.`}
        </Notice>
      ) : null}

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {sectionsLoading ? (
        <LoadingLines rows={5} />
      ) : (
        renderSection({
          activeSection,
          locale,
          user,
          status: currentStatus,
          savingSection,
          requiredFields: visibleRequiredFields,
          eventTitle,
          documents,
          fieldVisibility,
          saveSection: saveSectionAndReturn,
          uploadAvatar,
          deleteAvatar,
          uploadDocument,
          deleteDocument,
        })
      )}
    </ProfileWorkspaceShell>
  );
}

function renderSection({
  activeSection,
  locale,
  user,
  status,
  savingSection,
  requiredFields,
  fieldVisibility,
  eventTitle,
  documents,
  saveSection,
  uploadAvatar,
  deleteAvatar,
  uploadDocument,
  deleteDocument,
}: {
  activeSection: ProfileSectionKey;
  locale: string;
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  savingSection: ProfileSectionKey | null;
  requiredFields: string[];
  fieldVisibility: Record<string, string[]>;
  eventTitle: string;
  documents: any[];
  saveSection: (section: ProfileSectionKey, payload: Record<string, unknown>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  deleteAvatar: () => Promise<void>;
  uploadDocument: (file: File) => Promise<void>;
  deleteDocument: (assetId: string) => Promise<void>;
}) {
  if (activeSection === 'registration_data') {
    return (
      <ProfileRegistrationDataSection
        locale={locale}
        user={user}
        status={status}
        saving={savingSection === 'registration_data'}
        requiredFields={requiredFields}
        visibleFields={fieldVisibility.registration_data ?? []}
        eventTitle={eventTitle}
        onSave={(payload) => saveSection('registration_data', payload)}
      />
    );
  }

  if (activeSection === 'general_info') {
    return (
      <ProfileGeneralInfoSection
        locale={locale}
        user={user}
        status={status}
        saving={savingSection === 'general_info'}
        requiredFields={requiredFields}
        visibleFields={fieldVisibility.general_info ?? []}
        eventTitle={eventTitle}
        onSave={(payload) => saveSection('general_info', payload)}
        onUpload={uploadAvatar}
        onDelete={deleteAvatar}
      />
    );
  }

  if (activeSection === 'personal_documents') {
    return (
      <ProfilePersonalDocumentsSection
        locale={locale}
        user={user}
        status={status}
        saving={savingSection === 'personal_documents'}
        requiredFields={requiredFields}
        visibleFields={fieldVisibility.personal_documents ?? []}
        eventTitle={eventTitle}
        documents={documents}
        onSave={(payload) => saveSection('personal_documents', payload)}
        onUpload={uploadDocument}
        onDelete={deleteDocument}
      />
    );
  }

  if (activeSection === 'contact_data') {
    return (
      <ProfileContactDataSection
        locale={locale}
        user={user}
        status={status}
        saving={savingSection === 'contact_data'}
        requiredFields={requiredFields}
        visibleFields={fieldVisibility.contact_data ?? []}
        eventTitle={eventTitle}
        onSave={(payload) => saveSection('contact_data', payload)}
      />
    );
  }

  if (activeSection === 'activity_info') {
    return (
      <ProfileActivityInfoSection
        locale={locale}
        user={user}
        status={status}
        saving={savingSection === 'activity_info'}
        requiredFields={requiredFields}
        visibleFields={fieldVisibility.activity_info ?? []}
        eventTitle={eventTitle}
        onSave={(payload) => saveSection('activity_info', payload)}
      />
    );
  }

  return null;
}

function resolveInitialSectionFromQuery(searchParams: ReturnType<typeof useSearchParams>): ProfileSectionKey {
  const explicit = searchParams.get('section');
  if (explicit && isProfileSectionKey(explicit)) return explicit;

  const requiredSection = mapRequiredFieldsToSection(parseRequiredFields(searchParams.get('required')));
  return requiredSection ?? 'registration_data';
}

function mapRequiredFieldsToSection(fields: string[]): ProfileSectionKey | null {
  if (fields.some((field) => ['name', 'phone', 'telegram', 'birthDate', 'gender', 'citizenshipCountryCode', 'residenceCountryCode', 'lastNameCyrillic', 'firstNameCyrillic', 'middleNameCyrillic', 'lastNameLatin', 'firstNameLatin', 'middleNameLatin', 'hasNoLastName', 'hasNoFirstName', 'hasNoMiddleName', 'consentPersonalData', 'consentMailing'].includes(field))) return 'registration_data';
  if (fields.some((field) => ['avatarUrl', 'avatarAssetId', 'photo', 'city', 'factualAddress', 'regionId', 'districtId', 'settlementId', 'regionText', 'districtText', 'settlementText', 'street', 'house', 'apartment', 'postalCode', 'nativeLanguage', 'communicationLanguage', 'consentClientRules'].includes(field))) return 'general_info';
  if (fields.some((field) => ['domesticDocumentComplete', 'internationalPassportComplete', 'personalDocumentsComplete'].includes(field))) return 'personal_documents';
  if (fields.some((field) => ['contactDataComplete', 'maxUrl', 'vkUrl', 'telegramUrl', 'instagramUrl', 'facebookUrl', 'xUrl', 'maxAbsent', 'vkAbsent', 'telegramAbsent', 'instagramAbsent', 'facebookAbsent', 'xAbsent'].includes(field))) return 'contact_data';
  if (fields.some((field) => ['activityStatus', 'studiesInRussia', 'organizationName', 'facultyOrDepartment', 'classCourseYear', 'positionTitle', 'activityDirections', 'englishLevel', 'russianLevel', 'additionalLanguages', 'achievementsText', 'emergencyContact'].includes(field))) return 'activity_info';
  return null;
}

function parseRequiredFields(value: string | null) {
  return (value ?? '').split(',').map((field) => field.trim()).filter(Boolean);
}

function isProfileSectionKey(value: string): value is ProfileSectionKey {
  return (PROFILE_SECTION_ORDER as string[]).includes(value);
}

function isSafeReturnPath(value: string, locale: string) {
  return value.startsWith(`/${locale}/`) && !value.startsWith(`//`);
}
