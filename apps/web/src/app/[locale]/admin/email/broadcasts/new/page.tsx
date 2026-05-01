'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminApi, adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EmptyState, FieldInput, FieldSelect, FieldTextarea, LoadingLines, MetricCard, Notice, Panel, StatusBadge, TableShell } from '@/components/ui/signal-primitives';

type BroadcastWizardStep = 1 | 2 | 3 | 4 | 5;

type BroadcastFormState = {
  title: string;
  type: 'marketing' | 'event_announcement' | 'event_reminder' | 'system_notification' | 'admin_test' | 'transactional';
  audienceKind: 'mailing_consent' | 'verified_users' | 'active_users' | 'platform_admins';
  audienceSource: 'static_filter' | 'event_participants' | 'event_teams' | 'manual_selection' | 'uploaded_csv' | 'saved_segment' | 'system';
  eventId: string;
  memberRoles: string[];
  memberStatuses: string[];
  teamMembership: 'ANY' | 'WITH_TEAM' | 'WITHOUT_TEAM';
  templateId: string;
  subject: string;
  preheader: string;
  textBody: string;
  htmlBody: string;
  sendMode: 'draft' | 'send_now' | 'scheduled';
  scheduledAt: string;
  timezone: string;
  testEmail: string;
  internalNotes: string;
  selectedUserIds: string[];
  userSearch: string;
  prefillContacts: Array<{ id: string; email?: string; name?: string; phone?: string }>;
};

const emptyForm: BroadcastFormState = {
  title: '',
  type: 'marketing',
  audienceKind: 'mailing_consent',
  audienceSource: 'static_filter',
  eventId: '',
  memberRoles: ['CAPTAIN', 'MEMBER'],
  memberStatuses: ['ACTIVE'],
  teamMembership: 'ANY',
  templateId: '',
  subject: '',
  preheader: '',
  textBody: [
    'Здравствуйте, {{name}}!',
    '',
    'Текст рассылки.',
    '',
    'Отписаться: {{unsubscribeUrl}}',
  ].join('\n'),
  htmlBody: [
    '<p>Здравствуйте, {{name}}!</p>',
    '<p>Текст рассылки.</p>',
    '<p><a href="{{unsubscribeUrl}}">Отписаться</a></p>',
  ].join('\n'),
  sendMode: 'draft',
  scheduledAt: '',
  timezone: 'Asia/Tashkent',
  testEmail: '',
  internalNotes: '',
  selectedUserIds: [],
  userSearch: '',
  prefillContacts: [],
};

function buildAudienceFilterJson(form: BroadcastFormState) {
  const filter: Record<string, unknown> = {};

  if (form.eventId.trim()) {
    filter.eventId = form.eventId.trim();
  }

  if (form.memberRoles.length > 0) {
    filter[form.audienceSource === 'event_teams' ? 'teamRoles' : 'memberRoles'] = form.memberRoles;
  }

  if (form.memberStatuses.length > 0) {
    filter.memberStatuses = form.memberStatuses;
  }

  if (form.teamMembership !== 'ANY') {
    filter.teamMembership = form.teamMembership;
  }
  if (form.audienceSource === 'event_teams') {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const teamId = params?.get('teamId');
    if (teamId) filter.teamId = teamId;
    if (form.memberRoles.length) filter.teamRoles = form.memberRoles;
    filter.teamMemberStatuses = form.memberStatuses;
  }
  if (form.audienceSource === 'manual_selection') {
    filter.selectedUserIds = form.selectedUserIds;
    filter.prefillContacts = form.prefillContacts;
  }

  return filter;
}

function buildCreateBroadcastPayload(form: BroadcastFormState) {
  return {
    title: form.title.trim(),
    type: form.type,
    audienceKind: form.audienceKind,
    audienceSource: form.audienceSource,
    audienceFilterJson: buildAudienceFilterJson(form),
    templateId: form.templateId || undefined,
    subject: form.subject.trim(),
    preheader: form.preheader.trim() || undefined,
    textBody: form.textBody,
    htmlBody: form.htmlBody,
    sendMode: form.sendMode,
    scheduledAt: form.sendMode === 'scheduled' && form.scheduledAt
      ? new Date(form.scheduledAt).toISOString()
      : undefined,
    timezone: form.timezone,
    internalNotes: form.internalNotes.trim() || undefined,
  };
}

