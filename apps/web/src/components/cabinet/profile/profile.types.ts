export type ProfileSectionKey =
  | 'registration_data'
  | 'general_info'
  | 'personal_documents'
  | 'contact_data'
  | 'activity_info';

export type ProfileSectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface ProfileSectionState {
  key: ProfileSectionKey;
  title: string;
  description?: string;
  status: ProfileSectionStatus;
}

export interface ProfileDocument {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
  createdAt: string;
  status: string;
}

export interface ReferenceOption {
  id?: string;
  code?: string;
  nameRu: string;
  nameEn: string;
}
