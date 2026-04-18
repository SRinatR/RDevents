'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingLines, Notice } from '@/components/ui/signal-primitives';
import { ProfileAddressSection } from '@/components/cabinet/profile/ProfileAddressSection';
import { ProfileBasicSection } from '@/components/cabinet/profile/ProfileBasicSection';
import { ProfileContactsSection } from '@/components/cabinet/profile/ProfileContactsSection';
import { ProfileDocumentsSection } from '@/components/cabinet/profile/ProfileDocumentsSection';
import { ProfileLanguagesSection } from '@/components/cabinet/profile/ProfileLanguagesSection';
import { ProfilePhotoSection } from '@/components/cabinet/profile/ProfilePhotoSection';
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
  } = useProfileSections(locale);

  if (loading || !user) return null;

  const currentSectionState = sections.find((section) => section.key === activeSection);
  const currentStatus = currentSectionState?.status ?? 'NOT_STARTED';

  function handleSectionChange(section: ProfileSectionKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', section);
    router.replace(`/${locale}/cabinet/profile?${params.toString()}`);
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
          requiredFields,
          eventTitle,
          documents,
          saveSection,
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
  eventTitle: string;
  documents: any[];
  saveSection: (section: ProfileSectionKey, payload: Record<string, unknown>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  deleteAvatar: () => Promise<void>;
  uploadDocument: (file: File) => Promise<void>;
  deleteDocument: (assetId: string) => Promise<void>;
}) {
  if (activeSection === 'basic') {
    return (
      <ProfileBasicSection
        locale={locale}
        user={user}
        status={status}
        saving={savingSection === 'basic'}
        requiredFields={requiredFields}
        eventTitle={eventTitle}
        onSave={(payload) => saveSection('basic', payload)}
      />
    );
  }

  if (activeSection === 'photo') {
    return (
      <ProfilePhotoSection
        locale={locale}
        user={user}
        status={status}
        saving={savingSection === 'photo'}
        requiredFields={requiredFields}
        eventTitle={eventTitle}
        onUpload={uploadAvatar}
        onDelete={deleteAvatar}
      />
    );
  }

  if (activeSection === 'contacts') {
    return (
      <ProfileContactsSection
        locale={locale}
        user={user}
        status={status}
        saving={savingSection === 'contacts'}
        requiredFields={requiredFields}
        eventTitle={eventTitle}
        onSave={(payload) => saveSection('contacts', payload)}
      />
    );
  }

  if (activeSection === 'address') {
    return (
      <ProfileAddressSection
        locale={locale}
        user={user}
        status={status}
        saving={savingSection === 'address'}
        requiredFields={requiredFields}
        eventTitle={eventTitle}
        onSave={(payload) => saveSection('address', payload)}
      />
    );
  }

  if (activeSection === 'languages') {
    return (
      <ProfileLanguagesSection
        locale={locale}
        user={user}
        status={status}
        saving={savingSection === 'languages'}
        requiredFields={requiredFields}
        eventTitle={eventTitle}
        onSave={(payload) => saveSection('languages', payload)}
      />
    );
  }

  if (activeSection === 'documents') {
    return (
      <ProfileDocumentsSection
        locale={locale}
        status={status}
        saving={savingSection === 'documents'}
        documents={documents}
        onUpload={uploadDocument}
        onDelete={deleteDocument}
      />
    );
  }

  return null;
}

function resolveInitialSectionFromQuery(searchParams: ReturnType<typeof useSearchParams>): ProfileSectionKey {
  const explicit = searchParams.get('section');
  if (explicit && isProfileSectionKey(explicit)) return explicit;

  const requiredSection = mapRequiredFieldsToSection(parseRequiredFields(searchParams.get('required')));
  return requiredSection ?? 'basic';
}

function mapRequiredFieldsToSection(fields: string[]): ProfileSectionKey | null {
  if (fields.some((field) => ['avatarUrl', 'avatarAssetId', 'photo'].includes(field))) return 'photo';
  if (fields.some((field) => ['phone', 'telegram'].includes(field))) return 'contacts';
  if (fields.some((field) => ['city', 'factualAddress'].includes(field))) return 'address';
  if (fields.some((field) => ['nativeLanguage', 'communicationLanguage'].includes(field))) return 'languages';
  return null;
}

function parseRequiredFields(value: string | null) {
  return (value ?? '').split(',').map((field) => field.trim()).filter(Boolean);
}

function isProfileSectionKey(value: string): value is ProfileSectionKey {
  return (PROFILE_SECTION_ORDER as string[]).includes(value);
}
