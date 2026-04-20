export type ProfileSectionKey =
  | 'registration_data'
  | 'general_info'
  | 'personal_documents'
  | 'contact_data'
  | 'activity_info';

export type ProfileFieldType = 'string' | 'boolean' | 'date' | 'enum' | 'url' | 'object' | 'array' | 'composite';
export type ProfileStorageScope =
  | 'USER'
  | 'USER_EXTENDED_PROFILE'
  | 'USER_SOCIAL_LINKS'
  | 'USER_IDENTITY_DOCUMENT'
  | 'USER_INTERNATIONAL_PASSPORT'
  | 'USER_EMERGENCY_CONTACT'
  | 'DERIVED';

export type ProfileFieldRegistryItem = {
  key: string;
  sectionKey: ProfileSectionKey;
  type: ProfileFieldType;
  labelRu: string;
  labelEn: string;
  defaultVisibleInCabinet: boolean;
  allowEventRequirement: boolean;
  isCompositeRequirement: boolean;
  storageScope: ProfileStorageScope;
};

export const PROFILE_FIELD_REGISTRY: ProfileFieldRegistryItem[] = [
  { key: 'lastNameCyrillic', sectionKey: 'registration_data', type: 'string', labelRu: 'Фамилия (кириллица)', labelEn: 'Last name (Cyrillic)', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'firstNameCyrillic', sectionKey: 'registration_data', type: 'string', labelRu: 'Имя (кириллица)', labelEn: 'First name (Cyrillic)', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'middleNameCyrillic', sectionKey: 'registration_data', type: 'string', labelRu: 'Отчество (кириллица)', labelEn: 'Middle name (Cyrillic)', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'lastNameLatin', sectionKey: 'registration_data', type: 'string', labelRu: 'Фамилия (латиница)', labelEn: 'Last name (Latin)', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'firstNameLatin', sectionKey: 'registration_data', type: 'string', labelRu: 'Имя (латиница)', labelEn: 'First name (Latin)', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'middleNameLatin', sectionKey: 'registration_data', type: 'string', labelRu: 'Отчество (латиница)', labelEn: 'Middle name (Latin)', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'hasNoLastName', sectionKey: 'registration_data', type: 'boolean', labelRu: 'Нет фамилии', labelEn: 'No last name', defaultVisibleInCabinet: true, allowEventRequirement: false, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'hasNoFirstName', sectionKey: 'registration_data', type: 'boolean', labelRu: 'Нет имени', labelEn: 'No first name', defaultVisibleInCabinet: true, allowEventRequirement: false, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'hasNoMiddleName', sectionKey: 'registration_data', type: 'boolean', labelRu: 'Нет отчества', labelEn: 'No middle name', defaultVisibleInCabinet: true, allowEventRequirement: false, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'birthDate', sectionKey: 'registration_data', type: 'date', labelRu: 'Дата рождения', labelEn: 'Birth date', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'gender', sectionKey: 'registration_data', type: 'enum', labelRu: 'Пол', labelEn: 'Gender', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'citizenshipCountryCode', sectionKey: 'registration_data', type: 'string', labelRu: 'Гражданство', labelEn: 'Citizenship', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'residenceCountryCode', sectionKey: 'registration_data', type: 'string', labelRu: 'Страна проживания', labelEn: 'Residence country', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'phone', sectionKey: 'registration_data', type: 'string', labelRu: 'Телефон', labelEn: 'Phone', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'telegram', sectionKey: 'registration_data', type: 'string', labelRu: 'Telegram', labelEn: 'Telegram', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'consentPersonalData', sectionKey: 'registration_data', type: 'boolean', labelRu: 'Согласие на персональные данные', labelEn: 'Personal data consent', defaultVisibleInCabinet: true, allowEventRequirement: false, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'consentMailing', sectionKey: 'registration_data', type: 'boolean', labelRu: 'Согласие на рассылку', labelEn: 'Mailing consent', defaultVisibleInCabinet: true, allowEventRequirement: false, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },

  { key: 'avatarUrl', sectionKey: 'general_info', type: 'string', labelRu: 'Фото профиля URL', labelEn: 'Profile photo URL', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'avatarAssetId', sectionKey: 'general_info', type: 'string', labelRu: 'Фото профиля', labelEn: 'Profile photo', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'nativeLanguage', sectionKey: 'general_info', type: 'string', labelRu: 'Родной язык', labelEn: 'Native language', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'communicationLanguage', sectionKey: 'general_info', type: 'string', labelRu: 'Язык коммуникации', labelEn: 'Communication language', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'regionId', sectionKey: 'general_info', type: 'string', labelRu: 'Регион', labelEn: 'Region', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'districtId', sectionKey: 'general_info', type: 'string', labelRu: 'Район', labelEn: 'District', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'settlementId', sectionKey: 'general_info', type: 'string', labelRu: 'Населённый пункт', labelEn: 'Settlement', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'regionText', sectionKey: 'general_info', type: 'string', labelRu: 'Регион (текст)', labelEn: 'Region (text)', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'districtText', sectionKey: 'general_info', type: 'string', labelRu: 'Район (текст)', labelEn: 'District (text)', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'settlementText', sectionKey: 'general_info', type: 'string', labelRu: 'Населённый пункт (текст)', labelEn: 'Settlement (text)', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'street', sectionKey: 'general_info', type: 'string', labelRu: 'Улица', labelEn: 'Street', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'house', sectionKey: 'general_info', type: 'string', labelRu: 'Дом', labelEn: 'House', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'apartment', sectionKey: 'general_info', type: 'string', labelRu: 'Квартира', labelEn: 'Apartment', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'postalCode', sectionKey: 'general_info', type: 'string', labelRu: 'Почтовый индекс', labelEn: 'Postal code', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'city', sectionKey: 'general_info', type: 'string', labelRu: 'Город', labelEn: 'City', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'factualAddress', sectionKey: 'general_info', type: 'string', labelRu: 'Фактический адрес', labelEn: 'Factual address', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER' },
  { key: 'consentClientRules', sectionKey: 'general_info', type: 'boolean', labelRu: 'Согласие с правилами клиента', labelEn: 'Client rules consent', defaultVisibleInCabinet: true, allowEventRequirement: false, isCompositeRequirement: false, storageScope: 'USER' },

  { key: 'domesticDocumentComplete', sectionKey: 'personal_documents', type: 'composite', labelRu: 'Внутренний документ заполнен', labelEn: 'Domestic document complete', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: true, storageScope: 'DERIVED' },
  { key: 'internationalPassportComplete', sectionKey: 'personal_documents', type: 'composite', labelRu: 'Загранпаспорт заполнен', labelEn: 'International passport complete', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: true, storageScope: 'DERIVED' },
  { key: 'personalDocumentsComplete', sectionKey: 'personal_documents', type: 'composite', labelRu: 'Личные документы заполнены', labelEn: 'Personal documents complete', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: true, storageScope: 'DERIVED' },

  { key: 'contactDataComplete', sectionKey: 'contact_data', type: 'composite', labelRu: 'Контакты заполнены', labelEn: 'Contact data complete', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: true, storageScope: 'DERIVED' },
  { key: 'maxUrl', sectionKey: 'contact_data', type: 'url', labelRu: 'MAX ссылка', labelEn: 'MAX URL', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_SOCIAL_LINKS' },
  { key: 'vkUrl', sectionKey: 'contact_data', type: 'url', labelRu: 'VK ссылка', labelEn: 'VK URL', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_SOCIAL_LINKS' },
  { key: 'telegramUrl', sectionKey: 'contact_data', type: 'url', labelRu: 'Telegram ссылка', labelEn: 'Telegram URL', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_SOCIAL_LINKS' },
  { key: 'instagramUrl', sectionKey: 'contact_data', type: 'url', labelRu: 'Instagram ссылка', labelEn: 'Instagram URL', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_SOCIAL_LINKS' },
  { key: 'facebookUrl', sectionKey: 'contact_data', type: 'url', labelRu: 'Facebook ссылка', labelEn: 'Facebook URL', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_SOCIAL_LINKS' },
  { key: 'xUrl', sectionKey: 'contact_data', type: 'url', labelRu: 'X ссылка', labelEn: 'X URL', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_SOCIAL_LINKS' },
  { key: 'maxAbsent', sectionKey: 'contact_data', type: 'boolean', labelRu: 'MAX отсутствует', labelEn: 'MAX absent', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_SOCIAL_LINKS' },
  { key: 'vkAbsent', sectionKey: 'contact_data', type: 'boolean', labelRu: 'VK отсутствует', labelEn: 'VK absent', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_SOCIAL_LINKS' },
  { key: 'telegramAbsent', sectionKey: 'contact_data', type: 'boolean', labelRu: 'Telegram отсутствует', labelEn: 'Telegram absent', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_SOCIAL_LINKS' },
  { key: 'instagramAbsent', sectionKey: 'contact_data', type: 'boolean', labelRu: 'Instagram отсутствует', labelEn: 'Instagram absent', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_SOCIAL_LINKS' },
  { key: 'facebookAbsent', sectionKey: 'contact_data', type: 'boolean', labelRu: 'Facebook отсутствует', labelEn: 'Facebook absent', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_SOCIAL_LINKS' },
  { key: 'xAbsent', sectionKey: 'contact_data', type: 'boolean', labelRu: 'X отсутствует', labelEn: 'X absent', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_SOCIAL_LINKS' },

  { key: 'activityStatus', sectionKey: 'activity_info', type: 'enum', labelRu: 'Статус активности', labelEn: 'Activity status', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'studiesInRussia', sectionKey: 'activity_info', type: 'boolean', labelRu: 'Учусь в России', labelEn: 'Studies in Russia', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'organizationName', sectionKey: 'activity_info', type: 'string', labelRu: 'Организация', labelEn: 'Organization', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'facultyOrDepartment', sectionKey: 'activity_info', type: 'string', labelRu: 'Факультет / отдел', labelEn: 'Faculty / department', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'classCourseYear', sectionKey: 'activity_info', type: 'string', labelRu: 'Класс / курс / год', labelEn: 'Class / course / year', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'positionTitle', sectionKey: 'activity_info', type: 'string', labelRu: 'Должность', labelEn: 'Position', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'activityDirections', sectionKey: 'activity_info', type: 'array', labelRu: 'Направления активности', labelEn: 'Activity directions', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'DERIVED' },
  { key: 'englishLevel', sectionKey: 'activity_info', type: 'enum', labelRu: 'Уровень английского', labelEn: 'English level', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'russianLevel', sectionKey: 'activity_info', type: 'enum', labelRu: 'Уровень русского', labelEn: 'Russian level', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'additionalLanguages', sectionKey: 'activity_info', type: 'array', labelRu: 'Дополнительные языки', labelEn: 'Additional languages', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'DERIVED' },
  { key: 'achievementsText', sectionKey: 'activity_info', type: 'string', labelRu: 'Достижения', labelEn: 'Achievements', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EXTENDED_PROFILE' },
  { key: 'emergencyContact', sectionKey: 'activity_info', type: 'object', labelRu: 'Экстренный контакт', labelEn: 'Emergency contact', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'USER_EMERGENCY_CONTACT' },
];

export const PROFILE_FIELD_REGISTRY_BY_KEY = new Map(PROFILE_FIELD_REGISTRY.map((item) => [item.key, item]));

export function getProfileFieldRegistryItem(key: string) {
  return PROFILE_FIELD_REGISTRY_BY_KEY.get(key);
}
