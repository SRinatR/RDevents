export const PROFILE_SECTION_KEYS = [
  'registration_data',
  'general_info',
  'personal_documents',
  'contact_data',
  'activity_info',
] as const;

export type ProfileSectionKey = typeof PROFILE_SECTION_KEYS[number];

export type ProfileSectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export const PROFILE_SECTION_META: Record<ProfileSectionKey, { title: string; description: string }> = {
  registration_data: {
    title: 'Registration data',
    description: 'Identity, citizenship, phone, and core consent',
  },
  general_info: {
    title: 'General information',
    description: 'Photo, address, languages, and platform rules',
  },
  personal_documents: {
    title: 'Personal documents',
    description: 'Domestic document, international passport, and additional uploads',
  },
  contact_data: {
    title: 'Contact data',
    description: 'Social networks and public profile links',
  },
  activity_info: {
    title: 'Activity information',
    description: 'Work, studies, directions, languages, and achievements',
  },
};

export function isProfileSectionKey(value: string): value is ProfileSectionKey {
  return (PROFILE_SECTION_KEYS as readonly string[]).includes(value);
}
