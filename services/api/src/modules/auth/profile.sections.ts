export const PROFILE_SECTION_KEYS = [
  'basic',
  'photo',
  'contacts',
  'address',
  'languages',
  'documents',
] as const;

export type ProfileSectionKey = typeof PROFILE_SECTION_KEYS[number];

export type ProfileSectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export const PROFILE_SECTION_FIELDS: Record<Exclude<ProfileSectionKey, 'documents'>, string[]> = {
  basic: [
    'lastNameCyrillic',
    'firstNameCyrillic',
    'middleNameCyrillic',
    'lastNameLatin',
    'firstNameLatin',
    'middleNameLatin',
    'birthDate',
  ],
  photo: [],
  contacts: ['phone', 'telegram'],
  address: ['city', 'factualAddress'],
  languages: ['nativeLanguage', 'communicationLanguage'],
};

export const PROFILE_SECTION_META: Record<ProfileSectionKey, { title: string; description: string }> = {
  basic: {
    title: 'Basic',
    description: 'Name and birth date',
  },
  photo: {
    title: 'Profile photo',
    description: 'Avatar upload and preview',
  },
  contacts: {
    title: 'Contacts',
    description: 'Phone, Telegram, and email',
  },
  address: {
    title: 'Address and residence',
    description: 'City and factual address',
  },
  languages: {
    title: 'Languages and communication',
    description: 'Preferred communication language',
  },
  documents: {
    title: 'Documents',
    description: 'Uploaded profile files',
  },
};

export function isProfileSectionKey(value: string): value is ProfileSectionKey {
  return (PROFILE_SECTION_KEYS as readonly string[]).includes(value);
}
