'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteParams } from '@/hooks/useRouteParams';
import { AdminDateTimePicker } from '@/components/admin/AdminDateTimePicker';

const PROFILE_REQUIREMENT_OPTIONS = [
  { key: 'lastNameCyrillic', ru: 'Фамилия кириллицей', en: 'Last name Cyrillic' },
  { key: 'firstNameCyrillic', ru: 'Имя кириллицей', en: 'First name Cyrillic' },
  { key: 'middleNameCyrillic', ru: 'Отчество кириллицей', en: 'Middle name Cyrillic' },
  { key: 'lastNameLatin', ru: 'Фамилия латиницей', en: 'Last name Latin' },
  { key: 'firstNameLatin', ru: 'Имя латиницей', en: 'First name Latin' },
  { key: 'middleNameLatin', ru: 'Отчество латиницей', en: 'Middle name Latin' },
  { key: 'birthDate', ru: 'Дата рождения', en: 'Date of birth' },
  { key: 'gender', ru: 'Пол', en: 'Gender' },
  { key: 'citizenshipCountryCode', ru: 'Гражданство', en: 'Citizenship' },
  { key: 'residenceCountryCode', ru: 'Страна проживания', en: 'Residence country' },
  { key: 'phone', ru: 'Телефон', en: 'Phone' },
  { key: 'telegram', ru: 'Telegram', en: 'Telegram' },
  { key: 'avatarUrl', ru: 'Фото профиля', en: 'Profile photo' },
  { key: 'regionId', ru: 'Регион проживания', en: 'Residence region' },
  { key: 'districtId', ru: 'Район проживания', en: 'Residence district' },
  { key: 'settlementId', ru: 'Населённый пункт', en: 'Settlement' },
  { key: 'street', ru: 'Улица', en: 'Street' },
  { key: 'house', ru: 'Дом', en: 'House' },
  { key: 'postalCode', ru: 'Почтовый индекс', en: 'Postal code' },
  { key: 'nativeLanguage', ru: 'Родной язык', en: 'Native language' },
  { key: 'communicationLanguage', ru: 'Язык общения', en: 'Communication language' },
  { key: 'personalDocumentsComplete', ru: 'Личные документы полностью', en: 'Personal documents complete' },
  { key: 'contactDataComplete', ru: 'Контактные данные полностью', en: 'Contact data complete' },
  { key: 'activityStatus', ru: 'Статус активности', en: 'Activity status' },
  { key: 'organizationName', ru: 'Организация', en: 'Organization' },
  { key: 'activityDirections', ru: 'Направления активности', en: 'Activity directions' },
  { key: 'englishLevel', ru: 'Уровень английского', en: 'English level' },
  { key: 'russianLevel', ru: 'Уровень русского', en: 'Russian level' },
];

const PROFILE_REQUIREMENT_KEYS = new Set(PROFILE_REQUIREMENT_OPTIONS.map((option) => option.key));
const LEGACY_PROFILE_REQUIREMENT_MAP: Record<string, string[]> = {
  name: ['lastNameCyrillic', 'firstNameCyrillic', 'lastNameLatin', 'firstNameLatin'],
  city: ['settlementId'],
  factualAddress: ['street', 'house', 'postalCode'],
  telegram: ['telegram'],
};

const EVENT_REQUIREMENT_HINT = 'motivation, experience, emergencyContact, university, faculty, course';

const CATEGORY_OPTIONS = [
  { value: 'Tech', ru: 'Технологии', en: 'Tech' },
  { value: 'Business', ru: 'Бизнес', en: 'Business' },
  { value: 'Design', ru: 'Дизайн', en: 'Design' },
  { value: 'Arts & Culture', ru: 'Искусство и культура', en: 'Arts & Culture' },
  { value: 'Sports', ru: 'Спорт', en: 'Sports' },
  { value: 'Community', ru: 'Сообщество', en: 'Community' },
  { value: 'Education', ru: 'Образование', en: 'Education' },
  { value: 'Other', ru: 'Другое', en: 'Other' },
];

