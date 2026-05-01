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
import {
  getFirstRequiredSection,
  getProfileRequirementDetails,
  getProfileRequirementSection,
  getRequiredSectionCounts,
  parseRequiredFields,
} from '@/components/cabinet/profile/profile.requirements';
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
  const requiredSectionCounts = useMemo(() => getRequiredSectionCounts(requiredFields), [requiredFields]);
  const requiredDetails = useMemo(() => getProfileRequirementDetails(requiredFields, locale), [requiredFields, locale]);
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
    uploadDocument,
    deleteDocument,
  } = useProfileSections(locale);

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
    const remainingFields = requiredFields.filter((field) => {
      const fieldSection = getProfileRequirementSection(field);
      return fieldSection && fieldSection !== section;
    });

    if (remainingFields.length > 0) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('required', remainingFields.join(','));
      params.set('section', getFirstRequiredSection(remainingFields) ?? 'registration_data');
      router.replace(`/${locale}/cabinet/profile?${params.toString()}`);
      return;
    }

    if (isSafeReturnPath(returnTo, locale)) {
      router.push(returnTo);
      return;
    }

    if (requiredFields.length > 0) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('required');
      params.delete('event');
      params.delete('returnTo');
      params.set('section', section);
      router.replace(`/${locale}/cabinet/profile?${params.toString()}`);
    }
  }

  return (
    <ProfileWorkspaceShell
      locale={locale}
      sections={sections}
      activeSection={activeSection}
      requiredSectionCounts={requiredSectionCounts}
      onSectionChange={handleSectionChange}
    >
      {requiredFields.length > 0 ? (
        <div className="profile-required-summary">
          <Notice tone="warning">
            {locale === 'ru'
              ? `Чтобы завершить участие${eventTitle ? ` в "${eventTitle}"` : ''}, заполните конкретные поля ниже. Разделы с недостающими данными подсвечены.`
              : `To complete participation${eventTitle ? ` in "${eventTitle}"` : ''}, fill the fields below. Sections with missing data are highlighted.`}
          </Notice>
          {requiredDetails.length > 0 ? (
            <div className="profile-required-groups" aria-label={locale === 'ru' ? 'Недостающие поля' : 'Missing fields'}>
              {requiredDetails.map((group) => (
                <div key={group.section} className="profile-required-group">
                  <strong>{group.title}</strong>
                  <span>{group.fields.map((field) => field.label).join(', ')}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
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
          requiredFields,
          eventTitle,
          documents,
          saveSection: saveSectionAndReturn,
          uploadAvatar,
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
  eventTitle,
  documents,
  saveSection,
  uploadAvatar,
  uploadDocument,
  deleteDocument,
}: {
  activeSection: ProfileSectionKey;
  locale: string;
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  savingSection: ProfileSectionKey | null;
  requiredFields: string[];
  eventTitle: string;
  documents: any[];
  saveSection: (section: ProfileSectionKey, payload: Record<string, unknown>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
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
        eventTitle={eventTitle}
        onSave={(payload) => saveSection('registration_data', payload)}
        onUpload={uploadAvatar}
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
        eventTitle={eventTitle}
        onSave={(payload) => saveSection('general_info', payload)}
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

  const requiredSection = getFirstRequiredSection(parseRequiredFields(searchParams.get('required')));
  return requiredSection ?? 'registration_data';
}

function isProfileSectionKey(value: string): value is ProfileSectionKey {
  return (PROFILE_SECTION_ORDER as string[]).includes(value);
}

function isSafeReturnPath(value: string, locale: string) {
  return value.startsWith(`/${locale}/`) && !value.startsWith(`//`);
}
