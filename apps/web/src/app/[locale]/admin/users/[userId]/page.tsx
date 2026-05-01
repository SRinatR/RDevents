'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, MetricCard, PageHeader, Panel, SectionHeader, StatusBadge, TableShell } from '@/components/ui/signal-primitives';
import styles from './page.module.css';

interface UserFullProfile {
  access?: {
    scope: 'event_admin' | 'platform_admin' | 'super_admin';
    eventId: string | null;
    sensitiveMasked: boolean;
    canRevealSensitive: boolean;
  };
  profile: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isActive: boolean;
    avatarUrl: string | null;
    avatarAssetId: string | null;
    city: string | null;
    phone: string | null;
    telegram: string | null;
    birthDate: string | null;
    registeredAt: string;
    lastLoginAt: string | null;
    phoneVerifiedAt: string | null;
    telegramVerifiedAt: string | null;
    emailVerifiedAt: string | null;
    lastNameCyrillic: string | null;
    firstNameCyrillic: string | null;
    middleNameCyrillic: string | null;
    lastNameLatin: string | null;
    firstNameLatin: string | null;
    middleNameLatin: string | null;
    fullNameCyrillic: string | null;
    fullNameLatin: string | null;
    hasNoLastName: boolean;
    bio: string | null;
    factualAddress: string | null;
    nativeLanguage: string | null;
    communicationLanguage: string | null;
    consentPersonalData: boolean;
    consentPersonalDataAt: string | null;
    consentClientRules: boolean;
    consentClientRulesAt: string | null;
    accounts: Array<{
      id: string;
      provider: string;
      providerEmail: string | null;
      linkedAt: string;
    }>;
  };
  extendedProfile: {
    gender: string | null;
    citizenshipCountryCode: string | null;
    residenceCountryCode: string | null;
    regionText: string | null;
    districtText: string | null;
    settlementText: string | null;
    street: string | null;
    house: string | null;
    apartment: string | null;
    postalCode: string | null;
    activityStatus: string | null;
    studiesInRussia: boolean;
    organizationName: string | null;
    facultyOrDepartment: string | null;
    classCourseYear: string | null;
    positionTitle: string | null;
    achievementsText: string | null;
    englishLevel: string | null;
    russianLevel: string | null;
  } | null;
  identityDocument: {
    documentType: string | null;
    citizenshipCountryCode: string | null;
    documentSeries: string | null;
    documentNumber: string | null;
    issueDate: string | null;
    issuedBy: string | null;
    expiryDate: string | null;
    placeOfBirth: string | null;
    pinfl: string | null;
    passportSeries: string | null;
    passportNumber: string | null;
    subdivisionCode: string | null;
    snils: string | null;
    hasSecondCitizenship: boolean;
    secondCitizenshipCountryCode: string | null;
    scanAsset: { id: string; publicUrl: string | null } | null;
  } | null;
  internationalPassport: {
    countryCode: string | null;
    series: string | null;
    number: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    issuedBy: string | null;
    scanAsset: { id: string; publicUrl: string | null } | null;
  } | null;
  additionalDocuments: Array<{
    type: string;
    notes: string | null;
    asset: { id: string; publicUrl: string | null };
  }>;
  socialLinks: {
    maxUrl: string | null;
    vkUrl: string | null;
    telegramUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    xUrl: string | null;
  } | null;
  activityDirections: string[];
  additionalLanguages: string[];
  avatarHistory: Array<{
    id: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    publicUrl: string | null;
    status: string;
    createdAt: string;
    deletedAt: string | null;
    isCurrent: boolean;
  }>;
  profileHistory: Array<{
    id: string;
    action: string;
    sectionKey: string | null;
    assetId: string | null;
    changedFields: string[];
    createdAt: string;
    actor: { id: string; email: string; name: string | null; role: string } | null;
    asset: { id: string; originalFilename: string; publicUrl: string | null; mimeType: string } | null;
  }>;
  emergencyContact: {
    fullName: string | null;
    relationship: string | null;
    phone: string | null;
  } | null;
  eventMemberships: Array<{
    id: string;
    role: string;
    status: string;
    assignedAt: string;
    approvedAt: string | null;
    rejectedAt: string | null;
    removedAt: string | null;
    notes: string | null;
    event: {
      id: string;
      title: string;
      slug: string;
      status: string;
      startsAt: string | null;
      endsAt: string | null;
    };
  }>;
  teamMemberships: Array<{
    id: string;
    role: string;
    status: string;
    joinedAt: string;
    approvedAt: string | null;
    removedAt: string | null;
    team: {
      id: string;
      name: string;
      status: string;
      captainUserId: string | null;
      eventId: string;
      eventTitle: string;
      eventSlug: string;
    };
  }>;
  selectedEventContext?: {
    event: {
      id: string;
      title: string;
      slug: string;
      status: string;
      startsAt: string | null;
      endsAt: string | null;
    };
    participantMembership: {
      id: string;
      status: string;
      assignedAt: string;
      approvedAt: string | null;
    } | null;
    volunteerMembership: {
      id: string;
      status: string;
      assignedAt: string;
      approvedAt: string | null;
    } | null;
    eventAdminMembership: {
      id: string;
      status: string;
      assignedAt: string;
      approvedAt: string | null;
    } | null;
    registrationAnswers: {
      id: string;
      answersJson: Record<string, unknown>;
      isComplete: boolean;
      createdAt: string;
    } | null;
    teamMembership: {
      id: string;
      role: string;
      status: string;
      joinedAt: string;
      team: {
        id: string;
        name: string;
        status: string;
        captainUserId: string | null;
      };
    } | null;
  };
}

