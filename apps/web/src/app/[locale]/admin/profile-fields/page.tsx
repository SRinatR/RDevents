'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { LoadingLines, Notice } from '@/components/ui/signal-primitives';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi, ApiError } from '@/lib/api';

interface ProfileField {
  key: string;
  sectionKey: string;
  label: { ru: string; en: string };
  type: string;
  isVisibleInCabinet: boolean;
  allowEventRequirement: boolean;
  isCompositeRequirement: boolean;
  usedInEventsCount: number;
  usedInEvents?: Array<{ id: string; title: string }>;
}

interface ProfileFieldsData {
  data: ProfileField[];
}

type SectionKey = 'all' | 'registration_data' | 'general_info' | 'personal_documents' | 'contact_data' | 'activity_info';

const SECTION_LABELS: Record<SectionKey, { ru: string; en: string }> = {
  all: { ru: 'Все разделы', en: 'All sections' },
  registration_data: { ru: 'Регистрационные данные', en: 'Registration Data' },
  general_info: { ru: 'Общая информация', en: 'General Info' },
  personal_documents: { ru: 'Документы', en: 'Personal Documents' },
  contact_data: { ru: 'Контакты и соцсети', en: 'Contacts & Social' },
  activity_info: { ru: 'Образование и деятельность', en: 'Education & Activity' },
};

export default function ProfileFieldsAdminPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useRouteLocale();
  const { user, loading: authLoading } = useAuth();

  const [fields, setFields] = useState<ProfileField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<SectionKey>('all');
  const [showHidden, setShowHidden] = useState(false);

  const fetchFields = useCallback(async () => {
    try {
      const data = await adminApi.listProfileFields();
      setFields(data.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(locale === 'ru' ? 'Доступ запрещён' : 'Access denied');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchFields();
    }
  }, [authLoading, user, fetchFields]);

  async function toggleVisibility(fieldKey: string, currentVisibility: boolean) {
    setSaving(fieldKey);
    try {
      await adminApi.updateProfileField(fieldKey, {
        key: fieldKey,
        isVisibleInCabinet: !currentVisibility,
      });
      await fetchFields();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PROFILE_FIELD_IN_USE') {
        const eventTitles = (err.details as any)?.usedInEvents?.map((e: any) => e.title).join(', ');
        setError(
          locale === 'ru'
            ? `Невозможно скрыть: поле используется в событиях: ${eventTitles}`
            : `Cannot hide: field is used in events: ${eventTitles}`
        );
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      setSaving(null);
    }
  }

  if (authLoading || loading) {
    return <LoadingLines />;
  }

  if (!user) {
    router.push(`/${locale}/login?next=/${locale}/admin/profile-fields`);
    return null;
  }

  if (error) {
    return (
      <div className="admin-shell">
        <Notice tone="danger">{error}</Notice>
        <button onClick={fetchFields} className="btn btn-primary">
          {locale === 'ru' ? 'Повторить' : 'Retry'}
        </button>
      </div>
    );
  }

  const filteredFields = fields.filter(field => {
    if (selectedSection !== 'all' && field.sectionKey !== selectedSection) return false;
    if (!showHidden && !field.isVisibleInCabinet) return false;
    return true;
  });

  const groupedFields = filteredFields.reduce((acc, field) => {
    const section = field.sectionKey;
    if (!acc[section]) acc[section] = [];
    acc[section].push(field);
    return acc;
  }, {} as Record<string, ProfileField[]>);

  return (
    <div className="admin-shell">
      <div className="admin-header">
        <div>
          <h1>{locale === 'ru' ? 'Поля профиля' : 'Profile Fields'}</h1>
          <p className="text-muted">
            {locale === 'ru'
              ? 'Управление видимостью полей профиля в пользовательском кабинете'
              : 'Manage profile field visibility in user cabinet'}
          </p>
        </div>
      </div>

      <div className="admin-controls">
        <select
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value as SectionKey)}
          className="signal-field"
        >
          {Object.entries(SECTION_LABELS).map(([key, labels]) => (
            <option key={key} value={key}>
              {labels[locale === 'ru' ? 'ru' : 'en']}
            </option>
          ))}
        </select>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          <span>{locale === 'ru' ? 'Показать скрытые' : 'Show hidden'}</span>
        </label>
      </div>

      <div className="profile-fields-list">
        {Object.entries(groupedFields).map(([sectionKey, sectionFields]) => (
          <div key={sectionKey} className="profile-fields-section">
            <h3 className="section-title">
              {SECTION_LABELS[sectionKey as SectionKey]?.[locale === 'ru' ? 'ru' : 'en'] || sectionKey}
              <span className="section-count">{sectionFields.length}</span>
            </h3>

            <div className="fields-table">
              <div className="fields-table-header">
                <div className="col-field">{locale === 'ru' ? 'Поле' : 'Field'}</div>
                <div className="col-type">{locale === 'ru' ? 'Тип' : 'Type'}</div>
                <div className="col-visibility">{locale === 'ru' ? 'Видимость' : 'Visibility'}</div>
                <div className="col-events">{locale === 'ru' ? 'В событиях' : 'In events'}</div>
                <div className="col-actions">{locale === 'ru' ? 'Действия' : 'Actions'}</div>
              </div>

              {sectionFields.map(field => (
                <div key={field.key} className={`field-row ${!field.isVisibleInCabinet ? 'field-hidden' : ''}`}>
                  <div className="col-field">
                    <div className="field-label">
                      <code>{field.key}</code>
                      <span className="field-title">
                        {field.label[locale === 'ru' ? 'ru' : 'en']}
                      </span>
                    </div>
                  </div>
                  <div className="col-type">
                    <span className="type-badge">{field.type}</span>
                  </div>
                  <div className="col-visibility">
                    <span className={`visibility-badge ${field.isVisibleInCabinet ? 'visible' : 'hidden'}`}>
                      {field.isVisibleInCabinet
                        ? (locale === 'ru' ? 'Видим' : 'Visible')
                        : (locale === 'ru' ? 'Скрыт' : 'Hidden')}
                    </span>
                  </div>
                  <div className="col-events">
                    {field.usedInEventsCount > 0 ? (
                      <span className="events-count" title={field.usedInEvents?.map(e => e.title).join(', ')}>
                        {field.usedInEventsCount} {locale === 'ru' ? 'событий' : 'events'}
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </div>
                  <div className="col-actions">
                    <button
                      className={`btn btn-sm ${field.isVisibleInCabinet ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => toggleVisibility(field.key, field.isVisibleInCabinet)}
                      disabled={saving === field.key}
                      title={
                        field.isVisibleInCabinet
                          ? (locale === 'ru' ? 'Скрыть поле' : 'Hide field')
                          : (locale === 'ru' ? 'Показать поле' : 'Show field')
                      }
                    >
                      {saving === field.key ? '...' : field.isVisibleInCabinet ? '🔒' : '👁'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
