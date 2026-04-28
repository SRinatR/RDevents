'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
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

export default function NewEventPage() {
  const t = useTranslations();
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
    participantLimitMode: 'UNLIMITED',
    participantTarget: undefined as number | undefined,
    participantCountVisibility: 'PUBLIC',
  });

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : (form.startsAt ? new Date(form.startsAt).toISOString() : undefined),
      registrationOpensAt: form.registrationOpensAt ? new Date(form.registrationOpensAt).toISOString() : undefined,
      registrationDeadline: form.registrationDeadline ? new Date(form.registrationDeadline).toISOString() : undefined,
      requiredProfileFields: form.requiredProfileFields,
      requiredEventFields: form.requiredEventFields.split(',').map(field => field.trim()).filter(Boolean),
    };

    try {
      const result = await adminApi.createEvent(payload);
      router.push(`/${locale}/admin/events/${result.event.id}/edit?created=1`);
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
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
          <Link href={`/${locale}/admin/events`} className="admin-form-backlink">
            ← {t('common.back')}
          </Link>
          <h1 className="admin-form-title">
            {isRu ? 'Создать мероприятие' : 'Create event'}
          </h1>
          <p className="admin-form-subtitle">
            {isRu ? 'Заполните основные данные, правила регистрации и параметры команд. Событие можно оставить черновиком.' : 'Fill event details, registration rules, and team settings. You can keep it as a draft.'}
          </p>
        </div>

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
              <input
                className="admin-form-control"
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder={isRu ? 'Например: Startup Weekend Tashkent' : 'Example: Startup Weekend Tashkent'}
              />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">{isRu ? 'Адрес страницы' : 'Slug'}</label>
              <input className="admin-form-control admin-form-control-muted" name="slug" value={form.slug} onChange={handleChange} />
            </div>
          </div>

          {/* Short description */}
          <div className="admin-form-field">
            <label className="admin-form-label">{isRu ? 'Краткое описание' : 'Short description'}</label>
            <input
              className="admin-form-control"
              name="shortDescription"
              value={form.shortDescription}
              onChange={handleChange}
              placeholder={isRu ? 'Коротко для карточек и списка мероприятий' : 'Brief summary for cards and listings'}
            />
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
              </select>
            </div>
          </div>

          {/* Cover image */}
          <div className="admin-form-field">
            <label className="admin-form-label">{isRu ? 'Ссылка на обложку' : 'Cover image URL'}</label>
            <input className="admin-form-control" name="coverImageUrl" value={form.coverImageUrl} onChange={handleChange} placeholder="https://..." type="url" />
          </div>

          {/* Location */}
          <div className="admin-form-field">
            <label className="admin-form-label">{isRu ? 'Место проведения' : 'Location'}</label>
            <input
              className="admin-form-control"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder={isRu ? 'Площадка или адрес' : 'Venue name or address'}
            />
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
            <textarea
              className="admin-form-control admin-form-textarea"
              name="conditions"
              value={form.conditions}
              onChange={handleChange}
              rows={3}
              placeholder={isRu ? 'Требования, правила или важные условия для участников' : 'Any requirements or rules for participants'}
            />
          </div>

          {/* Contact */}
          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label className="admin-form-label">{isRu ? 'Email организатора' : 'Contact email'}</label>
              <input className="admin-form-control" name="contactEmail" value={form.contactEmail} onChange={handleChange} type="email" placeholder="event@example.com" />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">{isRu ? 'Телефон организатора' : 'Contact phone'}</label>
              <input className="admin-form-control" name="contactPhone" value={form.contactPhone} onChange={handleChange} type="tel" inputMode="tel" placeholder="+998 90 123 45 67" />
            </div>
          </div>

          {/* Tags */}
          <div className="admin-form-field">
            <label className="admin-form-label">{isRu ? 'Теги через запятую' : 'Tags (comma-separated)'}</label>
            <input className="admin-form-control" name="tags" value={form.tags} onChange={handleChange} placeholder={isRu ? 'хакатон, студенты, ташкент' : 'react, typescript, web'} />
          </div>

          {/* Actions */}
          <div className="admin-form-actions">
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? (isRu ? 'Создаём...' : 'Creating...') : (isRu ? 'Создать мероприятие' : t('admin.createEvent'))}
            </button>
            <Link href={`/${locale}/admin/events`} className="btn btn-secondary">
              {t('common.cancel')}
            </Link>
          </div>
        </form>
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