type ProfileTab = 'overview' | 'documents' | 'activity' | 'history';

const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  ACTIVE: 'success',
  APPROVED: 'success',
  PENDING: 'warning',
  RESERVE: 'info',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  REMOVED: 'neutral',
  LEFT: 'neutral',
};

const toneByRole: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  SUPER_ADMIN: 'warning',
  PLATFORM_ADMIN: 'info',
  EVENT_ADMIN: 'warning',
  VOLUNTEER: 'info',
  PARTICIPANT: 'success',
  USER: 'neutral',
};

function joinParts(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(' ');
}

function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatHistoryAction(action: string, locale: string): string {
  const isRu = locale === 'ru';
  const labels: Record<string, string> = {
    PROFILE_SECTION_UPDATED: isRu ? 'Обновление раздела' : 'Section updated',
    PROFILE_UPDATED: isRu ? 'Обновление профиля' : 'Profile updated',
    PROFILE_AVATAR_UPLOADED: isRu ? 'Загружено фото профиля' : 'Profile photo uploaded',
    PROFILE_DOCUMENT_UPLOADED: isRu ? 'Загружен документ' : 'Document uploaded',
    PROFILE_DOCUMENT_DELETED: isRu ? 'Удалён документ' : 'Document deleted',
  };
  return labels[action] ?? action;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function InfoField({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`${styles.infoField} ${wide ? styles.infoFieldWide : ''}`}>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <div className={styles.infoGrid}>{children}</div>;
}

function LinkValue({ href, label }: { href: string | null | undefined; label: string }) {
  if (!href) return <>—</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="signal-muted">—</span>;
  return (
    <div className={styles.tagList}>
      {items.map((item) => (
        <span key={item} className={styles.tag}>
          {item}
        </span>
      ))}
    </div>
  );
}

export default function AdminUserFullProfilePage() {
  const t = useTranslations('admin.userProfile');
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = useRouteLocale();
  const userId = params?.userId as string;
  const eventIdParam = searchParams.get('eventId');

  const [profileData, setProfileData] = useState<UserFullProfile | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [revealSensitive, setRevealSensitive] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!userId) return;

    setLoadingData(true);
    adminApi.getUserFullProfile(userId, eventIdParam ?? undefined, { revealSensitive })
      .then((data) => {
        setProfileData(data as UserFullProfile);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('loadErrorDescription'));
        setProfileData(null);
      })
      .finally(() => setLoadingData(false));
  }, [userId, eventIdParam, revealSensitive, t]);

  useEffect(() => {
    setRevealSensitive(false);
  }, [userId, eventIdParam]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US');
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderVerification = (verifiedAt: string | null) => {
    if (!verifiedAt) return <span className="signal-muted">{t('notVerified')}</span>;
    return (
      <StatusBadge tone="success">
        {t('verified')} · {formatDate(verifiedAt)}
      </StatusBadge>
    );
  };

  const renderConsent = (consent: boolean, consentAt: string | null) => (
    <span className={styles.inlineStatus}>
      <StatusBadge tone={consent ? 'success' : 'danger'}>
        {consent ? t('yes') : t('no')}
      </StatusBadge>
      {consentAt ? <span className="signal-muted">{formatDate(consentAt)}</span> : null}
    </span>
  );

  if (loading || !user || !isAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (loadingData) {
    return (
      <div className="signal-page-shell admin-control-page">
        <PageHeader title={t('title')} />
        <LoadingLines rows={8} />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="signal-page-shell admin-control-page">
        <PageHeader title={t('title')} />
        <EmptyState
          title={t('loadErrorTitle')}
          description={error ?? t('notFound')}
          actions={
            <button type="button" className="btn btn-secondary" onClick={() => router.push(`/${locale}/admin/users`)}>
              {t('backToUsers')}
            </button>
          }
        />
      </div>
    );
  }

  const {
    profile: p,
    extendedProfile,
    identityDocument,
    internationalPassport,
    socialLinks,
    activityDirections,
    additionalLanguages,
    avatarHistory,
    profileHistory,
    additionalDocuments,
    emergencyContact,
    eventMemberships,
    teamMemberships,
    selectedEventContext,
  } = profileData;

  const displayName = p.fullNameCyrillic || p.fullNameLatin || p.name || p.email;
  const latinName = p.fullNameLatin || joinParts([p.firstNameLatin, p.middleNameLatin, p.lastNameLatin]) || '—';
  const cyrillicName = p.fullNameCyrillic || joinParts([p.lastNameCyrillic, p.firstNameCyrillic, p.middleNameCyrillic]) || '—';
  const documentsCount = (identityDocument ? 1 : 0) + (internationalPassport ? 1 : 0) + additionalDocuments.length;
  const profileCompletenessItems = [
    displayName,
    p.email,
    p.phone,
    p.city,
    p.birthDate,
    p.consentPersonalData,
    p.consentClientRules,
    identityDocument,
  ];
  const profileCompleteness = Math.round(
    (profileCompletenessItems.filter(Boolean).length / profileCompletenessItems.length) * 100
  );
  const canRevealSensitive = profileData.access?.canRevealSensitive && profileData.access.sensitiveMasked;

  const tabItems: Array<{ key: ProfileTab; label: string }> = [
    { key: 'overview', label: t('tabs.overview') },
    { key: 'documents', label: t('tabs.documents') },
    { key: 'activity', label: t('tabs.activity') },
    { key: 'history', label: locale === 'ru' ? 'История' : 'History' },
  ];

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={displayName}
        subtitle={`${t('idLabel')}: ${p.id}`}
        actions={
          <div className={styles.headerActions}>
            {canRevealSensitive ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setRevealSensitive(true)}>
                {t('revealSensitive')}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => router.push(`/${locale}/admin/email/direct?to=${encodeURIComponent(p.email)}&name=${encodeURIComponent(displayName || '')}`)}
            >
              {locale === 'ru' ? 'Отправить письмо' : 'Send email'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(`/${locale}/admin/users`)}>
              ← {t('backToUsers')}
            </button>
          </div>
        }
      />

      <Panel variant="elevated" className={styles.heroPanel}>
        <div className={styles.identityBlock}>
          <span className={styles.avatar}>
            {p.avatarUrl
              ? <Image src={p.avatarUrl} alt="" width={88} height={88} />
              : displayName.charAt(0).toUpperCase()}
          </span>
          <div className={styles.identityText}>
            <span className={styles.eyebrow}>{t('profileHeader')}</span>
            <h2>{displayName}</h2>
            <p>{p.email}</p>
            <div className={styles.badgeRow}>
              <StatusBadge tone={toneByRole[p.role] ?? 'neutral'}>{p.role}</StatusBadge>
              <StatusBadge tone={p.isActive ? 'success' : 'danger'}>
                {p.isActive ? t('active') : t('inactive')}
              </StatusBadge>
            </div>
          </div>
        </div>
        <div className={styles.heroMeta}>
          <InfoField label={t('registeredAt')}>{formatDateTime(p.registeredAt)}</InfoField>
          <InfoField label={t('lastLogin')}>{formatDateTime(p.lastLoginAt)}</InfoField>
          <InfoField label={t('avatar')}>
            <LinkValue href={p.avatarUrl} label={t('open')} />
          </InfoField>
        </div>
      </Panel>

      <div className={styles.metricsGrid}>
        <MetricCard label={t('stats.profileCompleteness')} value={`${profileCompleteness}%`} tone={profileCompleteness >= 80 ? 'success' : 'warning'} />
        <MetricCard label={t('stats.eventMemberships')} value={eventMemberships.length} tone="info" />
        <MetricCard label={t('stats.teams')} value={teamMemberships.length} tone="neutral" />
        <MetricCard label={t('stats.documents')} value={documentsCount} tone={documentsCount > 0 ? 'success' : 'warning'} />
      </div>

      {selectedEventContext && (
        <Panel variant="elevated" className={styles.contextPanel}>
          <SectionHeader
            title={t('contextTitle')}
            subtitle={selectedEventContext.event.title}
            actions={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => router.push(`/${locale}/admin/events/${selectedEventContext.event.id}`)}>
                {t('openEvent')}
              </button>
            }
          />
          <InfoGrid>
            <InfoField label={t('event')}>{selectedEventContext.event.status}</InfoField>
            {selectedEventContext.participantMembership && (
              <InfoField label={t('participantStatus')}>
                <StatusBadge tone={toneByStatus[selectedEventContext.participantMembership.status] ?? 'neutral'}>
                  {selectedEventContext.participantMembership.status}
                </StatusBadge>
              </InfoField>
            )}
            {selectedEventContext.volunteerMembership && (
              <InfoField label={t('volunteerStatus')}>
                <StatusBadge tone={toneByStatus[selectedEventContext.volunteerMembership.status] ?? 'neutral'}>
                  {selectedEventContext.volunteerMembership.status}
                </StatusBadge>
              </InfoField>
            )}
            {selectedEventContext.eventAdminMembership && (
              <InfoField label={t('adminStatus')}>
                <StatusBadge tone={toneByStatus[selectedEventContext.eventAdminMembership.status] ?? 'neutral'}>
                  {selectedEventContext.eventAdminMembership.status}
                </StatusBadge>
              </InfoField>
            )}
            {selectedEventContext.teamMembership && (
              <InfoField label={t('teamStatus')}>
                <StatusBadge tone={toneByStatus[selectedEventContext.teamMembership.team.status] ?? 'neutral'}>
                  {selectedEventContext.teamMembership.team.name} · {selectedEventContext.teamMembership.team.status}
                </StatusBadge>
              </InfoField>
            )}
            {selectedEventContext.registrationAnswers && (
              <InfoField label={t('registrationForm')}>
                <StatusBadge tone={selectedEventContext.registrationAnswers.isComplete ? 'success' : 'warning'}>
                  {selectedEventContext.registrationAnswers.isComplete ? t('complete') : t('incomplete')}
                </StatusBadge>
              </InfoField>
            )}
            {selectedEventContext.participantMembership && (
              <InfoField label={t('assignedAt')}>{formatDateTime(selectedEventContext.participantMembership.assignedAt)}</InfoField>
            )}
          </InfoGrid>

          {selectedEventContext.registrationAnswers?.answersJson && (
            <div className={styles.answersBlock}>
              <h3>{t('registrationAnswers')}</h3>
              <div className={styles.answersGrid}>
                {Object.entries(selectedEventContext.registrationAnswers.answersJson).map(([key, value]) => (
                  <div key={key} className={styles.answerItem}>
                    <span>{key}</span>
                    <strong>{formatAnswerValue(value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      )}

      <div className={styles.tabs} role="tablist" aria-label={t('tabsLabel')}>
        {tabItems.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? styles.tabActive : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className={styles.cardGrid}>
          <Panel variant="elevated" className={styles.profileCard}>
            <SectionHeader title={t('basicData')} />
            <InfoGrid>
              <InfoField label={t('cyrillicName')} wide>{cyrillicName}</InfoField>
              <InfoField label={t('latinName')} wide>{latinName}</InfoField>
              <InfoField label={t('noLastName')}>{p.hasNoLastName ? t('yes') : t('no')}</InfoField>
              <InfoField label={t('birthDate')}>{formatDate(p.birthDate)}</InfoField>
              <InfoField label={t('city')}>{p.city || '—'}</InfoField>
              <InfoField label={t('address')} wide>{p.factualAddress || '—'}</InfoField>
              <InfoField label={t('phone')}>{p.phone || '—'}</InfoField>
              <InfoField label="Telegram">{p.telegram || '—'}</InfoField>
              <InfoField label={t('nativeLanguage')}>{p.nativeLanguage || '—'}</InfoField>
              <InfoField label={t('communicationLanguage')}>{p.communicationLanguage || '—'}</InfoField>
              <InfoField label={t('bio')} wide>{p.bio || '—'}</InfoField>
            </InfoGrid>
          </Panel>

          <Panel variant="elevated" className={styles.profileCard}>
            <SectionHeader title={t('verificationAndConsent')} />
            <InfoGrid>
              <InfoField label={t('emailVerified')}>{renderVerification(p.emailVerifiedAt)}</InfoField>
              <InfoField label={t('phoneVerified')}>{renderVerification(p.phoneVerifiedAt)}</InfoField>
              <InfoField label={t('telegramVerified')}>{renderVerification(p.telegramVerifiedAt)}</InfoField>
              <InfoField label={t('consentPersonalData')} wide>{renderConsent(p.consentPersonalData, p.consentPersonalDataAt)}</InfoField>
              <InfoField label={t('consentClientRules')} wide>{renderConsent(p.consentClientRules, p.consentClientRulesAt)}</InfoField>
            </InfoGrid>
          </Panel>

          {extendedProfile && (
            <Panel variant="elevated" className={styles.profileCard}>
              <SectionHeader title={t('extendedProfile')} />
              <InfoGrid>
                <InfoField label={t('gender')}>{extendedProfile.gender || '—'}</InfoField>
                <InfoField label={t('citizenshipCountryCode')}>{extendedProfile.citizenshipCountryCode || '—'}</InfoField>
                <InfoField label={t('residenceCountryCode')}>{extendedProfile.residenceCountryCode || '—'}</InfoField>
                <InfoField label={t('regionDistrictSettlement')} wide>
                  {joinParts([extendedProfile.regionText, extendedProfile.districtText, extendedProfile.settlementText]) || '—'}
                </InfoField>
                <InfoField label={t('streetHouseApartment')} wide>
                  {joinParts([extendedProfile.street, extendedProfile.house, extendedProfile.apartment]) || '—'}
                </InfoField>
                <InfoField label={t('postalCode')}>{extendedProfile.postalCode || '—'}</InfoField>
                <InfoField label={t('organization')}>{extendedProfile.organizationName || '—'}</InfoField>
                <InfoField label={t('faculty')}>{extendedProfile.facultyOrDepartment || '—'}</InfoField>
                <InfoField label={t('classCourseYear')}>{extendedProfile.classCourseYear || '—'}</InfoField>
                <InfoField label={t('position')}>{extendedProfile.positionTitle || '—'}</InfoField>
                <InfoField label={t('activityStatus')}>{extendedProfile.activityStatus || '—'}</InfoField>
                <InfoField label={t('studiesInRussia')}>{extendedProfile.studiesInRussia ? t('yes') : t('no')}</InfoField>
                <InfoField label={t('englishLevel')}>{extendedProfile.englishLevel || '—'}</InfoField>
                <InfoField label={t('russianLevel')}>{extendedProfile.russianLevel || '—'}</InfoField>
                <InfoField label={t('achievements')} wide>{extendedProfile.achievementsText || '—'}</InfoField>
              </InfoGrid>
            </Panel>
          )}

          <Panel variant="elevated" className={styles.profileCard}>
            <SectionHeader title={t('socialLinks')} />
            <InfoGrid>
              <InfoField label="Max"><LinkValue href={socialLinks?.maxUrl} label={socialLinks?.maxUrl ?? t('open')} /></InfoField>
              <InfoField label="VK"><LinkValue href={socialLinks?.vkUrl} label={socialLinks?.vkUrl ?? t('open')} /></InfoField>
              <InfoField label="Telegram"><LinkValue href={socialLinks?.telegramUrl} label={socialLinks?.telegramUrl ?? t('open')} /></InfoField>
              <InfoField label="Instagram"><LinkValue href={socialLinks?.instagramUrl} label={socialLinks?.instagramUrl ?? t('open')} /></InfoField>
              <InfoField label="Facebook"><LinkValue href={socialLinks?.facebookUrl} label={socialLinks?.facebookUrl ?? t('open')} /></InfoField>
              <InfoField label="X"><LinkValue href={socialLinks?.xUrl} label={socialLinks?.xUrl ?? t('open')} /></InfoField>
            </InfoGrid>
          </Panel>

          <Panel variant="elevated" className={styles.profileCard}>
            <SectionHeader title={t('authAccounts')} />
            {p.accounts.length > 0 ? (
              <TableShell>
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>{t('provider')}</th>
                      <th>{t('providerEmail')}</th>
                      <th>{t('linkedAt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.accounts.map((account) => (
                      <tr key={account.id}>
                        <td><StatusBadge tone="info">{account.provider}</StatusBadge></td>
                        <td>{account.providerEmail || '—'}</td>
                        <td>{formatDate(account.linkedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            ) : (
              <span className="signal-muted">—</span>
            )}
          </Panel>

          {emergencyContact && (
            <Panel variant="elevated" className={styles.profileCard}>
              <SectionHeader title={t('emergencyContact')} />
              <InfoGrid>
                <InfoField label={t('fullName')}>{emergencyContact.fullName || '—'}</InfoField>
                <InfoField label={t('relationship')}>{emergencyContact.relationship || '—'}</InfoField>
                <InfoField label={t('phone')}>{emergencyContact.phone || '—'}</InfoField>
              </InfoGrid>
            </Panel>
          )}

          <Panel variant="elevated" className={styles.profileCard}>
            <SectionHeader title={t('activityDirections')} />
            <TagList items={activityDirections} />
          </Panel>

          <Panel variant="elevated" className={styles.profileCard}>
            <SectionHeader title={t('additionalLanguages')} />
            <TagList items={additionalLanguages} />
          </Panel>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className={styles.cardGrid}>
          <Panel variant="elevated" className={styles.profileCard}>
            <SectionHeader title={t('identityDocument')} />
            {identityDocument ? (
              <InfoGrid>
                <InfoField label={t('documentType')}>{identityDocument.documentType || '—'}</InfoField>
                <InfoField label={t('citizenshipCountryCode')}>{identityDocument.citizenshipCountryCode || '—'}</InfoField>
                <InfoField label={t('documentSeries')}>{identityDocument.documentSeries || identityDocument.passportSeries || '—'}</InfoField>
                <InfoField label={t('documentNumber')}>{identityDocument.documentNumber || identityDocument.passportNumber || '—'}</InfoField>
                <InfoField label={t('issueDate')}>{formatDate(identityDocument.issueDate)}</InfoField>
                <InfoField label={t('expiryDate')}>{formatDate(identityDocument.expiryDate)}</InfoField>
                <InfoField label={t('issuedBy')} wide>{identityDocument.issuedBy || '—'}</InfoField>
                <InfoField label={t('placeOfBirth')} wide>{identityDocument.placeOfBirth || '—'}</InfoField>
                <InfoField label={t('pinfl')}>{identityDocument.pinfl || '—'}</InfoField>
                <InfoField label={t('snils')}>{identityDocument.snils || '—'}</InfoField>
                <InfoField label={t('openScan')}>
                  <LinkValue href={identityDocument.scanAsset?.publicUrl} label={t('openScan')} />
                </InfoField>
              </InfoGrid>
            ) : (
              <span className="signal-muted">{t('noIdentityDocument')}</span>
            )}
          </Panel>

          <Panel variant="elevated" className={styles.profileCard}>
            <SectionHeader title={t('internationalPassport')} />
            {internationalPassport ? (
              <InfoGrid>
                <InfoField label={t('citizenshipCountryCode')}>{internationalPassport.countryCode || '—'}</InfoField>
                <InfoField label={t('documentSeries')}>{internationalPassport.series || '—'}</InfoField>
                <InfoField label={t('documentNumber')}>{internationalPassport.number || '—'}</InfoField>
                <InfoField label={t('issueDate')}>{formatDate(internationalPassport.issueDate)}</InfoField>
                <InfoField label={t('expiryDate')}>{formatDate(internationalPassport.expiryDate)}</InfoField>
                <InfoField label={t('issuedBy')} wide>{internationalPassport.issuedBy || '—'}</InfoField>
                <InfoField label={t('openScan')}>
                  <LinkValue href={internationalPassport.scanAsset?.publicUrl} label={t('openScan')} />
                </InfoField>
              </InfoGrid>
            ) : (
              <span className="signal-muted">—</span>
            )}
          </Panel>

          <Panel variant="elevated" className={`${styles.profileCard} ${styles.fullWidth}`}>
            <SectionHeader title={t('additionalDocuments')} />
            {additionalDocuments.length > 0 ? (
              <div className={styles.documentList}>
                {additionalDocuments.map((doc) => (
                  <div key={doc.asset.id} className={styles.documentItem}>
                    <div>
                      <strong>{doc.type || t('document')}</strong>
                      {doc.notes ? <span>{doc.notes}</span> : null}
                    </div>
                    <LinkValue href={doc.asset.publicUrl} label={t('open')} />
                  </div>
                ))}
              </div>
            ) : (
              <span className="signal-muted">—</span>
            )}
          </Panel>
        </div>
      )}

      {activeTab === 'history' && (
        <div className={styles.cardGrid}>
          <Panel variant="elevated" className={`${styles.profileCard} ${styles.fullWidth}`}>
            <SectionHeader title={locale === 'ru' ? 'История фото профиля' : 'Profile Photo History'} />
            {avatarHistory.length > 0 ? (
              <TableShell>
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>{locale === 'ru' ? 'Фото' : 'Photo'}</th>
                      <th>{locale === 'ru' ? 'Файл' : 'File'}</th>
                      <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                      <th>{locale === 'ru' ? 'Дата' : 'Date'}</th>
                      <th className="right">{locale === 'ru' ? 'Ссылка' : 'Link'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avatarHistory.map((asset) => (
                      <tr key={asset.id}>
                        <td>
                          {asset.publicUrl ? <Image src={asset.publicUrl} alt="" width={44} height={44} /> : <span className="signal-muted">—</span>}
                        </td>
                        <td>
                          <strong>{asset.originalFilename}</strong>
                          <div className="signal-muted">{asset.mimeType} · {formatBytes(asset.sizeBytes)}</div>
                        </td>
                        <td>
                          <StatusBadge tone={asset.isCurrent ? 'success' : asset.status === 'DELETED' ? 'neutral' : 'info'}>
                            {asset.isCurrent ? (locale === 'ru' ? 'Текущее' : 'Current') : asset.status}
                          </StatusBadge>
                        </td>
                        <td>{formatDateTime(asset.createdAt)}</td>
                        <td className="right"><LinkValue href={asset.publicUrl} label={t('open')} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            ) : (
              <span className="signal-muted">—</span>
            )}
          </Panel>

          <Panel variant="elevated" className={`${styles.profileCard} ${styles.fullWidth}`}>
            <SectionHeader title={locale === 'ru' ? 'История изменений данных' : 'Profile Data History'} />
            {profileHistory.length > 0 ? (
              <TableShell>
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>{locale === 'ru' ? 'Действие' : 'Action'}</th>
                      <th>{locale === 'ru' ? 'Раздел' : 'Section'}</th>
                      <th>{locale === 'ru' ? 'Изменённые поля' : 'Changed fields'}</th>
                      <th>{locale === 'ru' ? 'Автор' : 'Actor'}</th>
                      <th>{locale === 'ru' ? 'Дата' : 'Date'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profileHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <strong>{formatHistoryAction(entry.action, locale)}</strong>
                          {entry.asset?.publicUrl ? <div><LinkValue href={entry.asset.publicUrl} label={entry.asset.originalFilename} /></div> : null}
                        </td>
                        <td>{entry.sectionKey ?? '—'}</td>
                        <td>{entry.changedFields.length > 0 ? entry.changedFields.join(', ') : '—'}</td>
                        <td>{entry.actor?.name || entry.actor?.email || '—'}</td>
                        <td>{formatDateTime(entry.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            ) : (
              <span className="signal-muted">—</span>
            )}
          </Panel>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className={styles.cardGrid}>
          <Panel variant="elevated" className={`${styles.profileCard} ${styles.fullWidth}`}>
            <SectionHeader title={t('eventMemberships')} />
            {eventMemberships.length > 0 ? (
              <TableShell>
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>{t('eventTitle')}</th>
                      <th>{t('role')}</th>
                      <th>{t('status')}</th>
                      <th>{t('assigned')}</th>
                      <th>{t('approved')}</th>
                      <th>{t('rejected')}</th>
                      <th>{t('removed')}</th>
                      <th>{t('notes')}</th>
                      <th>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventMemberships.map((membership) => (
                      <tr key={membership.id}>
                        <td>{membership.event.title}</td>
                        <td><StatusBadge tone={toneByRole[membership.role] ?? 'info'}>{membership.role}</StatusBadge></td>
                        <td><StatusBadge tone={toneByStatus[membership.status] ?? 'neutral'}>{membership.status}</StatusBadge></td>
                        <td>{formatDate(membership.assignedAt)}</td>
                        <td>{formatDate(membership.approvedAt)}</td>
                        <td>{formatDate(membership.rejectedAt)}</td>
                        <td>{formatDate(membership.removedAt)}</td>
                        <td>{membership.notes || '—'}</td>
                        <td>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(`/${locale}/admin/users/${userId}?eventId=${membership.event.id}`)}>
                            {t('openContext')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            ) : (
              <span className="signal-muted">{t('noEventMemberships')}</span>
            )}
          </Panel>

          <Panel variant="elevated" className={`${styles.profileCard} ${styles.fullWidth}`}>
            <SectionHeader title={t('teams')} />
            {teamMemberships.length > 0 ? (
              <TableShell>
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>{t('eventTitle')}</th>
                      <th>{t('team')}</th>
                      <th>{t('teamStatus')}</th>
                      <th>{t('roleInTeam')}</th>
                      <th>{t('status')}</th>
                      <th>{t('joinedAt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMemberships.map((membership) => (
                      <tr key={membership.id}>
                        <td>{membership.team.eventTitle}</td>
                        <td>{membership.team.name}</td>
                        <td><StatusBadge tone={toneByStatus[membership.team.status] ?? 'neutral'}>{membership.team.status}</StatusBadge></td>
                        <td><StatusBadge tone={membership.role === 'CAPTAIN' ? 'warning' : 'info'}>{membership.role}</StatusBadge></td>
                        <td><StatusBadge tone={toneByStatus[membership.status] ?? 'neutral'}>{membership.status}</StatusBadge></td>
                        <td>{formatDate(membership.joinedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            ) : (
              <span className="signal-muted">{t('noTeams')}</span>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