export default function EditEventPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, get } = useRouteParams();
  const eventId = get('id');
  const isRu = locale === 'ru';

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    shortDescription: '',
    description: '',
    category: 'Tech',
    status: 'DRAFT',
    coverImageUrl: '',
    location: '',
    startsAt: '',
    endsAt: '',
    capacity: 100,
    registrationOpensAt: '',
    registrationDeadline: '',
    conditions: '',
    contactEmail: '',
    contactPhone: '',
    tags: '',
    registrationEnabled: true,
    volunteerApplicationsEnabled: false,
    isTeamBased: false,
    minTeamSize: 1,
    maxTeamSize: 1,
    allowSoloParticipation: true,
    teamJoinMode: 'OPEN',
    requireAdminApprovalForTeams: false,
    requiredProfileFields: [] as string[],
    requiredEventFields: '',
    // Participation config
    requireParticipantApproval: false,
    participantLimitMode: 'UNLIMITED' as 'UNLIMITED' | 'GOAL_LIMIT' | 'STRICT_LIMIT',
    participantTarget: undefined as number | undefined,
    participantCountVisibility: 'PUBLIC' as 'PUBLIC' | 'HIDDEN',
  });

  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventAdmins, setEventAdmins] = useState<any[]>([]);
  const [adminEmail, setAdminEmail] = useState('');
  const [assigningAdmin, setAssigningAdmin] = useState(false);
  const [assignAdminError, setAssignAdminError] = useState('');
  const [assignAdminSuccess, setAssignAdminSuccess] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState('');
  const [coverDragActive, setCoverDragActive] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin || !eventId) return;
    adminApi.listEvents({ id: eventId, limit: 1 })
      .then(r => {
        if (r.data[0]) {
          const e = r.data[0];
          const toLocal = (iso?: string) => iso ? new Date(iso).toISOString().slice(0, 16) : '';
          setForm({
            title: e.title ?? '',
            slug: e.slug ?? '',
            shortDescription: e.shortDescription ?? '',
            description: e.fullDescription ?? e.description ?? '',
            category: e.category ?? 'Tech',
            status: e.status ?? 'DRAFT',
            coverImageUrl: e.coverImageUrl ?? '',
            location: e.location ?? '',
            startsAt: toLocal(e.startsAt),
            endsAt: toLocal(e.endsAt),
            capacity: e.capacity ?? 100,
            registrationOpensAt: toLocal(e.registrationOpensAt),
            registrationDeadline: toLocal(e.registrationDeadline),
            conditions: e.conditions ?? '',
            contactEmail: e.contactEmail ?? '',
            contactPhone: e.contactPhone ?? '',
            tags: Array.isArray(e.tags) ? e.tags.join(', ') : '',
            registrationEnabled: e.registrationEnabled ?? true,
            volunteerApplicationsEnabled: Boolean(e.volunteerApplicationsEnabled),
            isTeamBased: Boolean(e.isTeamBased),
            minTeamSize: e.minTeamSize ?? 1,
            maxTeamSize: e.maxTeamSize ?? 1,
            allowSoloParticipation: e.allowSoloParticipation ?? true,
            teamJoinMode: e.teamJoinMode ?? 'OPEN',
            requireAdminApprovalForTeams: Boolean(e.requireAdminApprovalForTeams),
            requiredProfileFields: Array.isArray(e.requiredProfileFields)
              ? normalizeProfileRequirements(e.requiredProfileFields)
              : [],
            requiredEventFields: Array.isArray(e.requiredEventFields) ? e.requiredEventFields.join(', ') : '',
            // Participation config
            requireParticipantApproval: Boolean(e.requireParticipantApproval),
            participantLimitMode: e.participantLimitMode ?? 'UNLIMITED',
            participantTarget: e.participantTarget ?? undefined,
            participantCountVisibility: e.participantCountVisibility ?? 'PUBLIC',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingEvent(false));

    adminApi.listEventAdmins(eventId)
      .then(r => setEventAdmins(r.eventAdmins))
      .catch(() => setEventAdmins([]));
  }, [user, isAdmin, eventId]);

  useEffect(() => {
    if (searchParams.get('created')) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let nextValue: string | boolean = e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
      ? e.target.checked
      : value;
    if (name === 'contactPhone') nextValue = formatUzbekPhone(value);
    setForm(prev => {
      const next = { ...prev, [name]: nextValue };
      if (name === 'title') {
        next.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
      return next;
    });
  };

  const setDateField = (name: 'startsAt' | 'endsAt' | 'registrationOpensAt' | 'registrationDeadline', value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const toggleRequiredProfileField = (field: string) => {
    setForm(prev => ({
      ...prev,
      requiredProfileFields: prev.requiredProfileFields.includes(field)
        ? prev.requiredProfileFields.filter(item => item !== field)
        : [...prev.requiredProfileFields, field],
    }));
  };

  async function handleCoverFile(file?: File) {
    if (!file) return;
    setCoverUploading(true);
    setCoverUploadError('');
    try {
      const result = await adminApi.uploadEventCover(file);
      setForm(prev => ({ ...prev, coverImageUrl: result.publicUrl }));
    } catch (err: any) {
      setCoverUploadError(err.message || (isRu ? 'Не удалось загрузить обложку' : 'Failed to upload cover'));
    } finally {
      setCoverUploading(false);
      setCoverDragActive(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSubmitting(true);

    if (!form.startsAt || !form.endsAt) {
      setError(isRu ? 'Укажите дату и время начала и окончания.' : 'Set start and end date/time.');
      setSubmitting(false);
      return;
    }

    const payload = {
      ...form,
      capacity: parseInt(String(form.capacity)) || 100,
      minTeamSize: parseInt(String(form.minTeamSize)) || 1,
      maxTeamSize: parseInt(String(form.maxTeamSize)) || 1,
      participantTarget: form.participantTarget ? parseInt(String(form.participantTarget)) : undefined,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      registrationOpensAt: form.registrationOpensAt ? new Date(form.registrationOpensAt).toISOString() : '',
      registrationDeadline: form.registrationDeadline ? new Date(form.registrationDeadline).toISOString() : '',
      requiredProfileFields: form.requiredProfileFields,
      requiredEventFields: form.requiredEventFields.split(',').map(field => field.trim()).filter(Boolean),
    };

    try {
      await adminApi.updateEvent(eventId, payload);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update event');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignEventAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !adminEmail.trim()) return;
    setAssigningAdmin(true);
    setAssignAdminError('');
    setAssignAdminSuccess('');

    try {
      const { membership } = await adminApi.assignEventAdmin(eventId, { email: adminEmail.trim() });
      setEventAdmins(prev => [membership, ...prev.filter(item => item.id !== membership.id)]);
      setAdminEmail('');
      setAssignAdminSuccess(isRu ? 'Администратор назначен.' : 'Event admin assigned.');
    } catch (err: any) {
      setAssignAdminError(err.message || (isRu ? 'Не удалось назначить администратора' : 'Failed to assign event admin'));
    } finally {
      setAssigningAdmin(false);
    }
  };

  if (loading || !user || !isAdmin) return (
    <div className="admin-form-loading">
      <div>{t('common.loading')}</div>
    </div>
  );

  return (
    <div className="signal-page-shell admin-control-page admin-form-page">
      <div className="admin-form-container">
        <div className="admin-form-header">
          <Link href={`/${locale}/admin/events/${eventId}/overview`} className="admin-form-backlink">
            ← {t('common.back')}
          </Link>
          <h1 className="admin-form-title">
            {isRu ? 'Редактировать мероприятие' : t('admin.editEvent')}
          </h1>
          <p className="admin-form-subtitle">
            {isRu ? 'Настройте описание, регистрацию, командный формат и поля заявки.' : 'Configure details, registration, teams, and application fields.'}
          </p>
        </div>

        {success && (
          <div className="admin-form-alert admin-form-alert-success">
            {isRu ? 'Мероприятие сохранено.' : 'Event updated successfully.'}
          </div>
        )}

        {loadingEvent ? (
          <div className="admin-form-subtitle">{t('common.loading')}</div>
        ) : (
          <>
          <form onSubmit={handleSubmit} className="admin-form-stack">
            {error && (
              <div className="admin-form-alert admin-form-alert-danger">
                {error}
              </div>
            )}

            {/* Title & Slug */}
            <div className="admin-form-grid">
              <div className="admin-form-field">
                <label className="admin-form-label">{isRu ? 'Название *' : 'Title *'}</label>
                <input className="admin-form-control" name="title" value={form.title} onChange={handleChange} required />
              </div>
              <div className="admin-form-field">
                <label className="admin-form-label">{isRu ? 'Адрес страницы' : 'Slug'}</label>
                <input className="admin-form-control admin-form-control-muted" name="slug" value={form.slug} onChange={handleChange} />
              </div>
            </div>

            {/* Short description */}
            <div className="admin-form-field">
              <label className="admin-form-label">{isRu ? 'Краткое описание' : 'Short description'}</label>
              <input className="admin-form-control" name="shortDescription" value={form.shortDescription} onChange={handleChange} />
            </div>

            {/* Description */}
            <div className="admin-form-field">
              <label className="admin-form-label">{isRu ? 'Полное описание *' : 'Description *'}</label>
              <textarea className="admin-form-control admin-form-textarea" name="description" value={form.description} onChange={handleChange} required rows={5} />
            </div>

            {/* Category & Status */}
            <div className="admin-form-grid">
              <div className="admin-form-field">
                <label className="admin-form-label">{isRu ? 'Категория' : 'Category'}</label>
                <select className="admin-form-control" name="category" value={form.category} onChange={handleChange}>
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c.value} value={c.value}>{isRu ? c.ru : c.en}</option>
                  ))}
                </select>
              </div>
              <div className="admin-form-field">
                <label className="admin-form-label">{isRu ? 'Статус' : 'Status'}</label>
                <select className="admin-form-control" name="status" value={form.status} onChange={handleChange}>
                  <option value="DRAFT">{isRu ? 'Черновик' : 'Draft'}</option>
                  <option value="PUBLISHED">{isRu ? 'Опубликовано' : 'Published'}</option>
                  <option value="CANCELLED">{isRu ? 'Отменено' : 'Cancelled'}</option>
                </select>
              </div>
            </div>

            {/* Cover image */}
            <div className="admin-form-field">
              <label className="admin-form-label">{isRu ? 'Обложка' : 'Cover image'}</label>
              <div
                onDragOver={(event) => { event.preventDefault(); setCoverDragActive(true); }}
                onDragLeave={() => setCoverDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  void handleCoverFile(event.dataTransfer.files?.[0]);
                }}
                className={`admin-upload-dropzone ${coverDragActive ? 'drag-active' : ''}`}
              >
                <div className="admin-upload-preview">
                  {form.coverImageUrl ? (
                    <Image src={form.coverImageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 400px" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className="admin-upload-preview-placeholder">{isRu ? 'Превью' : 'Preview'}</div>
                  )}
                </div>
                <div className="admin-upload-copy">
                  <div className="admin-upload-note">
                    {isRu ? 'Перетащите JPG, PNG или WebP до 5 МБ.' : 'Drop JPG, PNG, or WebP up to 5 MB.'}
                  </div>
                  <div className="admin-upload-actions">
                    <label className="btn btn-secondary btn-sm">
                      {coverUploading ? (isRu ? 'Загрузка...' : 'Uploading...') : (isRu ? 'Загрузить файл' : 'Upload file')}
                      <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void handleCoverFile(event.target.files?.[0])} />
                    </label>
                    <span className="admin-form-help">{isRu ? 'или укажите ссылку ниже' : 'or paste a URL below'}</span>
                  </div>
                  {coverUploadError ? <div className="admin-upload-error">{coverUploadError}</div> : null}
                </div>
              </div>
              <input className="admin-form-control" name="coverImageUrl" value={form.coverImageUrl} onChange={handleChange} type="url" placeholder="https://..." />
            </div>

            {/* Location */}
            <div className="admin-form-field">
              <label className="admin-form-label">{isRu ? 'Место проведения' : 'Location'}</label>
              <input className="admin-form-control" name="location" value={form.location} onChange={handleChange} />
            </div>

            {/* Dates */}
            <div className="admin-form-grid-dates">
              <AdminDateTimePicker label={isRu ? 'Начало *' : 'Starts at *'} value={form.startsAt} onChange={(value) => setDateField('startsAt', value)} locale={locale} required />
              <AdminDateTimePicker label={isRu ? 'Окончание *' : 'Ends at *'} value={form.endsAt} onChange={(value) => setDateField('endsAt', value)} locale={locale} required />
              <AdminDateTimePicker label={isRu ? 'Открытие регистрации' : 'Registration opens'} value={form.registrationOpensAt} onChange={(value) => setDateField('registrationOpensAt', value)} locale={locale} />
              <AdminDateTimePicker label={isRu ? 'Дедлайн регистрации' : 'Registration deadline'} value={form.registrationDeadline} onChange={(value) => setDateField('registrationDeadline', value)} locale={locale} />
            </div>

            {/* Capacity */}
            <div className="admin-form-field admin-form-field-compact">
              <label className="admin-form-label">{isRu ? 'Вместимость' : 'Capacity'}</label>
              <input className="admin-form-control" name="capacity" value={form.capacity} onChange={handleChange} type="number" min="1" />
            </div>

            {/* Team settings */}
            <div className="admin-form-section">
              <label className="admin-form-checkbox-row admin-form-label-strong">
                <input name="isTeamBased" checked={form.isTeamBased} onChange={handleChange} type="checkbox" />
                {isRu ? 'Командное мероприятие' : 'Team-based event'}
              </label>
              {form.isTeamBased && (
                <div className="admin-form-grid-compact">
                  <div className="admin-form-field">
                    <label className="admin-form-label">{isRu ? 'Минимум в команде' : 'Min team size'}</label>
                    <input name="minTeamSize" value={form.minTeamSize} onChange={handleChange} type="number" min="1" className="admin-form-control" />
                  </div>
                  <div className="admin-form-field">
                    <label className="admin-form-label">{isRu ? 'Максимум в команде' : 'Max team size'}</label>
                    <input name="maxTeamSize" value={form.maxTeamSize} onChange={handleChange} type="number" min="1" className="admin-form-control" />
                  </div>
                  <div className="admin-form-field">
                    <label className="admin-form-label">{isRu ? 'Как вступают' : 'Join mode'}</label>
                    <select name="teamJoinMode" value={form.teamJoinMode} onChange={handleChange} className="admin-form-control">
                      <option value="OPEN">{isRu ? 'Свободно' : 'Open'}</option>
                      <option value="BY_CODE">{isRu ? 'По коду команды' : 'By code'}</option>
                      <option value="BY_REQUEST">{isRu ? 'По заявке' : 'By request'}</option>
                      <option value="EMAIL_INVITE">{isRu ? 'Email-приглашения по слотам' : 'Email invites by slots'}</option>
                    </select>
                  </div>
                  <label className="admin-form-checkbox-row">
                    <input name="allowSoloParticipation" checked={form.allowSoloParticipation} onChange={handleChange} type="checkbox" />
                    {isRu ? 'Разрешить одиночное участие' : 'Allow solo participation'}
                  </label>
                  <label className="admin-form-checkbox-row">
                    <input name="requireAdminApprovalForTeams" checked={form.requireAdminApprovalForTeams} onChange={handleChange} type="checkbox" />
                    {isRu ? 'Команды подтверждает админ' : 'Require admin approval'}
                  </label>
                </div>
              )}
            </div>

            {/* Participation settings */}
            <div className="admin-form-section">
              <h2 className="admin-form-section-title">{isRu ? 'Регистрация участников' : 'Participation settings'}</h2>
              <p className="admin-form-section-copy">
                {isRu ? 'Настройте, как пользователь попадает в участники: сразу, после одобрения или до строгого лимита.' : 'Configure how users join this event. Different modes control approval flow and capacity limits.'}
              </p>
              <div className="admin-form-checkbox-list">
                <label className="admin-form-checkbox-row">
                  <input name="registrationEnabled" checked={form.registrationEnabled} onChange={handleChange} type="checkbox" />
                  {isRu ? 'Регистрация включена' : 'Registration enabled'}
                </label>
                <label className="admin-form-checkbox-row">
                  <input name="volunteerApplicationsEnabled" checked={form.volunteerApplicationsEnabled} onChange={handleChange} type="checkbox" />
                  {isRu ? 'Принимать заявки волонтёров' : 'Volunteer applications enabled'}
                </label>
              </div>
              <div className="admin-form-grid-compact">
                <div className="admin-form-field">
                  <label className="admin-form-label">{isRu ? 'Режим лимита' : 'Limit mode'}</label>
                  <select name="participantLimitMode" value={form.participantLimitMode} onChange={handleChange} className="admin-form-control">
                    <option value="UNLIMITED">{isRu ? 'Без лимита' : 'Unlimited'}</option>
                    <option value="GOAL_LIMIT">{isRu ? 'Цель, но не блокировать' : 'Goal (soft limit)'}</option>
                    <option value="STRICT_LIMIT">{isRu ? 'Строгий лимит' : 'Strict limit'}</option>
                  </select>
                </div>
                {(form.participantLimitMode === 'GOAL_LIMIT' || form.participantLimitMode === 'STRICT_LIMIT') && (
                  <div className="admin-form-field">
                    <label className="admin-form-label">
                      {form.participantLimitMode === 'GOAL_LIMIT'
                        ? (isRu ? 'Цель по участникам' : 'Target participants')
                        : (isRu ? 'Максимум участников' : 'Max participants')}
                    </label>
                    <input name="participantTarget" value={form.participantTarget || ''} onChange={handleChange} type="number" min="1" placeholder={String(form.capacity)} className="admin-form-control" />
                  </div>
                )}
                <div className="admin-form-field">
                  <label className="admin-form-label">{isRu ? 'Видимость счётчика' : 'Count visibility'}</label>
                  <select name="participantCountVisibility" value={form.participantCountVisibility} onChange={handleChange} className="admin-form-control">
                    <option value="PUBLIC">{isRu ? 'Показывать участникам' : 'Public (show count)'}</option>
                    <option value="HIDDEN">{isRu ? 'Только в админке' : 'Hidden (admin only)'}</option>
                  </select>
                </div>
              </div>
              <label className="admin-form-checkbox-row">
                <input name="requireParticipantApproval" checked={form.requireParticipantApproval} onChange={handleChange} type="checkbox" />
                {isRu ? 'Участие только после одобрения админом' : 'Require admin approval for participation'}
              </label>
              <div className="admin-form-hint-box">
                {form.requireParticipantApproval ? (
                  <>{isRu ? 'Пользователь отправляет заявку, а админ одобряет или отклоняет её в панели.' : 'Users submit an application (PENDING) and you approve/reject from admin panel.'}</>
                ) : form.participantLimitMode === 'STRICT_LIMIT' ? (
                  <>{isRu ? 'Пользователь регистрируется сразу, пока не достигнут лимит.' : 'Users register instantly until the limit is reached. No admin action needed.'}</>
                ) : form.participantLimitMode === 'GOAL_LIMIT' ? (
                  <>{isRu ? 'Пользователь регистрируется сразу. После достижения цели админ сам решает, закрывать ли набор.' : 'Users register instantly. Admin decides when to close registration after goal is reached.'}</>
                ) : (
                  <>{isRu ? 'Пользователь регистрируется сразу. Ограничение только по дедлайну или ручному закрытию регистрации.' : 'Users register instantly. Registration is only limited by deadline or manual closing.'}</>
                )}
              </div>
            </div>

            {/* Registration requirements */}
            <div className="admin-form-section">
              <h2 className="admin-form-section-title">{isRu ? 'Что нужно для заявки' : 'Registration requirements'}</h2>
              <p className="admin-form-section-copy">
                {isRu ? 'Эти поля проверяются перед участием в конкретном мероприятии. Регистрация аккаунта остаётся через email и пароль.' : 'These fields gate participation in this event only. Platform account creation stays email and password.'}
              </p>
              <div className="admin-form-field">
                <div className="admin-form-label admin-form-label-strong">{isRu ? 'Обязательные поля профиля' : 'Required profile fields'}</div>
                <div className="admin-form-chip-grid">
                  {PROFILE_REQUIREMENT_OPTIONS.map(option => (
                    <label key={option.key} className={`admin-form-chip ${form.requiredProfileFields.includes(option.key) ? 'active' : ''}`}>
                      <input type="checkbox" checked={form.requiredProfileFields.includes(option.key)} onChange={() => toggleRequiredProfileField(option.key)} />
                      {isRu ? option.ru : option.en}
                    </label>
                  ))}
                </div>
              </div>
              <div className="admin-form-field">
                <label className="admin-form-label admin-form-label-strong">{isRu ? 'Поля анкеты мероприятия' : 'Event-specific required fields'}</label>
                <input className="admin-form-control" name="requiredEventFields" value={form.requiredEventFields} onChange={handleChange} placeholder={EVENT_REQUIREMENT_HINT} />
                <div className="admin-form-help">{isRu ? 'Ключи через запятую. Ответы сохраняются отдельно для этого мероприятия.' : 'Comma-separated field keys. Answers are stored per event.'}</div>
              </div>
            </div>

            {/* Conditions */}
            <div className="admin-form-field">
              <label className="admin-form-label">{isRu ? 'Условия участия' : 'Participation conditions'}</label>
              <textarea className="admin-form-control admin-form-textarea" name="conditions" value={form.conditions} onChange={handleChange} rows={3} />
            </div>

            {/* Contact */}
            <div className="admin-form-grid">
              <div className="admin-form-field">
                <label className="admin-form-label">{isRu ? 'Email организатора' : 'Contact email'}</label>
                <input className="admin-form-control" name="contactEmail" value={form.contactEmail} onChange={handleChange} type="email" />
              </div>
              <div className="admin-form-field">
                <label className="admin-form-label">{isRu ? 'Телефон организатора' : 'Contact phone'}</label>
                <input className="admin-form-control" name="contactPhone" value={form.contactPhone} onChange={handleChange} type="tel" inputMode="tel" placeholder="+998 90 123 45 67" />
              </div>
            </div>

            {/* Tags */}
            <div className="admin-form-field">
              <label className="admin-form-label">{isRu ? 'Теги через запятую' : 'Tags (comma-separated)'}</label>
              <input className="admin-form-control" name="tags" value={form.tags} onChange={handleChange} />
            </div>

            {/* Actions */}
            <div className="admin-form-actions">
              <button type="submit" disabled={submitting} className="btn btn-primary">
                {submitting ? (isRu ? 'Сохраняем...' : 'Saving...') : t('common.save')}
              </button>
              <Link href={`/${locale}/admin/events/${eventId}/settings`} className="btn btn-secondary">
                {t('common.cancel')}
              </Link>
            </div>
          </form>

          <section className="admin-section-divider">
            <h2 className="admin-form-section-title">{isRu ? 'Администраторы мероприятия' : 'Event admins'}</h2>
            {eventAdmins.length === 0 ? (
              <p className="admin-form-subtitle">{isRu ? 'Администраторы пока не назначены.' : 'No event admins assigned yet.'}</p>
            ) : (
              <div className="admin-admin-card-list">
                {eventAdmins.map(admin => (
                  <div key={admin.id} className="admin-admin-card">
                    <div className="admin-admin-card-body">
                      <div className="admin-admin-card-title">{admin.user?.name ?? (isRu ? 'Без имени' : 'Unnamed user')}</div>
                      <div className="admin-admin-card-subtitle">{admin.user?.email}</div>
                    </div>
                    <span className="admin-admin-status">{admin.status}</span>
                  </div>
                ))}
              </div>
            )}

            {isPlatformAdmin && (
              <form onSubmit={handleAssignEventAdmin} className="admin-inline-form">
                <label className="admin-form-label">{isRu ? 'Назначить администратора по email' : 'Assign event admin by email'}</label>
                <div className="admin-inline-form-row">
                  <input
                    className="admin-form-control"
                    value={adminEmail}
                    onChange={event => setAdminEmail(event.target.value)}
                    type="email"
                    placeholder="organizer@example.com"
                  />
                  <button type="submit" disabled={assigningAdmin || !adminEmail.trim()} className="btn btn-primary">
                    {assigningAdmin ? (isRu ? 'Назначаем...' : 'Assigning...') : (isRu ? 'Назначить' : 'Assign')}
                  </button>
                </div>
                {assignAdminError && <div className="admin-inline-feedback-danger">{assignAdminError}</div>}
                {assignAdminSuccess && <div className="admin-inline-feedback-success">{assignAdminSuccess}</div>}
              </form>
            )}
          </section>
          </>
        )}
      </div>
    </div>
  );
}

function formatUzbekPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  const local = (digits.startsWith('998') ? digits.slice(3) : digits).slice(0, 9);
  if (!local) return '';
  return [
    '+998',
    local.slice(0, 2),
    local.slice(2, 5),
    local.slice(5, 7),
    local.slice(7, 9),
  ].filter(Boolean).join(' ');
}

function normalizeProfileRequirements(fields: string[]) {
  const normalized = fields.flatMap((field) => {
    if (field === 'consentPersonalData' || field === 'consentClientRules') return [];
    if (PROFILE_REQUIREMENT_KEYS.has(field)) return [field];
    return LEGACY_PROFILE_REQUIREMENT_MAP[field] ?? [];
  });
  return Array.from(new Set(normalized));
}
