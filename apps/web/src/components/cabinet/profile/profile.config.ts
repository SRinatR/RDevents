import type { ProfileSectionKey, ProfileSectionStatus } from './profile.types';

export const PROFILE_SECTION_ORDER: ProfileSectionKey[] = [
  'registration_data',
  'general_info',
  'personal_documents',
  'contact_data',
  'activity_info',
];

export const PROFILE_SECTION_COPY: Record<
  ProfileSectionKey,
  {
    title: Record<'ru' | 'en', string>;
    description: Record<'ru' | 'en', string>;
  }
> = {
  registration_data: {
    title: { ru: 'Регистрационные данные', en: 'Registration data' },
    description: { ru: 'ФИО, гражданство, дата рождения, телефон и согласия', en: 'Identity, citizenship, birth date, phone, and consent' },
  },
  general_info: {
    title: { ru: 'Общая информация', en: 'General information' },
    description: { ru: 'Фото, адрес проживания, языки и правила платформы', en: 'Photo, address, languages, and platform rules' },
  },
  personal_documents: {
    title: { ru: 'Личные документы', en: 'Personal documents' },
    description: { ru: 'Внутренний документ, загранпаспорт и подтверждающие файлы', en: 'Domestic document, international passport, and supporting uploads' },
  },
  contact_data: {
    title: { ru: 'Контактные данные', en: 'Contact data' },
    description: { ru: 'Социальные сети или отметка об отсутствии аккаунта', en: 'Social links or absence flags' },
  },
  activity_info: {
    title: { ru: 'Активность', en: 'Activity information' },
    description: { ru: 'Учёба, работа, направления, языковые уровни и достижения', en: 'Study, work, directions, language levels, and achievements' },
  },
};

export const PROFILE_STATUS_COPY: Record<
  ProfileSectionStatus,
  {
    label: Record<'ru' | 'en', string>;
    tone: 'neutral' | 'info' | 'success' | 'warning';
  }
> = {
  NOT_STARTED: {
    label: { ru: 'Не начато', en: 'Not started' },
    tone: 'neutral',
  },
  IN_PROGRESS: {
    label: { ru: 'В процессе', en: 'In progress' },
    tone: 'warning',
  },
  COMPLETED: {
    label: { ru: 'Готово', en: 'Done' },
    tone: 'success',
  },
};

export const GENDER_OPTIONS = ['MALE', 'FEMALE'] as const;
export const ACTIVITY_STATUS_OPTIONS = ['SCHOOL_STUDENT', 'COLLEGE_STUDENT', 'UNIVERSITY_STUDENT', 'EMPLOYED', 'UNEMPLOYED'] as const;
export const LANGUAGE_LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE'] as const;
export const ACTIVITY_DIRECTION_OPTIONS = [
  'SCIENCE_EDUCATION',
  'PUBLIC_ADMINISTRATION_LAW',
  'MEDIA',
  'CREATIVE_INDUSTRIES',
  'ENTREPRENEURSHIP',
  'SPORT_HEALTHCARE',
  'AGRICULTURE_AGROTECH',
  'DIGITALIZATION_IT',
  'TOURISM_HOSPITALITY',
  'ECOLOGY',
  'CIVIL_SOCIETY',
  'ARCHITECTURE_CONSTRUCTION',
  'ECONOMICS_FINANCE',
  'INDUSTRY_TECHNOLOGY_ENGINEERING',
  'OTHER',
] as const;

export function getLocaleKey(locale: string): 'ru' | 'en' {
  return locale === 'ru' ? 'ru' : 'en';
}
