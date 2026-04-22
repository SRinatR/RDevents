'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, PageHeader, Panel, SectionHeader, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

interface UserProfile {
  profile: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isActive: boolean;
    avatarUrl: string | null;
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
    consentClientRules: boolean;
    accounts: { id: string; provider: string; linkedAt: string; lastUsedAt: string | null }[];
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
    region: { id: string; nameRu: string } | null;
    district: { id: string; nameRu: string } | null;
    settlement: { id: string; nameRu: string } | null;
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
  } | null;
  internationalPassport: {
    countryCode: string | null;
    series: string | null;
    number: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    issuedBy: string | null;
  } | null;
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
  emergencyContact: {
    fullName: string | null;
    relationship: string | null;
    phone: string | null;
  } | null;
  eventMemberships: {
    id: string;
    eventId: string;
    eventTitle: string;
    eventSlug: string;
    eventStartsAt: string | null;
    eventEndsAt: string | null;
    eventStatus: string;
    role: string;
    status: string;
    assignedAt: string;
    approvedAt: string | null;
    assignedBy: { id: string; name: string | null; email: string } | null;
    notes: string | null;
  }[];
  teamMemberships: {
    id: string;
    teamId: string;
    teamName: string;
    teamStatus: string;
    eventId: string;
    eventTitle: string;
    role: string;
    status: string;
    joinedAt: string;
  }[];
  formSubmissions: {
    id: string;
    eventId: string;
    answersJson: Record<string, unknown>;
    isComplete: boolean;
    createdAt: string;
    event: { id: string; title: string; slug: string } | null;
  }[];
}

const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  ACTIVE: 'success',
  APPROVED: 'success',
  PENDING: 'warning',
  RESERVE: 'info',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  REMOVED: 'neutral',
};

