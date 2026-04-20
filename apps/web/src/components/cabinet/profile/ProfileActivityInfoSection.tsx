'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { FieldInput, FieldSelect, FieldTextarea, Notice } from '@/components/ui/signal-primitives';
import { ProfileSectionActions } from './ProfileSectionActions';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import { ACTIVITY_DIRECTION_OPTIONS, ACTIVITY_STATUS_OPTIONS, LANGUAGE_LEVEL_OPTIONS } from './profile.config';
import type { ProfileSectionStatus } from './profile.types';

type Props = {
  locale: string;
  user: any;
  status: ProfileSectionStatus;
  saving: boolean;
  requiredFields: string[];
  visibleFields: string[];
  eventTitle: string;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function ProfileActivityInfoSection({ locale, user, status, saving, requiredFields, visibleFields, eventTitle, onSave }: Props) {
  const isRu = locale === 'ru';
  const extended = user.extendedProfile ?? {};
  const [form, setForm] = useState({
    activityStatus: extended.activityStatus ?? '',
    studiesInRussia: Boolean(extended.studiesInRussia),
    organizationName: extended.organizationName ?? '',
    facultyOrDepartment: extended.facultyOrDepartment ?? '',
    classCourseYear: extended.classCourseYear ?? '',
    positionTitle: extended.positionTitle ?? '',
    achievementsText: extended.achievementsText ?? '',
    englishLevel: extended.englishLevel ?? '',
    russianLevel: extended.russianLevel ?? '',
    additionalLanguages: (user.additionalLanguages ?? []).map((item: any) => item.languageName).join(', '),
    emergencyFullName: user.emergencyContact?.fullName ?? '',
    emergencyRelationship: user.emergencyContact?.relationship ?? '',
    emergencyPhone: user.emergencyContact?.phone ?? '',
  });
  const [directions, setDirections] = useState<string[]>((user.activityDirections ?? []).map((item: any) => item.direction));

  function setField(key: keyof typeof form, value: string | boolean) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function toggleDirection(direction: string) {
    setDirections((previous) => previous.includes(direction) ? previous.filter((item) => item !== direction) : [...previous, direction]);
  }

  const requiredClass = (field: string) => requiredFields.includes(field) ? 'signal-field-required' : '';
  const isVisible = (field: string) => visibleFields.includes(field);

  function save() {
    return onSave({
      ...(isVisible('activityStatus') && { activityStatus: form.activityStatus }),
      ...(isVisible('studiesInRussia') && { studiesInRussia: form.studiesInRussia }),
      ...(isVisible('organizationName') && { organizationName: form.organizationName }),
      ...(isVisible('facultyOrDepartment') && { facultyOrDepartment: form.facultyOrDepartment }),
      ...(isVisible('classCourseYear') && { classCourseYear: form.classCourseYear }),
      ...(isVisible('positionTitle') && { positionTitle: form.positionTitle }),
      ...(isVisible('achievementsText') && { achievementsText: form.achievementsText }),
      ...(isVisible('englishLevel') && { englishLevel: form.englishLevel }),
      ...(isVisible('russianLevel') && { russianLevel: form.russianLevel }),
      ...(isVisible('activityDirections') && { activityDirections: directions }),
      ...(isVisible('additionalLanguages') && { additionalLanguages: form.additionalLanguages.split(',').map((item: string) => item.trim()).filter(Boolean) }),
      ...(isVisible('emergencyContact') && { emergencyContact: { fullName: form.emergencyFullName, relationship: form.emergencyRelationship, phone: form.emergencyPhone } }),
    });
  }

  return (
    <ProfileSectionLayout
      locale={locale}
      title={isRu ? 'Активность' : 'Activity information'}
      description={isRu ? 'Учёба, работа, направления, языковые уровни, достижения и экстренный контакт.' : 'Study, work, directions, language levels, achievements, and emergency contact.'}
      status={status}
    >
      {requiredFields.length > 0 ? <Notice tone="warning">{isRu ? `Эти данные нужны для заявки${eventTitle ? `: ${eventTitle}` : ''}.` : 'These data are required for your application.'}</Notice> : null}
      <form className="signal-stack" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="profile-form-three-col">
          <ProfileField label={isRu ? 'Статус' : 'Activity status'} required>
            <FieldSelect className={requiredClass('activityStatus')} value={form.activityStatus} onChange={(event) => setField('activityStatus', event.target.value)}>
              <option value="">{isRu ? 'Выберите' : 'Select'}</option>
              {ACTIVITY_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{activityStatusLabel(option, locale)}</option>)}
            </FieldSelect>
          </ProfileField>
          <ProfileField label={isRu ? 'Организация' : 'Organization'} required><FieldInput className={requiredClass('organizationName')} value={form.organizationName} onChange={(event) => setField('organizationName', event.target.value)} /></ProfileField>
          <ProfileField label={isRu ? 'Факультет / отдел' : 'Faculty / department'}><FieldInput className={requiredClass('facultyOrDepartment')} value={form.facultyOrDepartment} onChange={(event) => setField('facultyOrDepartment', event.target.value)} /></ProfileField>
          <ProfileField label={isRu ? 'Класс / курс / год' : 'Class / course / year'}><FieldInput className={requiredClass('classCourseYear')} value={form.classCourseYear} onChange={(event) => setField('classCourseYear', event.target.value)} /></ProfileField>
          <ProfileField label={isRu ? 'Должность' : 'Position'}><FieldInput className={requiredClass('positionTitle')} value={form.positionTitle} onChange={(event) => setField('positionTitle', event.target.value)} /></ProfileField>
          <label className="profile-consent-row"><input type="checkbox" checked={form.studiesInRussia} onChange={(event) => setField('studiesInRussia', event.target.checked)} /><span>{isRu ? 'Учусь в России' : 'Studies in Russia'}</span></label>
        </div>

        <div className={`profile-requirements-panel ${requiredFields.includes('activityDirections') ? 'signal-field-required' : ''}`}>
          <h3>{isRu ? 'Направления активности' : 'Activity directions'}</h3>
          <div className="admin-chip-grid">
            {ACTIVITY_DIRECTION_OPTIONS.map((direction) => (
              <label key={direction} className="profile-consent-row">
                <input type="checkbox" checked={directions.includes(direction)} onChange={() => toggleDirection(direction)} />
                <span>{directionLabel(direction, locale)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="profile-form-three-col">
          <ProfileField label={isRu ? 'Английский' : 'English'} required><LevelSelect className={requiredClass('englishLevel')} locale={locale} value={form.englishLevel} onChange={(value) => setField('englishLevel', value)} /></ProfileField>
          <ProfileField label={isRu ? 'Русский' : 'Russian'} required><LevelSelect className={requiredClass('russianLevel')} locale={locale} value={form.russianLevel} onChange={(value) => setField('russianLevel', value)} /></ProfileField>
          <ProfileField label={isRu ? 'Другие языки' : 'Additional languages'}><FieldInput className={requiredClass('additionalLanguages')} value={form.additionalLanguages} onChange={(event) => setField('additionalLanguages', event.target.value)} placeholder={isRu ? 'Узбекский, турецкий' : 'Uzbek, Turkish'} /></ProfileField>
        </div>

        <ProfileField label={isRu ? 'Достижения' : 'Achievements'}><FieldTextarea className={requiredClass('achievementsText')} rows={4} value={form.achievementsText} onChange={(event) => setField('achievementsText', event.target.value)} /></ProfileField>

        <Notice tone="info">{isRu ? 'Экстренный контакт рекомендован, но не блокирует готовность раздела.' : 'Emergency contact is recommended, but it does not block section completion.'}</Notice>
        <div className="profile-form-three-col">
          <ProfileField label={isRu ? 'ФИО контакта' : 'Contact full name'}><FieldInput value={form.emergencyFullName} onChange={(event) => setField('emergencyFullName', event.target.value)} /></ProfileField>
          <ProfileField label={isRu ? 'Кем приходится' : 'Relationship'}><FieldInput value={form.emergencyRelationship} onChange={(event) => setField('emergencyRelationship', event.target.value)} /></ProfileField>
          <ProfileField label={isRu ? 'Телефон контакта' : 'Contact phone'}><FieldInput value={form.emergencyPhone} onChange={(event) => setField('emergencyPhone', event.target.value)} /></ProfileField>
        </div>
        <ProfileSectionActions locale={locale} saving={saving} />
      </form>
    </ProfileSectionLayout>
  );
}

function LevelSelect({ locale, value, className, onChange }: { locale: string; value: string; className?: string; onChange: (value: string) => void }) {
  return (
    <FieldSelect className={className} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{locale === 'ru' ? 'Выберите' : 'Select'}</option>
      {LANGUAGE_LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{level === 'NATIVE' ? (locale === 'ru' ? 'Родной' : 'Native') : level}</option>)}
    </FieldSelect>
  );
}

function ProfileField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="cabinet-field-block"><span className="cabinet-field-label">{label}{required ? <b className="signal-field-required">*</b> : null}</span>{children}</label>;
}

function activityStatusLabel(value: string, locale: string) {
  const ru: Record<string, string> = {
    SCHOOL_STUDENT: 'Школьник',
    COLLEGE_STUDENT: 'Студент колледжа',
    UNIVERSITY_STUDENT: 'Студент вуза',
    EMPLOYED: 'Работаю',
    UNEMPLOYED: 'Не работаю',
  };
  const en: Record<string, string> = {
    SCHOOL_STUDENT: 'School student',
    COLLEGE_STUDENT: 'College student',
    UNIVERSITY_STUDENT: 'University student',
    EMPLOYED: 'Employed',
    UNEMPLOYED: 'Unemployed',
  };
  return (locale === 'ru' ? ru : en)[value] ?? value;
}

function directionLabel(value: string, locale: string) {
  const ru: Record<string, string> = {
    SCIENCE_EDUCATION: 'Наука и образование',
    PUBLIC_ADMINISTRATION_LAW: 'Госуправление и право',
    MEDIA: 'Медиа',
    CREATIVE_INDUSTRIES: 'Креативные индустрии',
    ENTREPRENEURSHIP: 'Предпринимательство',
    SPORT_HEALTHCARE: 'Спорт и здравоохранение',
    AGRICULTURE_AGROTECH: 'Сельское хозяйство',
    DIGITALIZATION_IT: 'Цифровизация и IT',
    TOURISM_HOSPITALITY: 'Туризм',
    ECOLOGY: 'Экология',
    CIVIL_SOCIETY: 'Гражданское общество',
    ARCHITECTURE_CONSTRUCTION: 'Архитектура и строительство',
    ECONOMICS_FINANCE: 'Экономика и финансы',
    INDUSTRY_TECHNOLOGY_ENGINEERING: 'Инженерия и промышленность',
    OTHER: 'Другое',
  };
  const en = value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  return locale === 'ru' ? (ru[value] ?? value) : en;
}
