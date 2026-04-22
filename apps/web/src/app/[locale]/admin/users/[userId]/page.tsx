'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, PageHeader, Panel, SectionHeader, StatusBadge, TableShell } from '@/components/ui/signal-primitives';

interface UserFullProfile {
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
    scanAsset: { id: string; publicUrl: string } | null;
  } | null;
  internationalPassport: {
    countryCode: string | null;
    series: string | null;
    number: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    issuedBy: string | null;
    scanAsset: { id: string; publicUrl: string } | null;
  } | null;
  additionalDocuments: Array<{
    type: string;
    notes: string | null;
    asset: { id: string; publicUrl: string };
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

export default function AdminUserFullProfilePage() {
  const t = useTranslations();
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = useRouteLocale();
  const userId = params?.userId as string;
  const eventIdParam = searchParams.get('eventId');

  const [profile, setProfile] = useState<UserFullProfile | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!userId) return;

    setLoadingData(true);
    adminApi.getUserProfile(userId, eventIdParam ?? undefined)
      .then((data) => {
        setProfile(data as UserFullProfile);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        setProfile(null);
      })
      .finally(() => setLoadingData(false));
  }, [userId, eventIdParam]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  };

  const renderVerification = (verifiedAt: string | null) => {
    if (!verifiedAt) return <span className="signal-muted">Не подтверждён</span>;
    return (
      <span className="signal-success">
        Подтверждён {formatDate(verifiedAt)}
      </span>
    );
  };

  const renderConsent = (consent: boolean, consentAt: string | null) => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <StatusBadge tone={consent ? 'success' : 'danger'}>
          {consent ? 'Да' : 'Нет'}
        </StatusBadge>
        {consentAt && <span className="signal-muted">({formatDate(consentAt)})</span>}
      </div>
    );
  };

  if (loading || !user || !isAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (loadingData) {
    return (
      <div className="signal-page-shell admin-control-page">
        <PageHeader title="Профиль пользователя" />
        <LoadingLines rows={8} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="signal-page-shell admin-control-page">
        <PageHeader title="Профиль пользователя" />
        <EmptyState
          title="Ошибка загрузки"
          description={error ?? 'Профиль не найден'}
        />
        <div style={{ marginTop: '16px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => router.push(`/${locale}/admin/users`)}>
            Назад к списку
          </button>
        </div>
      </div>
    );
  }

  const { profile: p, extendedProfile, identityDocument, internationalPassport, socialLinks, activityDirections, additionalLanguages, additionalDocuments, emergencyContact, eventMemberships, teamMemberships, selectedEventContext } = profile;

  const getName = () => p.fullNameCyrillic || p.fullNameLatin || p.name || p.email;

  return (
    <div className="signal-page-shell admin-control-page">
      <div style={{ marginBottom: '16px' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(`/${locale}/admin/users`)}>
          ← Назад к списку
        </button>
      </div>

      {selectedEventContext && (
        <Panel variant="elevated" className="selected-event-context" style={{ marginBottom: '24px', border: '2px solid var(--signal-accent-color, #3b82f6)' }}>
          <SectionHeader title="Контекст выбранного мероприятия" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="profile-field">
              <label>Мероприятие</label>
              <span>{selectedEventContext.event.title}</span>
            </div>
            {selectedEventContext.participantMembership && (
              <div className="profile-field">
                <label>Статус участника</label>
                <StatusBadge tone={toneByStatus[selectedEventContext.participantMembership.status] ?? 'neutral'}>
                  {selectedEventContext.participantMembership.status}
                </StatusBadge>
              </div>
            )}
            {selectedEventContext.volunteerMembership && (
              <div className="profile-field">
                <label>Статус волонтёра</label>
                <StatusBadge tone={toneByStatus[selectedEventContext.volunteerMembership.status] ?? 'neutral'}>
                  {selectedEventContext.volunteerMembership.status}
                </StatusBadge>
              </div>
            )}
            {selectedEventContext.eventAdminMembership && (
              <div className="profile-field">
                <label>Статус администратора</label>
                <StatusBadge tone={toneByStatus[selectedEventContext.eventAdminMembership.status] ?? 'neutral'}>
                  {selectedEventContext.eventAdminMembership.status}
                </StatusBadge>
              </div>
            )}
            {selectedEventContext.teamMembership && (
              <div className="profile-field">
                <label>Статус команды</label>
                <StatusBadge tone={toneByStatus[selectedEventContext.teamMembership.team.status] ?? 'neutral'}>
                  {selectedEventContext.teamMembership.team.name} ({selectedEventContext.teamMembership.team.status})
                </StatusBadge>
              </div>
            )}
            {selectedEventContext.registrationAnswers && (
              <div className="profile-field">
                <label>Анкета</label>
                <StatusBadge tone={selectedEventContext.registrationAnswers.isComplete ? 'success' : 'warning'}>
                  {selectedEventContext.registrationAnswers.isComplete ? 'Заполнена' : 'Не завершена'}
                </StatusBadge>
              </div>
            )}
            {selectedEventContext.participantMembership && (
              <div className="profile-field">
                <label>Назначен</label>
                <span>{formatDate(selectedEventContext.participantMembership.assignedAt)}</span>
              </div>
            )}
          </div>
          {selectedEventContext.registrationAnswers && selectedEventContext.registrationAnswers.answersJson && (
            <div style={{ marginTop: '16px' }}>
              <label style={{ fontWeight: 500, marginBottom: '8px', display: 'block' }}>Ответы анкеты:</label>
              <div className="answers-json-block">
                {Object.entries(selectedEventContext.registrationAnswers.answersJson).map(([key, value]) => (
                  <div key={key} className="answer-item">
                    <span className="answer-key">{key}:</span>
                    <span className="answer-value">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: '16px' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => router.push(`/${locale}/admin/events/${selectedEventContext.event.id}`)}>
              Открыть мероприятие
            </button>
          </div>
        </Panel>
      )}

      <PageHeader title={getName()} subtitle={`ID: ${p.id}`} />

      <div className="admin-user-profile-grid">
        <Panel variant="elevated" className="admin-profile-card">
          <SectionHeader title="Шапка профиля" />
          <div className="admin-profile-avatar">
            <span className="signal-avatar signal-avatar--lg">
              {p.avatarUrl
                ? <img src={p.avatarUrl} alt="" />
                : (getName() || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="admin-profile-field">
            <label>Имя</label>
            <span>{getName()}</span>
          </div>
          <div className="admin-profile-field">
            <label>Email</label>
            <span>{p.email}</span>
          </div>
          <div className="admin-profile-field">
            <label>Аватар</label>
            <span>{p.avatarUrl ? <a href={p.avatarUrl} target="_blank" rel="noopener noreferrer">Открыть</a> : '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>Системная роль</label>
            <StatusBadge tone={p.role === 'SUPER_ADMIN' ? 'warning' : p.role === 'PLATFORM_ADMIN' ? 'info' : 'neutral'}>
              {p.role}
            </StatusBadge>
          </div>
          <div className="admin-profile-field">
            <label>Активен</label>
            <StatusBadge tone={p.isActive ? 'success' : 'danger'}>
              {p.isActive ? 'Активен' : 'Отключён'}
            </StatusBadge>
          </div>
          <div className="admin-profile-field">
            <label>Дата регистрации</label>
            <span>{formatDate(p.registeredAt)}</span>
          </div>
          <div className="admin-profile-field">
            <label>Последний вход</label>
            <span>{formatDate(p.lastLoginAt)}</span>
          </div>
        </Panel>

        <Panel variant="elevated" className="admin-profile-card">
          <SectionHeader title="Основные данные" />
          <div className="admin-profile-field">
            <label>ФИО (кириллица)</label>
            <span>{p.fullNameCyrillic || `${p.lastNameCyrillic ?? ''} ${p.firstNameCyrillic ?? ''} ${p.middleNameCyrillic ?? ''}`.trim() || '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>Имя (латиница)</label>
            <span>{p.fullNameLatin || `${p.firstNameLatin ?? ''} ${p.lastNameLatin ?? ''}`.trim() || '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>Отсутствие фамилии</label>
            <span>{p.hasNoLastName ? 'Да' : 'Нет'}</span>
          </div>
          <div className="admin-profile-field">
            <label>Дата рождения</label>
            <span>{formatDate(p.birthDate)}</span>
          </div>
          <div className="admin-profile-field">
            <label>Город</label>
            <span>{p.city || '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>Фактический адрес</label>
            <span>{p.factualAddress || '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>Телефон</label>
            <span>{p.phone || '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>Telegram</label>
            <span>{p.telegram || '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>Био</label>
            <span>{p.bio || '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>Родной язык</label>
            <span>{p.nativeLanguage || '—'}</span>
          </div>
          <div className="admin-profile-field">
            <label>Язык коммуникации</label>
            <span>{p.communicationLanguage || '—'}</span>
          </div>
        </Panel>

        <Panel variant="elevated" className="admin-profile-card">
          <SectionHeader title="Верификация и согласия" />
          <div className="admin-profile-field">
            <label>Email подтверждён</label>
            {renderVerification(p.emailVerifiedAt)}
          </div>
          <div className="admin-profile-field">
            <label>Телефон подтверждён</label>
            {renderVerification(p.phoneVerifiedAt)}
          </div>
          <div className="admin-profile-field">
            <label>Telegram подтверждён</label>
            {renderVerification(p.telegramVerifiedAt)}
          </div>
          <div className="admin-profile-field">
            <label>Согласие на обработку персональных данных</label>
            {renderConsent(p.consentPersonalData, p.consentPersonalDataAt)}
          </div>
          <div className="admin-profile-field">
            <label>Согласие с правилами клиента</label>
            {renderConsent(p.consentClientRules, p.consentClientRulesAt)}
          </div>
        </Panel>

        {extendedProfile && (
          <Panel variant="elevated" className="admin-profile-card">
            <SectionHeader title="Расширенный профиль" />
            <div className="admin-profile-field">
              <label>Пол</label>
              <span>{extendedProfile.gender || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Код страны гражданства</label>
              <span>{extendedProfile.citizenshipCountryCode || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Код страны проживания</label>
              <span>{extendedProfile.residenceCountryCode || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Регион/Район/Населённый пункт</label>
              <span>{[extendedProfile.regionText, extendedProfile.districtText, extendedProfile.settlementText].filter(Boolean).join(', ') || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Улица/Дом/Квартира</label>
              <span>{[extendedProfile.street, extendedProfile.house, extendedProfile.apartment].filter(Boolean).join(', ') || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Почтовый индекс</label>
              <span>{extendedProfile.postalCode || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Название организации</label>
              <span>{extendedProfile.organizationName || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Факультет/Отдел</label>
              <span>{extendedProfile.facultyOrDepartment || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Курс/Класс/Год</label>
              <span>{extendedProfile.classCourseYear || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Должность</label>
              <span>{extendedProfile.positionTitle || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Статус активности</label>
              <span>{extendedProfile.activityStatus || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Учёба в России</label>
              <span>{extendedProfile.studiesInRussia ? 'Да' : 'Нет'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Уровень английского</label>
              <span>{extendedProfile.englishLevel || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Уровень русского</label>
              <span>{extendedProfile.russianLevel || '—'}</span>
            </div>
            {extendedProfile.achievementsText && (
              <div className="admin-profile-field">
                <label>Достижения</label>
                <span>{extendedProfile.achievementsText}</span>
              </div>
            )}
          </Panel>
        )}

        <Panel variant="elevated" className="admin-profile-card">
          <SectionHeader title="Документы" />
          {identityDocument ? (
            <>
              <div className="admin-profile-field">
                <label>Тип документа</label>
                <span>{identityDocument.documentType || '—'}</span>
              </div>
              {identityDocument.documentSeries && (
                <div className="admin-profile-field">
                  <label>Серия</label>
                  <span>{identityDocument.documentSeries}</span>
                </div>
              )}
              {identityDocument.documentNumber && (
                <div className="admin-profile-field">
                  <label>Номер</label>
                  <span>{identityDocument.documentNumber}</span>
                </div>
              )}
              <div className="admin-profile-field">
                <label>Дата выдачи</label>
                <span>{formatDate(identityDocument.issueDate)}</span>
              </div>
              <div className="admin-profile-field">
                <label>Кем выдан</label>
                <span>{identityDocument.issuedBy || '—'}</span>
              </div>
              <div className="admin-profile-field">
                <label>Срок действия</label>
                <span>{formatDate(identityDocument.expiryDate)}</span>
              </div>
              <div className="admin-profile-field">
                <label>Место рождения</label>
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
              {identityDocument.scanAsset?.publicUrl && (
                <div className="admin-profile-field">
                  <label>Скан документа</label>
                  <a href={identityDocument.scanAsset.publicUrl} target="_blank" rel="noopener noreferrer">Открыть скан</a>
                </div>
              )}
            </>
          ) : (
            <span className="signal-muted">Документ не указан</span>
          )}

          {internationalPassport && (
            <>
              <div className="admin-profile-field">
                <label>Загранпаспорт</label>
                <span>{[internationalPassport.countryCode, internationalPassport.series, internationalPassport.number].filter(Boolean).join(' ') || '—'}</span>
              </div>
              <div className="admin-profile-field">
                <label>Дата выдачи загранпаспорта</label>
                <span>{formatDate(internationalPassport.issueDate)}</span>
              </div>
              <div className="admin-profile-field">
                <label>Срок действия загранпаспорта</label>
                <span>{formatDate(internationalPassport.expiryDate)}</span>
              </div>
              {internationalPassport.scanAsset?.publicUrl && (
                <div className="admin-profile-field">
                  <label>Скан загранпаспорта</label>
                  <a href={internationalPassport.scanAsset.publicUrl} target="_blank" rel="noopener noreferrer">Открыть скан</a>
                </div>
              )}
            </>
          )}

          {additionalDocuments && additionalDocuments.length > 0 && (
            <>
              <SectionHeader title="Дополнительные документы" />
              {additionalDocuments.map((doc, idx) => (
                <div key={idx} className="admin-profile-field">
                  <label>{doc.type || 'Документ'}</label>
                  <div>
                    {doc.notes && <span style={{ marginRight: '8px' }}>{doc.notes}</span>}
                    {doc.asset?.publicUrl && <a href={doc.asset.publicUrl} target="_blank" rel="noopener noreferrer">Открыть</a>}
                  </div>
                </div>
              ))}
            </>
          )}
        </Panel>

        {socialLinks && (
          <Panel variant="elevated" className="admin-profile-card">
            <SectionHeader title="Соцсети и контакты" />
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

        {emergencyContact && (
          <Panel variant="elevated" className="admin-profile-card">
            <SectionHeader title="Экстренный контакт" />
            <div className="admin-profile-field">
              <label>Полное имя</label>
              <span>{emergencyContact.fullName || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Отношение</label>
              <span>{emergencyContact.relationship || '—'}</span>
            </div>
            <div className="admin-profile-field">
              <label>Телефон</label>
              <span>{emergencyContact.phone || '—'}</span>
            </div>
          </Panel>
        )}

        {p.accounts.length > 0 && (
          <Panel variant="elevated" className="admin-profile-card">
            <SectionHeader title="Аккаунты авторизации" />
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>Провайдер</th>
                    <th>Email провайдера</th>
                    <th>Привязан</th>
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
          </Panel>
        )}

        {activityDirections.length > 0 && (
          <Panel variant="elevated" className="admin-profile-card">
            <SectionHeader title="Направления деятельности" />
            <div className="admin-tags-list">
              {activityDirections.map((dir) => (
                <span key={dir} className="admin-tag">{dir}</span>
              ))}
            </div>
          </Panel>
        )}

        {additionalLanguages.length > 0 && (
          <Panel variant="elevated" className="admin-profile-card">
            <SectionHeader title="Дополнительные языки" />
            <div className="admin-tags-list">
              {additionalLanguages.map((lang) => (
                <span key={lang} className="admin-tag">{lang}</span>
              ))}
            </div>
          </Panel>
        )}

        <Panel variant="elevated" className="admin-profile-card admin-profile-card--full">
          <SectionHeader title="Участия в событиях" />
          {eventMemberships.length > 0 ? (
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>Событие</th>
                    <th>Роль</th>
                    <th>Статус</th>
                    <th>Назначен</th>
                    <th>Одобрен</th>
                    <th>Отклонён</th>
                    <th>Удалён</th>
                    <th>Заметки</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {eventMemberships.map((m) => (
                    <tr key={m.id}>
                      <td>{m.event.title}</td>
                      <td><StatusBadge tone={m.role === 'EVENT_ADMIN' ? 'warning' : 'info'}>{m.role}</StatusBadge></td>
                      <td><StatusBadge tone={toneByStatus[m.status] ?? 'neutral'}>{m.status}</StatusBadge></td>
                      <td>{formatDate(m.assignedAt)}</td>
                      <td>{formatDate(m.approvedAt)}</td>
                      <td>{formatDate(m.rejectedAt)}</td>
                      <td>{formatDate(m.removedAt)}</td>
                      <td>{m.notes || '—'}</td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(`/${locale}/admin/users/${userId}?eventId=${m.event.id}`)}>
                          Открыть контекст
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          ) : (
            <span className="signal-muted">Нет участий</span>
          )}
        </Panel>

        {teamMemberships.length > 0 && (
          <Panel variant="elevated" className="admin-profile-card admin-profile-card--full">
            <SectionHeader title="Команды" />
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>Событие</th>
                    <th>Команда</th>
                    <th>Статус команды</th>
                    <th>Роль в команде</th>
                    <th>Статус участника</th>
                    <th>Присоединился</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMemberships.map((m) => (
                    <tr key={m.id}>
                      <td>{m.team.eventTitle}</td>
                      <td>{m.team.name}</td>
                      <td><StatusBadge tone={toneByStatus[m.team.status] ?? 'neutral'}>{m.team.status}</StatusBadge></td>
                      <td><StatusBadge tone={m.role === 'CAPTAIN' ? 'warning' : 'info'}>{m.role}</StatusBadge></td>
                      <td><StatusBadge tone={toneByStatus[m.status] ?? 'neutral'}>{m.status}</StatusBadge></td>
                      <td>{formatDate(m.joinedAt)}</td>
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