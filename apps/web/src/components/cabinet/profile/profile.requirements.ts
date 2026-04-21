import { PROFILE_SECTION_COPY, PROFILE_SECTION_ORDER, getLocaleKey } from './profile.config';
import type { ProfileSectionKey } from './profile.types';

export type RegistrationMissingField = {
  key: string;
  label?: string;
  scope?: 'PROFILE' | 'EVENT_FORM' | string;
  action?: 'PROFILE' | 'EVENT_FORM' | string;
};

type LocalizedLabel = Record<'ru' | 'en', string>;

export const PROFILE_REQUIREMENT_LABELS: Record<string, LocalizedLabel> = {
  name: { ru: 'ФИО', en: 'Full name' },
  phone: { ru: 'Телефон', en: 'Phone' },
  telegram: { ru: 'Telegram', en: 'Telegram' },
  birthDate: { ru: 'Дата рождения', en: 'Date of birth' },
  gender: { ru: 'Пол', en: 'Gender' },
  citizenshipCountryCode: { ru: 'Гражданство', en: 'Citizenship' },
  residenceCountryCode: { ru: 'Страна проживания', en: 'Residence country' },
  lastNameCyrillic: { ru: 'Фамилия кириллицей', en: 'Last name Cyrillic' },
  firstNameCyrillic: { ru: 'Имя кириллицей', en: 'First name Cyrillic' },
  middleNameCyrillic: { ru: 'Отчество кириллицей', en: 'Middle name Cyrillic' },
  lastNameLatin: { ru: 'Фамилия латиницей', en: 'Last name Latin' },
  firstNameLatin: { ru: 'Имя латиницей', en: 'First name Latin' },
  middleNameLatin: { ru: 'Отчество латиницей', en: 'Middle name Latin' },
  hasNoLastName: { ru: 'Нет фамилии', en: 'No last name' },
  hasNoFirstName: { ru: 'Нет имени', en: 'No first name' },
  hasNoMiddleName: { ru: 'Нет отчества', en: 'No middle name' },
  consentPersonalData: { ru: 'Согласие на обработку данных', en: 'Personal data consent' },
  consentMailing: { ru: 'Согласие на рассылку', en: 'Mailing consent' },
  avatarUrl: { ru: 'Фото профиля', en: 'Profile photo' },
  avatarAssetId: { ru: 'Фото профиля', en: 'Profile photo' },
  photo: { ru: 'Фото профиля', en: 'Profile photo' },
  city: { ru: 'Город', en: 'City' },
  factualAddress: { ru: 'Фактический адрес', en: 'Factual address' },
  regionId: { ru: 'Регион проживания', en: 'Residence region' },
  districtId: { ru: 'Район проживания', en: 'Residence district' },
  settlementId: { ru: 'Населённый пункт', en: 'Settlement' },
  regionText: { ru: 'Регион проживания', en: 'Residence region' },
  districtText: { ru: 'Район проживания', en: 'Residence district' },
  settlementText: { ru: 'Населённый пункт', en: 'Settlement' },
  street: { ru: 'Улица', en: 'Street' },
  house: { ru: 'Дом', en: 'House' },
  apartment: { ru: 'Квартира', en: 'Apartment' },
  postalCode: { ru: 'Почтовый индекс', en: 'Postal code' },
  nativeLanguage: { ru: 'Родной язык', en: 'Native language' },
  communicationLanguage: { ru: 'Язык общения', en: 'Communication language' },
  consentClientRules: { ru: 'Согласие с правилами платформы', en: 'Platform rules consent' },
  domesticDocumentComplete: { ru: 'Внутренний документ', en: 'Domestic document' },
  internationalPassportComplete: { ru: 'Загранпаспорт', en: 'International passport' },
  personalDocumentsComplete: { ru: 'Личные документы', en: 'Personal documents' },
  contactDataComplete: { ru: 'Контактные данные', en: 'Contact data' },
  maxUrl: { ru: 'MAX', en: 'MAX' },
  vkUrl: { ru: 'VK', en: 'VK' },
  telegramUrl: { ru: 'Telegram', en: 'Telegram' },
  instagramUrl: { ru: 'Instagram', en: 'Instagram' },
  facebookUrl: { ru: 'Facebook', en: 'Facebook' },
  xUrl: { ru: 'X', en: 'X' },
  maxAbsent: { ru: 'MAX отсутствует', en: 'MAX absent' },
  vkAbsent: { ru: 'VK отсутствует', en: 'VK absent' },
  telegramAbsent: { ru: 'Telegram отсутствует', en: 'Telegram absent' },
  instagramAbsent: { ru: 'Instagram отсутствует', en: 'Instagram absent' },
  facebookAbsent: { ru: 'Facebook отсутствует', en: 'Facebook absent' },
  xAbsent: { ru: 'X отсутствует', en: 'X absent' },
  activityStatus: { ru: 'Статус активности', en: 'Activity status' },
  studiesInRussia: { ru: 'Учёба в России', en: 'Studies in Russia' },
  organizationName: { ru: 'Организация', en: 'Organization' },
  facultyOrDepartment: { ru: 'Факультет или подразделение', en: 'Faculty or department' },
  classCourseYear: { ru: 'Класс или курс', en: 'Class or course year' },
  positionTitle: { ru: 'Должность', en: 'Position' },
  activityDirections: { ru: 'Направления активности', en: 'Activity directions' },
  englishLevel: { ru: 'Уровень английского', en: 'English level' },
  russianLevel: { ru: 'Уровень русского', en: 'Russian level' },
  additionalLanguages: { ru: 'Дополнительные языки', en: 'Additional languages' },
  achievementsText: { ru: 'Достижения', en: 'Achievements' },
  emergencyContact: { ru: 'Экстренный контакт', en: 'Emergency contact' },
};

