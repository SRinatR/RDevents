export type ProfileSectionKey =
  | 'basic'
  | 'photo'
  | 'contacts'
  | 'address'
  | 'languages'
  | 'documents'
  | 'consents'
  | 'activity';

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

export interface ProfileActivity {
  events: any[];
  teams: any[];
  volunteerApplications: any[];
}