const stepLabels = {
  1: { ru: 'Настройки', en: 'Settings' },
  2: { ru: 'Аудитория', en: 'Audience' },
  3: { ru: 'Контент', en: 'Content' },
  4: { ru: 'Предпросмотр', en: 'Preview' },
  5: { ru: 'Отправка', en: 'Delivery' },
};
function formatSkipReason(value: string | null | undefined, locale: string) {
  const map: Record<string, { ru: string; en: string }> = {
    NO_EMAIL: { ru: 'Нет email', en: 'No email' },
    INVALID_EMAIL: { ru: 'Неверный email', en: 'Invalid email' },
    EMAIL_NOT_VERIFIED: { ru: 'Email не подтверждён', en: 'Email not verified' },
    NO_MARKETING_CONSENT: { ru: 'Нет согласия на рассылку', en: 'No marketing consent' },
    USER_DISABLED: { ru: 'Пользователь отключён', en: 'User disabled' },
    PARTICIPANT_NOT_ACTIVE: { ru: 'Участник неактивен', en: 'Participant not active' },
    TEAM_ARCHIVED: { ru: 'Команда в архиве', en: 'Team archived' },
    DUPLICATE_RECIPIENT: { ru: 'Дубликат получателя', en: 'Duplicate recipient' },
    UNSUBSCRIBED: { ru: 'Отписан', en: 'Unsubscribed' },
    SUPPRESSED_EMAIL: { ru: 'Email в suppression-листе', en: 'Suppressed email' },
    MISSING_TEMPLATE_VARIABLE: { ru: 'Отсутствует переменная шаблона', en: 'Missing template variable' },
    UNKNOWN_ERROR: { ru: 'Неизвестная ошибка', en: 'Unknown error' },
  };
  const key = String(value ?? '').trim();
  return (map[key]?.[locale === 'ru' ? 'ru' : 'en']) || key || '—';
}