const PROFILE_REQUIREMENT_SECTIONS: Record<string, ProfileSectionKey> = {
  name: 'registration_data',
  phone: 'registration_data',
  telegram: 'registration_data',
  birthDate: 'registration_data',
  gender: 'registration_data',
  citizenshipCountryCode: 'registration_data',
  residenceCountryCode: 'registration_data',
  lastNameCyrillic: 'registration_data',
  firstNameCyrillic: 'registration_data',
  middleNameCyrillic: 'registration_data',
  lastNameLatin: 'registration_data',
  firstNameLatin: 'registration_data',
  middleNameLatin: 'registration_data',
  hasNoLastName: 'registration_data',
  hasNoFirstName: 'registration_data',
  hasNoMiddleName: 'registration_data',
  consentPersonalData: 'registration_data',
  consentMailing: 'registration_data',
  avatarUrl: 'registration_data',
  avatarAssetId: 'registration_data',
  photo: 'registration_data',
  city: 'general_info',
  factualAddress: 'general_info',
  regionId: 'general_info',
  districtId: 'general_info',
  settlementId: 'general_info',
  regionText: 'general_info',
  districtText: 'general_info',
  settlementText: 'general_info',
  street: 'general_info',
  house: 'general_info',
  apartment: 'general_info',
  postalCode: 'general_info',
  nativeLanguage: 'general_info',
  communicationLanguage: 'general_info',
  consentClientRules: 'general_info',
  domesticDocumentComplete: 'personal_documents',
  internationalPassportComplete: 'personal_documents',
  personalDocumentsComplete: 'personal_documents',
  contactDataComplete: 'contact_data',
  maxUrl: 'contact_data',
  vkUrl: 'contact_data',
  telegramUrl: 'contact_data',
  instagramUrl: 'contact_data',
  facebookUrl: 'contact_data',
  xUrl: 'contact_data',
  maxAbsent: 'contact_data',
  vkAbsent: 'contact_data',
  telegramAbsent: 'contact_data',
  instagramAbsent: 'contact_data',
  facebookAbsent: 'contact_data',
  xAbsent: 'contact_data',
  activityStatus: 'activity_info',
  studiesInRussia: 'activity_info',
  organizationName: 'activity_info',
  facultyOrDepartment: 'activity_info',
  classCourseYear: 'activity_info',
  positionTitle: 'activity_info',
  activityDirections: 'activity_info',
  englishLevel: 'activity_info',
  russianLevel: 'activity_info',
  additionalLanguages: 'activity_info',
  achievementsText: 'activity_info',
  emergencyContact: 'activity_info',
};

export function parseRequiredFields(value: string | null) {
  return Array.from(new Set((value ?? '').split(',').map((field) => field.trim()).filter(Boolean)));
}

export function getProfileRequirementSection(field: string): ProfileSectionKey | null {
  return PROFILE_REQUIREMENT_SECTIONS[field] ?? null;
}

export function getFirstRequiredSection(fields: string[]) {
  for (const section of PROFILE_SECTION_ORDER) {
    if (fields.some((field) => getProfileRequirementSection(field) === section)) return section;
  }
  return null;
}

export function getRequiredSectionCounts(fields: string[]) {
  const counts: Partial<Record<ProfileSectionKey, number>> = {};
  for (const field of fields) {
    const section = getProfileRequirementSection(field);
    if (!section) continue;
    counts[section] = (counts[section] ?? 0) + 1;
  }
  return counts;
}

export function getProfileRequirementLabel(field: string, locale: string, fallback?: string) {
  const localeKey = getLocaleKey(locale);
  return PROFILE_REQUIREMENT_LABELS[field]?.[localeKey] ?? fallback ?? field;
}

export function getProfileRequirementDetails(fields: string[], locale: string) {
  const localeKey = getLocaleKey(locale);
  return PROFILE_SECTION_ORDER
    .map((section) => ({
      section,
      title: PROFILE_SECTION_COPY[section].title[localeKey],
      fields: fields
        .filter((field) => getProfileRequirementSection(field) === section)
        .map((field) => ({ key: field, label: getProfileRequirementLabel(field, locale) })),
    }))
    .filter((group) => group.fields.length > 0);
}

export function filterProfileMissingFields(fields: RegistrationMissingField[]) {
  return fields.filter((field) => field.scope === 'PROFILE' || field.action === 'PROFILE');
}

export function filterEventFormMissingFields(fields: RegistrationMissingField[]) {
  return fields.filter((field) => field.scope === 'EVENT_FORM' || field.action === 'EVENT_FORM');
}

export function buildProfileRequirementUrl({
  locale,
  requiredFields,
  eventTitle,
  returnTo,
}: {
  locale: string;
  requiredFields: string[];
  eventTitle?: string;
  returnTo?: string;
}) {
  const params = new URLSearchParams();
  const uniqueFields = Array.from(new Set(requiredFields.filter(Boolean)));
  if (uniqueFields.length) params.set('required', uniqueFields.join(','));
  if (eventTitle) params.set('event', eventTitle);
  if (returnTo) params.set('returnTo', returnTo);
  const firstSection = getFirstRequiredSection(uniqueFields);
  if (firstSection) params.set('section', firstSection);
  return `/${locale}/cabinet/profile?${params.toString()}`;
}
