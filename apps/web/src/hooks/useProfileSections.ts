'use client';

import { useCallback, useEffect, useState } from 'react';
import { authApi } from '../lib/api';
import { useAuth } from './useAuth';
import type {
  ProfileActivity,
  ProfileDocument,
  ProfileSectionKey,
  ProfileSectionState,
} from '@/components/cabinet/profile/profile.types';
import {
  PROFILE_SECTION_COPY,
  PROFILE_SECTION_ORDER,
  getLocaleKey,
} from '@/components/cabinet/profile/profile.config';

export function useProfileSections(locale = 'ru') {
  const { user, refreshUser } = useAuth();
  const localeKey = getLocaleKey(locale);
  const [sections, setSections] = useState<ProfileSectionState[]>(getDefaultSections(localeKey));
  const [documents, setDocuments] = useState<ProfileDocument[]>([]);
  const [activity, setActivity] = useState<ProfileActivity>({ events: [], teams: [], volunteerApplications: [] });
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<ProfileSectionKey | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const applySections = useCallback((nextSections: ProfileSectionState[]) => {
    const byKey = new Map(nextSections.map((section) => [section.key, section]));
    setSections(PROFILE_SECTION_ORDER.map((key) => ({
      key,
      title: PROFILE_SECTION_COPY[key].title[localeKey],
      description: PROFILE_SECTION_COPY[key].description[localeKey],
      status: byKey.get(key)?.status ?? 'NOT_STARTED',
    })));
  }, [localeKey]);

  const reloadSections = useCallback(async () => {
    if (!user) return;
    const { sections: nextSections } = await authApi.getProfileSections();
    applySections(nextSections as ProfileSectionState[]);
  }, [applySections, user]);

  const reloadDocuments = useCallback(async () => {
    if (!user) return;
    const { documents: nextDocuments } = await authApi.listProfileDocuments();
    setDocuments(nextDocuments as ProfileDocument[]);
  }, [user]);

  const reloadActivity = useCallback(async () => {
    if (!user) return;
    const nextActivity = await authApi.getProfileActivity();
    setActivity({
      events: Array.isArray(nextActivity.events) ? nextActivity.events : [],
      teams: Array.isArray(nextActivity.teams) ? nextActivity.teams : [],
      volunteerApplications: Array.isArray(nextActivity.volunteerApplications) ? nextActivity.volunteerApplications : [],
    });
  }, [user]);

  const reloadAll = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await Promise.all([reloadSections(), reloadDocuments(), reloadActivity()]);
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [reloadActivity, reloadDocuments, reloadSections, user]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  async function runSectionAction(sectionKey: ProfileSectionKey, action: () => Promise<void>, message: string) {
    setSavingSection(sectionKey);
    setError('');
    setSuccess('');
    try {
      await action();
      await reloadSections();
      setSuccess(message);
      window.setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Profile update failed');
    } finally {
      setSavingSection(null);
    }
  }

  const saveSection = useCallback(async (sectionKey: ProfileSectionKey, payload: Record<string, unknown>) => {
    await runSectionAction(sectionKey, async () => {
      await authApi.updateProfileSection(sectionKey, payload);
      await refreshUser();
    }, localeKey === 'ru' ? 'Раздел сохранён.' : 'Section saved.');
  }, [localeKey, refreshUser, reloadSections]);

  const uploadAvatar = useCallback(async (file: File) => {
    await runSectionAction('photo', async () => {
      await authApi.uploadAvatar(file);
      await refreshUser();
    }, localeKey === 'ru' ? 'Фото обновлено.' : 'Photo updated.');
  }, [localeKey, refreshUser, reloadSections]);

  const deleteAvatar = useCallback(async () => {
    await runSectionAction('photo', async () => {
      await authApi.deleteAvatar();
      await refreshUser();
    }, localeKey === 'ru' ? 'Фото удалено.' : 'Photo deleted.');
  }, [localeKey, refreshUser, reloadSections]);

  const uploadDocument = useCallback(async (file: File) => {
    await runSectionAction('documents', async () => {
      await authApi.uploadProfileDocument(file);
      await reloadDocuments();
    }, localeKey === 'ru' ? 'Документ загружен.' : 'Document uploaded.');
  }, [localeKey, reloadDocuments, reloadSections]);

  const deleteDocument = useCallback(async (assetId: string) => {
    await runSectionAction('documents', async () => {
      await authApi.deleteProfileDocument(assetId);
      await reloadDocuments();
    }, localeKey === 'ru' ? 'Документ удалён.' : 'Document deleted.');
  }, [localeKey, reloadDocuments, reloadSections]);

  const verifyContact = useCallback(async (channel: 'email' | 'phone' | 'telegram') => {
    await runSectionAction('contacts', async () => {
      await authApi.verifyProfileContact(channel);
      await refreshUser();
    }, localeKey === 'ru' ? 'Контакт подтверждён.' : 'Contact confirmed.');
  }, [localeKey, refreshUser, reloadSections]);

  return {
    sections,
    documents,
    activity,
    loading,
    savingSection,
    error,
    success,
    reloadSections,
    reloadDocuments,
    reloadActivity,
    saveSection,
    uploadAvatar,
    deleteAvatar,
    uploadDocument,
    deleteDocument,
    verifyContact,
    clearFeedback: () => {
      setError('');
      setSuccess('');
    },
  };
}

function getDefaultSections(locale: 'ru' | 'en'): ProfileSectionState[] {
  return PROFILE_SECTION_ORDER.map((key) => ({
    key,
    title: PROFILE_SECTION_COPY[key].title[locale],
    description: PROFILE_SECTION_COPY[key].description[locale],
    status: 'NOT_STARTED',
  }));
}