export default function NewEmailBroadcastPage() {
  const locale = useRouteLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<BroadcastWizardStep>(1);
  const [form, setForm] = useState<BroadcastFormState>(emptyForm);
  const [events, setEvents] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [estimate, setEstimate] = useState<any>(null);
  const [audiencePreview, setAudiencePreview] = useState<any>(null);
  const [emailPreview, setEmailPreview] = useState<any>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [previewRecipientId, setPreviewRecipientId] = useState<string>('');
  const broadcastId = searchParams.get('broadcastId');

  useEffect(() => {
    let alive = true;

    async function loadEvents() {
      try {
        const response = await adminApi.listEvents({ limit: 100 });
        if (alive) setEvents(response.data ?? []);
      } catch {
        if (alive) setEvents([]);
      }
    }

    async function loadTemplates() {
      try {
        const response = await adminEmailApi.listTemplates({ status: 'active', limit: 100 });
        if (alive) setTemplates(response.data ?? []);
      } catch {
        if (alive) setTemplates([]);
      }
    }

    void loadEvents();
    void loadTemplates();

    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const audienceSource = searchParams.get('audienceSource');
    const eventId = searchParams.get('eventId');
    const teamId = searchParams.get('teamId');
    const teamRoles = searchParams.get('teamRoles');
    if (!audienceSource) return;
    setForm(prev => ({
      ...prev,
      audienceSource: audienceSource as any,
      eventId: eventId ?? prev.eventId,
      memberRoles: teamRoles ? teamRoles.split(',') : prev.memberRoles,
    }));
  }, [searchParams]);

  const applyTemplate = useCallback((templateId: string) => {
    if (!templateId) return;
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    setForm(prev => ({
      ...prev,
      templateId,
      subject: template.subject ?? prev.subject,
      preheader: template.preheader ?? prev.preheader,
      textBody: template.textBody ?? prev.textBody,
      htmlBody: template.htmlBody ?? prev.htmlBody,
    }));
  }, [templates]);

  const searchUsers = useCallback(async () => {
    const q = form.userSearch.trim();
    if (!q) return setUserSearchResults([]);
    const res = await adminApi.searchUsers({ q, eventId: form.eventId || undefined, limit: 20 });
    setUserSearchResults(res.users ?? []);
  }, [form.userSearch, form.eventId]);

  const loadEstimate = useCallback(async () => {
    setLoadingEstimate(true);
    setError(null);

    try {
      const filter = buildAudienceFilterJson(form);
      const result = await adminEmailApi.estimateAudience({
        broadcastType: form.type,
        audienceKind: form.audienceKind,
        audienceSource: form.audienceSource,
        audienceFilterJson: filter,
      });
      setEstimate(result);
    } catch {
      setEstimate(null);
      setError(locale === 'ru' ? 'Не удалось рассчитать аудиторию.' : 'Failed to estimate audience.');
    } finally {
      setLoadingEstimate(false);
    }
  }, [form, locale]);

  const loadAudiencePreview = useCallback(async () => {
    setLoadingPreview(true);

    try {
      const filter = { ...buildAudienceFilterJson(form), ...(searchParams.get('teamId') ? { teamId: searchParams.get('teamId') } : {}) };
      const result = await adminEmailApi.previewAudience({
        broadcastType: form.type,
        audienceKind: form.audienceKind,
        audienceSource: form.audienceSource,
        audienceFilterJson: filter,
      }, { limit: 10 });
      setAudiencePreview(result);
    } catch {
      setAudiencePreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [form, searchParams]);

  useEffect(() => {
    if (form.audienceSource === 'event_teams' && form.eventId) {
      void loadAudiencePreview();
    }
  }, [form.audienceSource, form.eventId, loadAudiencePreview]);

  const loadEmailPreview = useCallback(async () => {
    try {
      const payload = {
        subject: form.subject,
        preheader: form.preheader,
        textBody: form.textBody,
        htmlBody: form.htmlBody,
        sampleVariables: {
          name: 'Иван Петров',
          email: form.testEmail || 'admin@example.com',
          unsubscribeUrl: `${window.location.origin}/${locale}/unsubscribe?token=preview`,
        },
      } as any;
      const result = broadcastId
        ? await adminEmailApi.previewBroadcastEmail(broadcastId, { ...payload, recipientId: previewRecipientId || undefined })
        : await adminEmailApi.previewEmail(payload);
      setEmailPreview(result);
    } catch {
      setEmailPreview(null);
    }
  }, [form, locale, broadcastId, previewRecipientId]);

  const testSend = useCallback(async () => {
    if (!form.testEmail.trim()) {
      setError(locale === 'ru' ? 'Укажите email для теста.' : 'Enter test email address.');
      return;
    }

    setError(null);
    setNotice(null);

    try {
      if (broadcastId) {
        await adminEmailApi.sendBroadcastTestEmail(broadcastId, { email: form.testEmail, recipientId: previewRecipientId || undefined });
      } else {
        await adminEmailApi.testSendEmail({
        toEmail: form.testEmail,
        subject: form.subject || 'Test',
        preheader: form.preheader,
        textBody: form.textBody || 'Test',
        htmlBody: form.htmlBody,
        });
      }
      setNotice(locale === 'ru' ? `Тест отправлен на ${form.testEmail}` : `Test sent to ${form.testEmail}`);
    } catch {
      setError(locale === 'ru' ? 'Не удалось отправить тест.' : 'Failed to send test email.');
    }
  }, [form, locale, broadcastId, previewRecipientId]);

  const validateStep = useCallback((): boolean => {
    setError(null);

    if (step === 1) {
      if (!form.title.trim()) {
        setError(locale === 'ru' ? 'Укажите название рассылки.' : 'Enter broadcast title.');
        return false;
      }
    }

    if (step === 2) {
      if (['event_participants', 'event_teams'].includes(form.audienceSource) && !form.eventId) {
        setError(locale === 'ru' ? 'Выберите событие для аудитории.' : 'Select an event for event-scoped audience.');
        return false;
      }
    }

    if (step === 3) {
      if (!form.subject.trim()) {
        setError(locale === 'ru' ? 'Укажите тему письма.' : 'Enter email subject.');
        return false;
      }
      if (!form.textBody.trim() && !form.htmlBody.trim()) {
        setError(locale === 'ru' ? 'Заполните текст или HTML письма.' : 'Fill text or HTML body.');
        return false;
      }
    }

    if (step === 4) {
      void loadEmailPreview();
    }

    if (step === 5) {
      if (form.sendMode === 'scheduled' && !form.scheduledAt) {
        setError(locale === 'ru' ? 'Укажите дату и время отправки.' : 'Enter scheduled date and time.');
        return false;
      }
      if (form.sendMode === 'scheduled' && new Date(form.scheduledAt) <= new Date()) {
        setError(locale === 'ru' ? 'Дата должна быть в будущем.' : 'Scheduled date must be in the future.');
        return false;
      }
    }

    return true;
  }, [step, form, locale, loadEmailPreview]);

  const nextStep = useCallback(() => {
    if (!validateStep()) return;
    if (step < 5) setStep((step + 1) as BroadcastWizardStep);
  }, [step, validateStep]);

  const prevStep = useCallback(() => {
    if (step > 1) setStep((step - 1) as BroadcastWizardStep);
  }, [step]);

  const handleSave = useCallback(async () => {
    if (!validateStep()) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload = buildCreateBroadcastPayload(form);
      const response = await adminEmailApi.createBroadcast(payload);
      router.push(`/${locale}/admin/email/broadcasts/${response.data.id}`);
    } catch (e) {
      setError(locale === 'ru' ? 'Не удалось сохранить рассылку.' : 'Failed to save broadcast.');
    } finally {
      setSaving(false);
    }
  }, [form, locale, validateStep, router]);

  const updateForm = useCallback((updates: Partial<BroadcastFormState>) => {
    setForm(prev => ({ ...prev, ...updates }));
  }, []);

  const audienceFilterJson = useMemo(() => buildAudienceFilterJson(form), [form]);

  const skippedByReason = useMemo(() => {
    if (!estimate?.skippedByReason) return null;
    return Object.entries(estimate.skippedByReason) as [string, number][];
  }, [estimate]);

  const isEventScoped = ['event_participants', 'event_teams'].includes(form.audienceSource);

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={locale === 'ru' ? 'Новая рассылка' : 'New broadcast'}
        subtitle={stepLabels[step][locale === 'ru' ? 'ru' : 'en']}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <div className="admin-wizard-steps">
        {([1, 2, 3, 4, 5] as BroadcastWizardStep[]).map(s => (
          <button
            key={s}
            className={`admin-wizard-step ${step === s ? 'active' : ''} ${step > s ? 'completed' : ''}`}
            onClick={() => s < step && setStep(s)}
            disabled={s > step}
          >
            <span className="admin-wizard-step-num">{s}</span>
            <span className="admin-wizard-step-label">{stepLabels[s][locale === 'ru' ? 'ru' : 'en']}</span>
          </button>
        ))}
      </div>

      {step === 1 && (
        <Panel variant="elevated" className="admin-command-panel">
          <h2>{locale === 'ru' ? 'Основные настройки' : 'Basic settings'}</h2>

          <div className="admin-email-form-grid">
            <label>
              <span>{locale === 'ru' ? 'Название рассылки' : 'Broadcast title'} *</span>
              <FieldInput
                value={form.title}
                onChange={(e) => updateForm({ title: e.target.value })}
                placeholder={locale === 'ru' ? 'Например: Рассылка мая 2026' : 'e.g. May 2026 Newsletter'}
              />
            </label>

            <label>
              <span>{locale === 'ru' ? 'Тип рассылки' : 'Broadcast type'}</span>
              <FieldSelect value={form.type} onChange={(e) => updateForm({ type: e.target.value as BroadcastFormState['type'] })}>
                <option value="marketing">{locale === 'ru' ? 'Маркетинговая' : 'Marketing'}</option>
                <option value="event_announcement">{locale === 'ru' ? 'Анонс события' : 'Event announcement'}</option>
                <option value="event_reminder">{locale === 'ru' ? 'Напоминание о событии' : 'Event reminder'}</option>
                <option value="system_notification">{locale === 'ru' ? 'Системное уведомление' : 'System notification'}</option>
                <option value="admin_test">{locale === 'ru' ? 'Тест администратора' : 'Admin test'}</option>
                <option value="transactional">{locale === 'ru' ? 'Транзакционное' : 'Transactional'}</option>
              </FieldSelect>
            </label>

            <label>
              <span>{locale === 'ru' ? 'Шаблон' : 'Template'}</span>
              <FieldSelect value={form.templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">{locale === 'ru' ? 'Без шаблона' : 'No template'}</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </FieldSelect>
            </label>
          </div>

          <div className="signal-row-actions">
            <button className="btn btn-primary btn-sm" onClick={() => void nextStep()}>
              {locale === 'ru' ? 'Далее' : 'Next'} →
            </button>
          </div>
        </Panel>
      )}

      {step === 2 && (
        <Panel variant="elevated" className="admin-command-panel">
          <h2>{locale === 'ru' ? 'Аудитория' : 'Audience'}</h2>

          <div className="admin-email-form-grid">
            <label>
              <span>{locale === 'ru' ? 'Источник аудитории' : 'Audience source'}</span>
              <FieldSelect
                value={form.audienceSource}
                onChange={(e) => updateForm({ audienceSource: e.target.value as BroadcastFormState['audienceSource'], eventId: '' })}
              >
                <option value="static_filter">{locale === 'ru' ? 'Статический фильтр' : 'Static filter'}</option>
                <option value="event_participants">{locale === 'ru' ? 'Участники события' : 'Event participants'}</option>
                <option value="event_teams">{locale === 'ru' ? 'Команды события' : 'Event teams'}</option>
                <option value="manual_selection">{locale === 'ru' ? 'Конкретные пользователи' : 'Specific users'}</option>
              </FieldSelect>
            </label>
            {form.audienceSource === 'manual_selection' && (
              <>
                <label className="admin-email-form-wide">
                  <span>{locale === 'ru' ? 'Поиск пользователей' : 'User search'}</span>
                  <FieldInput value={form.userSearch} onChange={(e) => updateForm({ userSearch: e.target.value })} placeholder={locale === 'ru' ? 'Имя / email / phone / ID / team code' : 'Name / email / phone / ID / team code'} />
                </label>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => void searchUsers()}>{locale === 'ru' ? 'Найти' : 'Search'}</button>
              </>
            )}

            <label>
              <span>{locale === 'ru' ? 'Тип аудитории' : 'Audience kind'}</span>
              <FieldSelect
                value={form.audienceKind}
                onChange={(e) => updateForm({ audienceKind: e.target.value as BroadcastFormState['audienceKind'] })}
              >
                <option value="mailing_consent">{locale === 'ru' ? 'С согласием на рассылки' : 'Mailing consent'}</option>
                <option value="verified_users">{locale === 'ru' ? 'Подтверждённые пользователи' : 'Verified users'}</option>
                <option value="active_users">{locale === 'ru' ? 'Активные пользователи' : 'Active users'}</option>
                <option value="platform_admins">{locale === 'ru' ? 'Администраторы платформы' : 'Platform admins'}</option>
              </FieldSelect>
            </label>

            {isEventScoped && (
              <label>
                <span>{locale === 'ru' ? 'Событие' : 'Event'} *</span>
                <FieldSelect
                  value={form.eventId}
                  onChange={(e) => updateForm({ eventId: e.target.value })}
                >
                  <option value="">{locale === 'ru' ? 'Выберите событие' : 'Select event'}</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                  ))}
                </FieldSelect>
              </label>
            )}

            {isEventScoped && (
              <>
                <label>
                  <span>{locale === 'ru' ? 'Роли участников' : 'Member roles'}</span>
                  <FieldSelect
                    value={form.memberRoles[0] ?? (form.audienceSource === 'event_teams' ? 'CAPTAIN' : 'PARTICIPANT')}
                    onChange={(e) => updateForm({ memberRoles: [e.target.value] })}
                  >
                    {form.audienceSource === 'event_teams' ? (
                      <>
                        <option value="CAPTAIN">{locale === 'ru' ? 'Капитан' : 'Captain'}</option>
                        <option value="MEMBER">{locale === 'ru' ? 'Участник команды' : 'Team member'}</option>
                      </>
                    ) : (
                      <>
                        <option value="PARTICIPANT">{locale === 'ru' ? 'Участник' : 'Participant'}</option>
                        <option value="ORGANIZER">{locale === 'ru' ? 'Организатор' : 'Organizer'}</option>
                        <option value="VOLUNTEER">{locale === 'ru' ? 'Волонтёр' : 'Volunteer'}</option>
                      </>
                    )}
                  </FieldSelect>
                </label>

                <label>
                  <span>{locale === 'ru' ? 'Статус участников' : 'Member status'}</span>
                  <FieldSelect
                    value={form.memberStatuses[0] ?? 'ACTIVE'}
                    onChange={(e) => updateForm({ memberStatuses: [e.target.value] })}
                  >
                    <option value="ACTIVE">{locale === 'ru' ? 'Активные' : 'Active'}</option>
                    <option value="RESERVE">{locale === 'ru' ? 'В резерве' : 'Reserve'}</option>
                    <option value="PENDING">{locale === 'ru' ? 'Ожидающие' : 'Pending'}</option>
                  </FieldSelect>
                </label>

                <label>
                  <span>{locale === 'ru' ? 'Командный фильтр' : 'Team filter'}</span>
                  <FieldSelect
                    value={form.teamMembership}
                    onChange={(e) => updateForm({ teamMembership: e.target.value as BroadcastFormState['teamMembership'] })}
                  >
                    <option value="ANY">{locale === 'ru' ? 'Любые' : 'Any'}</option>
                    <option value="WITH_TEAM">{locale === 'ru' ? 'В команде' : 'In team'}</option>
                    <option value="WITHOUT_TEAM">{locale === 'ru' ? 'Без команды' : 'Without team'}</option>
                  </FieldSelect>
                </label>
              </>
            )}
          </div>
          {form.audienceSource === 'manual_selection' && userSearchResults.length > 0 && (
            <TableShell>
              <table className="signal-table">
                <thead><tr><th>Photo</th><th>{locale === 'ru' ? 'ФИО' : 'Full name'}</th><th>Email</th><th>{locale === 'ru' ? 'Телефон' : 'Phone'}</th><th>Team</th><th>{locale === 'ru' ? 'Статус' : 'Status'}</th><th>✓</th></tr></thead>
                <tbody>{userSearchResults.map((u:any) => <tr key={u.id}><td>{u.avatarUrl ? <span aria-hidden="true" style={{display:'inline-block',width:24,height:24,borderRadius:999,backgroundImage:`url(${u.avatarUrl})`,backgroundSize:'cover',backgroundPosition:'center'}}/>:'—'}</td><td>{u.name}</td><td>{u.email}</td><td>{u.phone||'—'}</td><td>{u.eventMembership?.teamCode || '—'}</td><td>{u.eventMembership?.status || (u.isActive ? 'ACTIVE':'INACTIVE')}</td><td><input type="checkbox" checked={form.selectedUserIds.includes(u.id)} onChange={(e)=>updateForm({selectedUserIds: e.target.checked ? [...form.selectedUserIds,u.id] : form.selectedUserIds.filter(x=>x!==u.id)})}/></td></tr>)}</tbody>
              </table>
            </TableShell>
          )}

          <div className="signal-row-actions" style={{ marginTop: '1.5rem' }}>
            <button className="btn btn-secondary btn-sm" disabled={loadingEstimate} onClick={() => void loadEstimate()}>
              {loadingEstimate ? '...' : locale === 'ru' ? 'Рассчитать аудиторию' : 'Estimate audience'}
            </button>
          </div>

          {estimate && (
            <div style={{ marginTop: '1rem' }}>
              <div className="signal-kpi-grid">
                <MetricCard label={locale === 'ru' ? 'Найдено' : 'Matched'} value={estimate.totalMatched} tone="info" />
                <MetricCard label={locale === 'ru' ? 'Можно отправить' : 'Eligible'} value={estimate.totalEligible} tone="success" />
                <MetricCard label={locale === 'ru' ? 'Пропущено' : 'Skipped'} value={estimate.totalSkipped} tone="warning" />
              </div>

              {skippedByReason && skippedByReason.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>{locale === 'ru' ? 'Причины пропуска' : 'Skip reasons'}</h3>
                  <div className="signal-muted" style={{ fontSize: '0.8125rem' }}>
                    {skippedByReason.map(([reason, count]) => (
                      <div key={reason}>• {reason}: {count}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="signal-row-actions" style={{ marginTop: '1.5rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => void prevStep()}>
              ← {locale === 'ru' ? 'Назад' : 'Back'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => void nextStep()}>
              {locale === 'ru' ? 'Далее' : 'Next'} →
            </button>
          </div>
        </Panel>
      )}

      {step === 3 && (
        <Panel variant="elevated" className="admin-command-panel">
          <h2>{locale === 'ru' ? 'Контент письма' : 'Email content'}</h2>

          <div className="admin-email-form-grid">
            <label className="admin-email-form-wide">
              <span>{locale === 'ru' ? 'Тема письма' : 'Subject'} *</span>
              <FieldInput
                value={form.subject}
                onChange={(e) => updateForm({ subject: e.target.value })}
                placeholder={locale === 'ru' ? 'Например: Обновления платформы RDEvents' : 'e.g. RDEvents Platform Updates'}
              />
            </label>

            <label className="admin-email-form-wide">
              <span>Preheader</span>
              <FieldInput
                value={form.preheader}
                onChange={(e) => updateForm({ preheader: e.target.value })}
                placeholder={locale === 'ru' ? 'Краткое описание под темой' : 'Brief description under subject'}
              />
            </label>

            <label className="admin-email-form-wide">
              <span>{locale === 'ru' ? 'Текстовая версия' : 'Text version'}</span>
              <FieldTextarea
                rows={10}
                value={form.textBody}
                onChange={(e) => updateForm({ textBody: e.target.value })}
              />
            </label>

            <label className="admin-email-form-wide">
              <span>HTML версия</span>
              <FieldTextarea
                rows={10}
                value={form.htmlBody}
                onChange={(e) => updateForm({ htmlBody: e.target.value })}
                placeholder="<p>HTML content...</p>"
              />
            </label>
          </div>

          <div className="signal-row-actions" style={{ marginTop: '1rem' }}>
            <span className="signal-muted" style={{ fontSize: '0.8125rem' }}>
              {locale === 'ru' ? 'Доступные переменные' : 'Available variables'}: {'{{name}}'}, {'{{firstName}}'}, {'{{lastName}}'}, {'{{email}}'}, {'{{unsubscribeUrl}}'}
            </span>
          </div>

          <div className="signal-row-actions" style={{ marginTop: '1.5rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => void prevStep()}>
              ← {locale === 'ru' ? 'Назад' : 'Back'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => void nextStep()}>
              {locale === 'ru' ? 'Далее' : 'Next'} →
            </button>
          </div>
        </Panel>
      )}

      {step === 4 && (
        <>
          <Panel variant="elevated" className="admin-command-panel">
            <h2>{locale === 'ru' ? 'Предпросмотр и тестирование' : 'Preview and testing'}</h2>
            <div className="signal-kpi-grid" style={{ marginBottom: 12 }}>
              <MetricCard label={locale === 'ru' ? 'Выбрано' : 'Selected'} value={audiencePreview?.totals?.totalMatched ?? estimate?.totalMatched ?? 0} tone="info" />
              <MetricCard label={locale === 'ru' ? 'Будет отправлено' : 'Will send'} value={audiencePreview?.totals?.totalEligible ?? estimate?.totalEligible ?? 0} tone="success" />
              <MetricCard label={locale === 'ru' ? 'Пропущено' : 'Skipped'} value={audiencePreview?.totals?.totalSkipped ?? estimate?.totalSkipped ?? 0} tone="warning" />
            </div>

            <div className="admin-email-form-grid">
              <label className="admin-email-form-wide">
                <span>{locale === 'ru' ? 'Предпросмотр как получатель' : 'Preview as recipient'}</span>
                <FieldSelect value={previewRecipientId} onChange={(e) => setPreviewRecipientId(e.target.value)}>
                  <option value="">{locale === 'ru' ? 'Примерные переменные' : 'Sample variables'}</option>
                  {(audiencePreview?.data ?? []).map((r: any) => (
                    <option key={r.recipientId ?? r.userId} value={r.recipientId ?? r.userId}>{r.name || r.email || r.recipientId || r.userId}</option>
                  ))}
                </FieldSelect>
              </label>
              <label className="admin-email-form-wide">
                <span>{locale === 'ru' ? 'Email для теста' : 'Test email'}</span>
                <FieldInput
                  type="email"
                  value={form.testEmail}
                  onChange={(e) => updateForm({ testEmail: e.target.value })}
                  placeholder="admin@example.com"
                />
              </label>
            </div>

            <div className="signal-row-actions" style={{ marginTop: '1rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => void testSend()}>
                {locale === 'ru' ? 'Отправить тест' : 'Send test'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => void loadEmailPreview()}>
                {locale === 'ru' ? 'Обновить предпросмотр' : 'Refresh preview'}
              </button>
            </div>
          </Panel>
          {audiencePreview?.data?.length ? (
            <Panel variant="subtle" className="admin-command-panel" style={{ marginTop: '1rem' }}>
              <TableShell>
                <table className="signal-table">
                  <thead><tr><th>Photo</th><th>{locale === 'ru' ? 'Имя' : 'Full name'}</th><th>Email</th><th>{locale === 'ru' ? 'Телефон' : 'Phone'}</th><th>{locale === 'ru' ? 'Роль' : 'Role'}</th><th>{locale === 'ru' ? 'Статус' : 'Status'}</th><th>{locale === 'ru' ? 'Причина' : 'Reason'}</th></tr></thead>
                  <tbody>{audiencePreview.data.map((r: any, idx: number) => <tr key={r.recipientId ?? idx}><td>{r.avatarUrl ? <span aria-hidden="true" style={{display:'inline-block',width:24,height:24,borderRadius:999,backgroundImage:`url(${r.avatarUrl})`,backgroundSize:'cover',backgroundPosition:'center'}}/> : '—'}</td><td>{r.name || r.fullName || '—'}</td><td>{r.email || '—'}</td><td>{r.phone || '—'}</td><td>{r.role || '—'}</td><td>{r.deliveryStatus || r.status}</td><td>{formatSkipReason(r.skipReasonCode || r.skipReason, locale)}</td></tr>)}</tbody>
                </table>
              </TableShell>
            </Panel>
          ) : null}

          {emailPreview && (
            <>
              {emailPreview.warnings && emailPreview.warnings.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <Notice tone="warning">
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                      {locale === 'ru' ? 'Предупреждения' : 'Warnings'}:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                      {emailPreview.warnings.map((warning: string, idx: number) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </Notice>
                </div>
              )}
              <Panel variant="subtle" className="admin-command-panel" style={{ marginTop: '1rem' }}>
                <h3>{locale === 'ru' ? 'Предпросмотр письма' : 'Email preview'}</h3>
                <div style={{ border: '1px solid var(--signal-border)', borderRadius: '8px', padding: '1rem', background: '#fff' }}>
                  <p style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.25rem' }}>{emailPreview.subjectPreview}</p>
                  {emailPreview.preheaderPreview && (
                    <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1rem' }}>{emailPreview.preheaderPreview}</p>
                  )}
                  <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid #eee' }} />
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9375rem' }}>{emailPreview.textPreview}</div>
                  {emailPreview.htmlPreview && (
                    <>
                      <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid #eee' }} />
                      <div dangerouslySetInnerHTML={{ __html: emailPreview.htmlPreview }} />
                    </>
                  )}
                </div>
              </Panel>
            </>
          )}

          {!emailPreview && (
            <EmptyState
              title={locale === 'ru' ? 'Предпросмотр' : 'Preview'}
              description={locale === 'ru' ? 'Нажмите "Обновить предпросмотр" для просмотра письма.' : 'Click "Refresh preview" to see email preview.'}
            />
          )}

          <div className="signal-row-actions" style={{ marginTop: '1.5rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => void prevStep()}>
              ← {locale === 'ru' ? 'Назад' : 'Back'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => void nextStep()}>
              {locale === 'ru' ? 'Далее' : 'Next'} →
            </button>
          </div>
        </>
      )}

      {step === 5 && (
        <Panel variant="elevated" className="admin-command-panel">
          <h2>{locale === 'ru' ? 'Сохранение и отправка' : 'Save and delivery'}</h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9375rem', marginBottom: '0.5rem' }}>{locale === 'ru' ? 'Сводка' : 'Summary'}</h3>
            <div className="signal-muted" style={{ fontSize: '0.875rem' }}>
              <div><strong>{locale === 'ru' ? 'Название' : 'Title'}:</strong> {form.title}</div>
              <div><strong>{locale === 'ru' ? 'Тип' : 'Type'}:</strong> {form.type}</div>
              <div><strong>{locale === 'ru' ? 'Аудитория' : 'Audience'}:</strong> {form.audienceKind}</div>
              <div><strong>{locale === 'ru' ? 'Источник' : 'Source'}:</strong> {form.audienceSource}</div>
              <div><strong>{locale === 'ru' ? 'Тема' : 'Subject'}:</strong> {form.subject}</div>
              {estimate && (
                <div style={{ marginTop: '0.5rem' }}>
                  <strong>{locale === 'ru' ? 'Получателей' : 'Recipients'}:</strong>{' '}
                  {estimate.totalEligible} {locale === 'ru' ? 'из' : 'of'} {estimate.totalMatched}
                </div>
              )}
            </div>
          </div>

          <div className="admin-email-form-grid">
            <label>
              <span>{locale === 'ru' ? 'Режим отправки' : 'Send mode'}</span>
              <FieldSelect
                value={form.sendMode}
                onChange={(e) => updateForm({ sendMode: e.target.value as BroadcastFormState['sendMode'] })}
              >
                <option value="draft">{locale === 'ru' ? 'Сохранить как черновик' : 'Save as draft'}</option>
                <option value="send_now">{locale === 'ru' ? 'Отправить сразу' : 'Send now'}</option>
                <option value="scheduled">{locale === 'ru' ? 'Запланировать' : 'Schedule'}</option>
              </FieldSelect>
            </label>

            {form.sendMode === 'scheduled' && (
              <label>
                <span>{locale === 'ru' ? 'Дата и время' : 'Date and time'}</span>
                <FieldInput
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => updateForm({ scheduledAt: e.target.value })}
                />
              </label>
            )}

            <label>
              <span>{locale === 'ru' ? 'Часовой пояс' : 'Timezone'}</span>
              <FieldSelect
                value={form.timezone}
                onChange={(e) => updateForm({ timezone: e.target.value })}
              >
                <option value="Asia/Tashkent">Asia/Tashkent (UTC+5)</option>
                <option value="Europe/Moscow">Europe/Moscow (UTC+3)</option>
                <option value="UTC">UTC</option>
              </FieldSelect>
            </label>

            <label className="admin-email-form-wide">
              <span>{locale === 'ru' ? 'Внутренние заметки' : 'Internal notes'}</span>
              <FieldTextarea
                rows={3}
                value={form.internalNotes}
                onChange={(e) => updateForm({ internalNotes: e.target.value })}
                placeholder={locale === 'ru' ? 'Заметки видны только администраторам' : 'Notes visible only to admins'}
              />
            </label>
          </div>

          <div className="signal-row-actions" style={{ marginTop: '1.5rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => void prevStep()}>
              ← {locale === 'ru' ? 'Назад' : 'Back'}
            </button>
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => void handleSave()}>
              {saving ? '...' : form.sendMode === 'draft'
                ? (locale === 'ru' ? 'Сохранить черновик' : 'Save draft')
                : form.sendMode === 'send_now'
                  ? (locale === 'ru' ? 'Отправить сейчас' : 'Send now')
                  : (locale === 'ru' ? 'Запланировать' : 'Schedule')}
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}
