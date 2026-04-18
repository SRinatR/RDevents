import type { ProfileSectionKey, ProfileSectionStatus } from './profile.types';

export const PROFILE_SECTION_ORDER: ProfileSectionKey[] = [
  'basic',
  'photo',
  'contacts',
  'address',
  'languages',
  'documents',
  'consents',
  'activity',
];

export const PROFILE_SECTION_COPY: Record<
  ProfileSectionKey,
  {
    title: Record<'ru' | 'en', string>;
    description: Record<'ru' | 'en', string>;
  }
> = {
  basic: {
    title: { ru: 'Основное', en: 'Basic' },
    description: { ru: 'ФИО и дата рождения', en: 'Name and birth date' },
  },
  photo: {
    title: { ru: 'Фото профиля', en: 'Profile photo' },
    description: { ru: 'Аватар для заявок и кабинета', en: 'Avatar for applications and cabinet' },
  },
  contacts: {
    title: { ru: 'Контакты', en: 'Contacts' },
    description: { ru: 'Телефон, Telegram и email', en: 'Phone, Telegram, and email' },
  },
  address: {
    title: { ru: 'Адрес и проживание', en: 'Address and residence' },
    description: { ru: 'Город и фактический адрес', en: 'City and factual address' },
  },
  languages: {
    title: { ru: 'Языки и коммуникация', en: 'Languages and communication' },
    description: { ru: 'Язык общения и родной язык', en: 'Communication and native language' },
  },
  documents: {
    title: { ru: 'Документы', en: 'Documents' },
    description: { ru: 'Файлы для участия и проверки', en: 'Files for participation and checks' },
  },
  consents: {
    title: { ru: 'Согласия', en: 'Consents' },
    description: { ru: 'Персональные данные и правила клиента', en: 'Personal data and client rules' },
  },
  activity: {
    title: { ru: 'Активность', en: 'Activity' },
    description: { ru: 'Мероприятия, заявки и команды', en: 'Events, applications, and teams' },
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

export function getLocaleKey(locale: string): 'ru' | 'en' {
  return locale === 'ru' ? 'ru' : 'en';
}