export default function AdminUserProfilePage() {
  const t = useTranslations();
  const { user, loading, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const locale = useRouteLocale();
  const userId = params?.id as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isPlatformAdmin)) {
      router.push(`/${locale}`);
    }
  }, [user, loading, isPlatformAdmin, router, locale]);

  useEffect(() => {
    if (!userId) return;

    setLoadingData(true);
    adminApi.getUserProfile(userId)
      .then((data) => {
        setProfile(data as UserProfile);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        setProfile(null);
      })
      .finally(() => setLoadingData(false));
  }, [userId]);

  const renderVerification = (verifiedAt: string | null) => {
    if (!verifiedAt) return <span className="signal-muted">{locale === 'ru' ? 'Не подтверждён' : 'Not verified'}</span>;
    return (
      <span className="signal-success">
        {locale === 'ru' ? 'Подтверждён' : 'Verified'} {new Date(verifiedAt).toLocaleDateString()}
      </span>
    );
  };

  const renderLanguageLevel = (level: string | null) => {
    if (!level) return '—';
    return level;
  };

  if (loading || !user || !isPlatformAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (loadingData) {
    return (
      <div className="signal-page-shell admin-control-page">
        <PageHeader title={locale === 'ru' ? 'Профиль пользователя' : 'User Profile'} />
        <LoadingLines rows={8} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="signal-page-shell admin-control-page">
        <PageHeader title={locale === 'ru' ? 'Профиль пользователя' : 'User Profile'} />
        <EmptyState
          title={locale === 'ru' ? 'Ошибка загрузки' : 'Load Error'}
          description={error ?? (locale === 'ru' ? 'Профиль не найден' : 'Profile not found')}
        />
        <div style={{ marginTop: '16px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => router.push(`/${locale}/admin/users`)}>
            {locale === 'ru' ? 'Назад к списку' : 'Back to list'}
          </button>
        </div>
      </div>
    );
  }

  const { profile: p, extendedProfile, identityDocument, internationalPassport, socialLinks, activityDirections, additionalLanguages, emergencyContact, eventMemberships, teamMemberships, formSubmissions } = profile;

  return (
    <div className="signal-page-shell admin-control-page">
      <div style={{ marginBottom: '16px' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(`/${locale}/admin/users`)}>
          ← {locale === 'ru' ? 'Назад к списку' : 'Back to list'}
        </button>
      </div>
      <PageHeader
        title={p.name || p.email}
        subtitle={`ID: ${p.id}`}
      />

      <div className="admin-user-profile-grid">
        <Panel variant="elevated" className="admin-profile-card">
          <SectionHeader title={locale === 'ru' ? 'Основная информация' : 'Basic Information'} />
          <div className="admin-profile-avatar">
            <span className="signal-avatar signal-avatar--lg">
              {p.avatarUrl
                ? <img src={p.avatarUrl} alt="" />
                : (p.name || p.email || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Email' : 'Email'}</label>
            <span>{p.email}</span>
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Роль' : 'Role'}</label>
            <StatusBadge tone={p.role === 'SUPER_ADMIN' ? 'warning' : p.role === 'PLATFORM_ADMIN' ? 'info' : 'neutral'}>
              {p.role}
            </StatusBadge>
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Активен' : 'Active'}</label>
            <span className={p.isActive ? 'signal-success' : 'signal-muted'}>
              {p.isActive ? (locale === 'ru' ? 'Да' : 'Yes') : (locale === 'ru' ? 'Нет' : 'No')}
            </span>
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Город' : 'City'}</label>
            <span>{p.city || '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Зарегистрирован' : 'Registered'}</label>
            <span>{p.registeredAt ? new Date(p.registeredAt).toLocaleDateString() : '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Последний вход' : 'Last login'}</label>
            <span>{p.lastLoginAt ? new Date(p.lastLoginAt).toLocaleDateString() : '—'}</span>
          </div>
        </Panel>

        <Panel variant="elevated" className="admin-profile-card">
          <SectionHeader title={locale === 'ru' ? 'Контакты' : 'Contacts'} />
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Телефон' : 'Phone'}</label>
            <span>{p.phone || '—'}</span>
            {p.phoneVerifiedAt && <span className="signal-success"> ✓</span>}
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Подтверждение телефона' : 'Phone verified'}</label>
            {renderVerification(p.phoneVerifiedAt)}
          </div>
          <div className="admin-profile-field">
            <label>Telegram</label>
            <span>{p.telegram || '—'}</span>
            {p.telegramVerifiedAt && <span className="signal-success"> ✓</span>}
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Подтверждение Telegram' : 'Telegram verified'}</label>
            {renderVerification(p.telegramVerifiedAt)}
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Подтверждение email' : 'Email verified'}</label>
            {renderVerification(p.emailVerifiedAt)}
          </div>
        </Panel>

        <Panel variant="elevated" className="admin-profile-card">
          <SectionHeader title={locale === 'ru' ? 'Имена' : 'Names'} />
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'ФИО (кириллица)' : 'Full name (Cyrillic)'}</label>
            <span>{p.fullNameCyrillic || `${p.lastNameCyrillic ?? ''} ${p.firstNameCyrillic ?? ''} ${p.middleNameCyrillic ?? ''}`.trim() || '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Имя (латиница)' : 'Name (Latin)'}</label>
            <span>{p.fullNameLatin || `${p.firstNameLatin ?? ''} ${p.lastNameLatin ?? ''}`.trim() || '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Отсутствие фамилии' : 'No last name'}</label>
            <span>{p.hasNoLastName ? (locale === 'ru' ? 'Да' : 'Yes') : (locale === 'ru' ? 'Нет' : 'No')}</span>
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Дата рождения' : 'Birth date'}</label>
            <span>{p.birthDate ? new Date(p.birthDate).toLocaleDateString() : '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Родной язык' : 'Native language'}</label>
            <span>{p.nativeLanguage || '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>{locale === 'ru' ? 'Язык коммуникации' : 'Communication language'}</label>
            <span>{p.communicationLanguage || '—'}</span>
          </div>
        </Panel>

        {extendedProfile && (
          <Panel variant="elevated" className="admin-profile-card">
            <SectionHeader title={locale === 'ru' ? 'Расширенный профиль' : 'Extended Profile'} />
            <div className="admin-profile-field">
              <label>{locale === 'ru' ? 'Пол' : 'Gender'}</label>
              <span>{extendedProfile.gender || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>{locale === 'ru' ? 'Гражданство' : 'Citizenship'}</label>
              <span>{extendedProfile.citizenshipCountryCode || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>{locale === 'ru' ? 'Страна проживания' : 'Residence country'}</label>
              <span>{extendedProfile.residenceCountryCode || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>{locale === 'ru' ? 'Адрес' : 'Address'}</label>
              <span>{[extendedProfile.regionText, extendedProfile.districtText, extendedProfile.settlementText, extendedProfile.street, extendedProfile.house, extendedProfile.apartment].filter(Boolean).join(', ') || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>{locale === 'ru' ? 'Почтовый индекс' : 'Postal code'}</label>
              <span>{extendedProfile.postalCode || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>{locale === 'ru' ? 'Статус деятельности' : 'Activity status'}</label>
              <span>{extendedProfile.activityStatus || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>{locale === 'ru' ? 'Учёба в России' : 'Studies in Russia'}</label>
              <span>{extendedProfile.studiesInRussia ? (locale === 'ru' ? 'Да' : 'Yes') : (locale === 'ru' ? 'Нет' : 'No')}</span>
            </div>
            {extendedProfile.organizationName && (
              <div className="admin-profile-field">
                <label>{locale === 'ru' ? 'Организация' : 'Organization'}</label>
                <span>{extendedProfile.organizationName}</span>
              </div>
            )}
            {extendedProfile.facultyOrDepartment && (
              <div className="admin-profile-field">
                <label>{locale === 'ru' ? 'Факультет/Отдел' : 'Faculty/Department'}</label>
                <span>{extendedProfile.facultyOrDepartment}</span>
              </div>
            )}
            <div className="admin-profile-field">
              <label>{locale === 'ru' ? 'Уровень английского' : 'English level'}</label>
              <span>{renderLanguageLevel(extendedProfile.englishLevel)}</span>
            </div>
            <div className="admin-profile-field">
              <label>{locale === 'ru' ? 'Уровень русского' : 'Russian level'}</label>
              <span>{renderLanguageLevel(extendedProfile.russianLevel)}</span>
            </div>
          </Panel>
        )}

        <Panel variant="elevated" className="admin-profile-card">
          <SectionHeader title={locale === 'ru' ? 'Документы' : 'Documents'} />
          {identityDocument ? (
            <>
              <div className="admin-profile-field">
                <label>{locale === 'ru' ? 'Тип документа' : 'Document type'}</label>
                <span>{identityDocument.documentType || '—'}</span>
              </div>
              <div className="admin-profile-field">
                <label>{locale === 'ru' ? 'Серия' : 'Series'}</label>
                <span>{identityDocument.documentSeries || '—'}</span>
              </div>
              <div className="admin-profile-field">
                <label>{locale === 'ru' ? 'Номер' : 'Number'}</label>
                <span>{identityDocument.documentNumber || '—'}</span>
              </div>
              <div className="admin-profile-field">
                <label>{locale === 'ru' ? 'Дата выдачи' : 'Issue date'}</label>
                <span>{identityDocument.issueDate ? new Date(identityDocument.issueDate).toLocaleDateString() : '—'}</span>
              </div>
              <div className="admin-profile-field">
                <label>{locale === 'ru' ? 'Кем выдан' : 'Issued by'}</label>
                <span>{identityDocument.issuedBy || '—'}</span>
              </div>
              <div className="admin-profile-field">
                <label>{locale === 'ru' ? 'Срок действия' : 'Expiry date'}</label>
                <span>{identityDocument.expiryDate ? new Date(identityDocument.expiryDate).toLocaleDateString() : '—'}</span>
              </div>
              <div className="admin-profile-field">
                <label>{locale === 'ru' ? 'Место рождения' : 'Place of birth'}</label>
                <span>{identityDocument.placeOfBirth || '—'}</span>
              </div>
              {identityDocument.pinfl && (
                <div className="admin-profile-field">
                  <label>PINFL</label>
                  <span>{identityDocument.pinfl}</span>
                </div>
              )}
              {identityDocument.snils && (
                <div className="admin-profile-field">
                  <label>СНИЛС</label>
                  <span>{identityDocument.snils}</span>
                </div>
              )}
            </>
          ) : (
            <div className="admin-profile-field">
              <span className="signal-muted">{locale === 'ru' ? 'Документ не указан' : 'No document'}</span>
            </div>
          )}

          {internationalPassport && (
            <>
              <div className="admin-profile-field">
                <label>{locale === 'ru' ? 'Загранпаспорт' : 'International Passport'}</label>
                <span>{[internationalPassport.countryCode, internationalPassport.series, internationalPassport.number].filter(Boolean).join(' ')}</span>
              </div>
            </>
          )}
        </Panel>

        {socialLinks && (
          <Panel variant="elevated" className="admin-profile-card">
            <SectionHeader title={locale === 'ru' ? 'Соцсети' : 'Social Links'} />
            <div className="admin-profile-field">
              <label>Max</label>
              <span>{socialLinks.maxUrl || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>VK</label>
              <span>{socialLinks.vkUrl || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Telegram</label>
              <span>{socialLinks.telegramUrl || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Instagram</label>
              <span>{socialLinks.instagramUrl || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Facebook</label>
              <span>{socialLinks.facebookUrl || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>X</label>
              <span>{socialLinks.xUrl || '—'}</span>
            </div>
          </Panel>
        )}

        <Panel variant="elevated" className="admin-profile-card">
          <SectionHeader title={locale === 'ru' ? 'Направления деятельности' : 'Activity Directions'} />
          {activityDirections.length > 0 ? (
            <div className="admin-tags-list">
              {activityDirections.map((dir) => (
                <span key={dir} className="admin-tag">{dir}</span>
              ))}
            </div>
          ) : (
            <span className="signal-muted">{locale === 'ru' ? 'Не указаны' : 'Not specified'}</span>
          )}

          <SectionHeader title={locale === 'ru' ? 'Дополнительные языки' : 'Additional Languages'} />
          {additionalLanguages.length > 0 ? (
            <div className="admin-tags-list">
              {additionalLanguages.map((lang) => (
                <span key={lang} className="admin-tag">{lang}</span>
              ))}
            </div>
          ) : (
            <span className="signal-muted">{locale === 'ru' ? 'Не указаны' : 'Not specified'}</span>
          )}
        </Panel>

        {emergencyContact && (
          <Panel variant="elevated" className="admin-profile-card">
            <SectionHeader title={locale === 'ru' ? 'Экстренный контакт' : 'Emergency Contact'} />
            <div className="admin-profile-field">
              <label>{locale === 'ru' ? 'Имя' : 'Name'}</label>
              <span>{emergencyContact.fullName || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>{locale === 'ru' ? 'Отношение' : 'Relationship'}</label>
              <span>{emergencyContact.relationship || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>{locale === 'ru' ? 'Телефон' : 'Phone'}</label>
              <span>{emergencyContact.phone || '—'}</span>
            </div>
          </Panel>
        )}

        {p.accounts.length > 0 && (
          <Panel variant="elevated" className="admin-profile-card">
            <SectionHeader title={locale === 'ru' ? 'Привязанные аккаунты' : 'Linked Accounts'} />
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>{locale === 'ru' ? 'Провайдер' : 'Provider'}</th>
                    <th>{locale === 'ru' ? 'Привязан' : 'Linked'}</th>
                    <th>{locale === 'ru' ? 'Последнее использование' : 'Last used'}</th>
                  </tr>
                </thead>
                <tbody>
                  {p.accounts.map((account) => (
                    <tr key={account.id}>
                      <td><StatusBadge tone="info">{account.provider}</StatusBadge></td>
                      <td>{new Date(account.linkedAt).toLocaleDateString()}</td>
                      <td>{account.lastUsedAt ? new Date(account.lastUsedAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </Panel>
        )}

        <Panel variant="elevated" className="admin-profile-card admin-profile-card--full">
          <SectionHeader title={locale === 'ru' ? 'Участия в событиях' : 'Event Memberships'} />
          {eventMemberships.length > 0 ? (
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                    <th>{locale === 'ru' ? 'Роль' : 'Role'}</th>
                    <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                    <th>{locale === 'ru' ? 'Начало' : 'Starts'}</th>
                    <th>{locale === 'ru' ? 'Зарегистрирован' : 'Registered'}</th>
                  </tr>
                </thead>
                <tbody>
                  {eventMemberships.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <a href={`/${locale}/events/${m.eventSlug}`} target="_blank" rel="noopener noreferrer">
                          {m.eventTitle}
                        </a>
                      </td>
                      <td><StatusBadge tone="info">{m.role}</StatusBadge></td>
                      <td><StatusBadge tone={toneByStatus[m.status] ?? 'neutral'}>{m.status}</StatusBadge></td>
                      <td>{m.eventStartsAt ? new Date(m.eventStartsAt).toLocaleDateString() : '—'}</td>
                      <td>{new Date(m.assignedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          ) : (
            <span className="signal-muted">{locale === 'ru' ? 'Нет участий' : 'No memberships'}</span>
          )}
        </Panel>

        {teamMemberships.length > 0 && (
          <Panel variant="elevated" className="admin-profile-card admin-profile-card--full">
            <SectionHeader title={locale === 'ru' ? 'Командные участия' : 'Team Memberships'} />
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>{locale === 'ru' ? 'Команда' : 'Team'}</th>
                    <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                    <th>{locale === 'ru' ? 'Роль' : 'Role'}</th>
                    <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                    <th>{locale === 'ru' ? 'Присоединился' : 'Joined'}</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMemberships.map((m) => (
                    <tr key={m.id}>
                      <td>{m.teamName}</td>
                      <td>{m.eventTitle}</td>
                      <td><StatusBadge tone={m.role === 'CAPTAIN' ? 'warning' : 'info'}>{m.role}</StatusBadge></td>
                      <td><StatusBadge tone={toneByStatus[m.status] ?? 'neutral'}>{m.status}</StatusBadge></td>
                      <td>{new Date(m.joinedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </Panel>
        )}

        {formSubmissions.length > 0 && (
          <Panel variant="elevated" className="admin-profile-card admin-profile-card--full">
            <SectionHeader title={locale === 'ru' ? 'Ответы на анкеты' : 'Form Submissions'} />
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                    <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                    <th>{locale === 'ru' ? 'Дата' : 'Date'}</th>
                  </tr>
                </thead>
                <tbody>
                  {formSubmissions.map((sub) => (
                    <tr key={sub.id}>
                      <td>{sub.event?.title ?? '—'}</td>
                      <td>
                        <span className={sub.isComplete ? 'signal-success' : 'signal-warning'}>
                          {sub.isComplete ? (locale === 'ru' ? 'Завершена' : 'Complete') : (locale === 'ru' ? 'Не завершена' : 'Incomplete')}
                        </span>
                      </td>
                      <td>{new Date(sub.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </Panel>
        )}
      </div>
    </div>
  );
}