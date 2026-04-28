'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, adminApi, adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCell,
  AdminDataTableHeader,
  AdminDataTableRow,
  AdminTableCellMain,
} from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';
import {
  EmptyState,
  FieldInput,
  FieldSelect,
  FieldTextarea,
  LoadingLines,
  MetricCard,
  Notice,
  Panel,
  StatusBadge,
} from '@/components/ui/signal-primitives';

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
  manualRecipientsInput: string;
};

type ManualSelectionSummary = {
  emails: string[];
  userIds: string[];
  invalid: string[];
};

type AudiencePreviewRow = {
  userId?: string;
  email?: string;
  name?: string;
  eligible?: boolean;
  status?: string;
  skipReason?: string;
  variables?: Record<string, string>;
  audienceReason?: {
    matchedBy?: string;
    via?: string;
    value?: string;
    eventId?: string | null;
    resolved?: string;
  } | null;
};

type AudienceEstimate = {
  totalMatched: number;
  totalEligible: number;
  totalSkipped: number;
  skippedByReason?: Record<string, number>;
};

type AudiencePreviewResponse = {
  data: AudiencePreviewRow[];
  meta?: { total?: number; page?: number; limit?: number; pages?: number };
  totals?: AudienceEstimate;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const USER_ID_REGEX = /^[a-zA-Z0-9_-]{6,}$/;

const stepLabels = {
  1: { ru: 'Настройки', en: 'Settings' },
  2: { ru: 'Аудитория', en: 'Audience' },
  3: { ru: 'Контент', en: 'Content' },
  4: { ru: 'Предпросмотр', en: 'Preview' },
  5: { ru: 'Отправка', en: 'Delivery' },
} as const;

const audienceSourceLabels = {
  static_filter: { ru: 'Статический фильтр', en: 'Static filter' },
  event_participants: { ru: 'Участники события', en: 'Event participants' },
  event_teams: { ru: 'Команды события', en: 'Event teams' },
  manual_selection: { ru: 'Ручной выбор', en: 'Manual selection' },
  uploaded_csv: { ru: 'CSV', en: 'CSV' },
  saved_segment: { ru: 'Сегмент', en: 'Saved segment' },
  system: { ru: 'Системный', en: 'System' },
} as const;

const audienceKindLabels = {
  mailing_consent: { ru: 'С согласием на рассылки', en: 'Mailing consent' },
  verified_users: { ru: 'Подтверждённые пользователи', en: 'Verified users' },
  active_users: { ru: 'Активные пользователи', en: 'Active users' },
  platform_admins: { ru: 'Администраторы платформы', en: 'Platform admins' },
} as const;

const broadcastTypeLabels = {
  marketing: { ru: 'Маркетинговая', en: 'Marketing' },
  event_announcement: { ru: 'Анонс события', en: 'Event announcement' },
  event_reminder: { ru: 'Напоминание о событии', en: 'Event reminder' },
  system_notification: { ru: 'Системное уведомление', en: 'System notification' },
  admin_test: { ru: 'Операционная / тестовая', en: 'Operational / admin test' },
  transactional: { ru: 'Транзакционная', en: 'Transactional' },
} as const;

const emptyForm: BroadcastFormState = {
  title: '',
  type: 'marketing',
  audienceKind: 'mailing_consent',
  audienceSource: 'static_filter',
  eventId: '',
  memberRoles: ['PARTICIPANT'],
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
  manualRecipientsInput: '',
};

function extractRecipientToken(value: string) {
  const trimmed = value.trim().replace(/^mailto:/i, '');
  const angleMatch = trimmed.match(/<([^>]+)>/);
  return (angleMatch?.[1] ?? trimmed).trim();
}

function parseManualRecipientsInput(raw: string): ManualSelectionSummary {
  const tokens = raw
    .split(/[\n,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const emails: string[] = [];
  const userIds: string[] = [];
  const invalid: string[] = [];
  const seenEmails = new Set<string>();
  const seenUserIds = new Set<string>();

  for (const token of tokens) {
    const candidate = extractRecipientToken(token);
    const maybeUserId = candidate.replace(/^(?:user|id):/i, '').trim();

    if (EMAIL_REGEX.test(candidate)) {
      const key = candidate.toLowerCase();
      if (!seenEmails.has(key)) {
        seenEmails.add(key);
        emails.push(candidate);
      }
      continue;
    }

    if (USER_ID_REGEX.test(maybeUserId)) {
      if (!seenUserIds.has(maybeUserId)) {
        seenUserIds.add(maybeUserId);
        userIds.push(maybeUserId);
      }
      continue;
    }

    invalid.push(token);
  }

  return { emails, userIds, invalid };
}

function buildAudienceFilterJson(form: BroadcastFormState) {
  if (form.audienceSource === 'manual_selection') {
    const manual = parseManualRecipientsInput(form.manualRecipientsInput);
    const filter: Record<string, unknown> = {};

    if (form.eventId.trim()) {
      filter.eventId = form.eventId.trim();
    }
    if (manual.emails.length > 0) {
      filter.emails = manual.emails;
    }
    if (manual.userIds.length > 0) {
      filter.userIds = manual.userIds;
    }

    return filter;
  }

  const filter: Record<string, unknown> = {};

  if (form.eventId.trim()) {
    filter.eventId = form.eventId.trim();
  }

  if (form.memberRoles.length > 0) {
    filter.memberRoles = form.memberRoles;
  }

  if (form.memberStatuses.length > 0) {
    filter.memberStatuses = form.memberStatuses;
  }

  if (form.teamMembership !== 'ANY') {
    filter.teamMembership = form.teamMembership;
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

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'QUEUED') return 'success';
  if (status.startsWith('SKIPPED')) return 'warning';
  if (status === 'FAILED' || status === 'BOUNCED' || status === 'COMPLAINED') return 'danger';
  return 'neutral';
}

function formatPreviewStatus(status: string, locale: string) {
  const labelRu: Record<string, string> = {
    QUEUED: 'Готов к отправке',
    SKIPPED_NO_CONSENT: 'Нет согласия',
    SKIPPED_NO_EMAIL: 'Нет email',
    SKIPPED_EMAIL_NOT_VERIFIED: 'Email не подтверждён',
    SKIPPED_UNSUBSCRIBED: 'Отписан',
    SKIPPED_BLOCKED: 'Пользователь выключен',
    SKIPPED_DUPLICATE_EMAIL: 'Дубликат email',
    SKIPPED_SUPPRESSED: 'В suppression list',
    SKIPPED_INVALID_EMAIL: 'Некорректный email',
    FAILED: 'Ошибка',
    BOUNCED: 'Bounce',
    COMPLAINED: 'Жалоба',
  };

  return locale === 'ru'
    ? (labelRu[status] ?? status.replace(/_/g, ' '))
    : status.replace(/_/g, ' ');
}

function formatAudienceReason(item: AudiencePreviewRow, locale: string) {
  const reason = item.audienceReason;
  if (!reason) return locale === 'ru' ? 'Авто' : 'Automatic';
  if (reason.matchedBy === 'manualSelection') {
    if (reason.via === 'userId') {
      return locale === 'ru' ? `По user id: ${reason.value}` : `Matched by user id: ${reason.value}`;
    }
    if (reason.resolved === 'rawEmail') {
      return locale === 'ru' ? 'Прямой email из списка' : 'Direct email from list';
    }
    return locale === 'ru' ? `По email: ${reason.value}` : `Matched by email: ${reason.value}`;
  }
  if (reason.matchedBy === 'eventMember') {
    return locale === 'ru' ? 'Участник события' : 'Event participant';
  }
  if (reason.matchedBy === 'eventTeamMember') {
    return locale === 'ru' ? 'Участник команды' : 'Team member';
  }
  return locale === 'ru' ? 'Авто' : 'Automatic';
}

function getAdminEmailErrorMessage(error: unknown, locale: string) {
  if (error instanceof ApiError) {
    if (error.code === 'EVENT_SCOPED_AUDIENCE_REQUIRED') {
      return locale === 'ru'
        ? 'Для event-admin нужен event scope. Выберите событие или используйте платформенную роль.'
        : 'Event admins must choose an event-scoped audience.';
    }
    if (error.code === 'EMAIL_TEST_SEND_RATE_LIMITED') {
      return locale === 'ru'
        ? 'Лимит тестовых отправок временно исчерпан. Попробуйте позже.'
        : 'Test send rate limit reached. Try again later.';
    }
    if (error.message) {
      return error.message;
    }
  }

  return locale === 'ru'
    ? 'Не удалось выполнить действие.'
    : 'Failed to complete the action.';
}

export default function NewEmailBroadcastPage() {
  const locale = useRouteLocale();
  const router = useRouter();
  const [step, setStep] = useState<BroadcastWizardStep>(1);
  const [form, setForm] = useState<BroadcastFormState>(emptyForm);
  const [events, setEvents] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [estimate, setEstimate] = useState<AudienceEstimate | null>(null);
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreviewResponse | null>(null);
  const [emailPreview, setEmailPreview] = useState<any>(null);
  const [loadingAudienceInsights, setLoadingAudienceInsights] = useState(false);
  const [loadingEmailPreview, setLoadingEmailPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isRu = locale === 'ru';
  const manualSelection = useMemo(() => parseManualRecipientsInput(form.manualRecipientsInput), [form.manualRecipientsInput]);
  const audienceFilterJson = useMemo(() => buildAudienceFilterJson(form), [form]);
  const skippedByReason = useMemo(
    () => Object.entries(estimate?.skippedByReason ?? {}),
    [estimate],
  );
  const isEventScoped = ['event_participants', 'event_teams'].includes(form.audienceSource);
  const isManualSelection = form.audienceSource === 'manual_selection';
  const previewRows = useMemo(() => audiencePreview?.data ?? [], [audiencePreview]);
  const previewSampleRecipient = useMemo(
    () => previewRows.find((item) => item.eligible) ?? previewRows[0] ?? null,
    [previewRows],
  );

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

    return () => {
      alive = false;
    };
  }, []);

  const updateForm = useCallback((updates: Partial<BroadcastFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  const applyTemplate = useCallback((templateId: string) => {
    if (!templateId) {
      updateForm({ templateId: '' });
      return;
    }

    const template = templates.find((item) => item.id === templateId);
    if (!template) return;

    setForm((prev) => ({
      ...prev,
      templateId,
      subject: template.subject ?? prev.subject,
      preheader: template.preheader ?? prev.preheader,
      textBody: template.textBody ?? prev.textBody,
      htmlBody: template.htmlBody ?? prev.htmlBody,
    }));
  }, [templates, updateForm]);

  const validateAudienceStep = useCallback(() => {
    if (isEventScoped && !form.eventId) {
      setError(isRu ? 'Выберите событие для аудитории.' : 'Select an event for event-scoped audience.');
      return false;
    }

    if (isManualSelection && manualSelection.emails.length === 0 && manualSelection.userIds.length === 0) {
      setError(
        isRu
          ? 'Добавьте хотя бы один email или user id для ручной выборки.'
          : 'Add at least one email or user id for manual selection.',
      );
      return false;
    }

    return true;
  }, [form.eventId, isEventScoped, isManualSelection, isRu, manualSelection.emails.length, manualSelection.userIds.length]);

  const loadAudienceInsights = useCallback(async () => {
    if (!validateAudienceStep()) return;

    setLoadingAudienceInsights(true);
    setError(null);
    setNotice(null);

    try {
      const [estimateResult, previewResult] = await Promise.all([
        adminEmailApi.estimateAudience({
          broadcastType: form.type,
          audienceKind: form.audienceKind,
          audienceSource: form.audienceSource,
          audienceFilterJson,
        }),
        adminEmailApi.previewAudience({
          broadcastType: form.type,
          audienceKind: form.audienceKind,
          audienceSource: form.audienceSource,
          audienceFilterJson,
        }, { limit: 8 }),
      ]);

      setEstimate(estimateResult);
      setAudiencePreview(previewResult);

      if (estimateResult.totalEligible === 0) {
        setNotice(
          isRu
            ? 'Сейчас нет eligible получателей. Проверьте источник, согласия и тип письма.'
            : 'There are no eligible recipients yet. Check audience source, consent rules, and broadcast type.',
        );
      }
    } catch (requestError) {
      setEstimate(null);
      setAudiencePreview(null);
      setError(getAdminEmailErrorMessage(requestError, locale));
    } finally {
      setLoadingAudienceInsights(false);
    }
  }, [audienceFilterJson, form.audienceKind, form.audienceSource, form.type, isRu, locale, validateAudienceStep]);

  const loadEmailPreview = useCallback(async () => {
    setLoadingEmailPreview(true);

    const previewVariables = {
      ...(previewSampleRecipient?.variables ?? {}),
      name: previewSampleRecipient?.name ?? 'Иван Петров',
      email: previewSampleRecipient?.email ?? (form.testEmail || 'admin@example.com'),
      unsubscribeUrl: previewSampleRecipient?.variables?.unsubscribeUrl
        ?? `${window.location.origin}/${locale}/unsubscribe?token=preview`,
    };

    try {
      const result = await adminEmailApi.previewEmail({
        subject: form.subject,
        preheader: form.preheader,
        textBody: form.textBody,
        htmlBody: form.htmlBody,
        sampleVariables: previewVariables,
      });
      setEmailPreview(result);
    } catch (requestError) {
      setEmailPreview(null);
      setError(getAdminEmailErrorMessage(requestError, locale));
    } finally {
      setLoadingEmailPreview(false);
    }
  }, [form.htmlBody, form.preheader, form.subject, form.testEmail, form.textBody, locale, previewSampleRecipient]);

  const testSend = useCallback(async () => {
    if (!form.testEmail.trim()) {
      setError(isRu ? 'Укажите email для теста.' : 'Enter a test email address.');
      return;
    }

    setError(null);
    setNotice(null);

    try {
      await adminEmailApi.testSendEmail({
        toEmail: form.testEmail.trim(),
        subject: form.subject || 'Test',
        preheader: form.preheader,
        textBody: form.textBody || 'Test',
        htmlBody: form.htmlBody,
      });
      setNotice(isRu ? `Тест отправлен на ${form.testEmail.trim()}` : `Test sent to ${form.testEmail.trim()}`);
    } catch (requestError) {
      setError(getAdminEmailErrorMessage(requestError, locale));
    }
  }, [form.htmlBody, form.preheader, form.subject, form.testEmail, form.textBody, isRu, locale]);

  const validateStep = useCallback((): boolean => {
    setError(null);

    if (step === 1 && !form.title.trim()) {
      setError(isRu ? 'Укажите название рассылки.' : 'Enter a broadcast title.');
      return false;
    }

    if (step === 2) {
      return validateAudienceStep();
    }

    if (step === 3) {
      if (!form.subject.trim()) {
        setError(isRu ? 'Укажите тему письма.' : 'Enter an email subject.');
        return false;
      }
      if (!form.textBody.trim() && !form.htmlBody.trim()) {
        setError(isRu ? 'Заполните текстовую или HTML-версию письма.' : 'Fill a text or HTML email body.');
        return false;
      }
    }

    if (step === 4) {
      void loadEmailPreview();
    }

    if (step === 5) {
      if (form.sendMode !== 'draft' && !estimate) {
        setError(
          isRu
            ? 'Перед отправкой сначала проверьте аудиторию и убедитесь, что список получателей корректный.'
            : 'Before sending, review the audience and confirm the recipient list.',
        );
        return false;
      }
      if (form.sendMode !== 'draft' && (estimate?.totalEligible ?? 0) < 1) {
        setError(
          isRu
            ? 'Сейчас нет eligible получателей для отправки.'
            : 'There are no eligible recipients to send right now.',
        );
        return false;
      }
      if (form.sendMode === 'scheduled' && !form.scheduledAt) {
        setError(isRu ? 'Укажите дату и время отправки.' : 'Enter a scheduled date and time.');
        return false;
      }
      if (form.sendMode === 'scheduled' && new Date(form.scheduledAt) <= new Date()) {
        setError(isRu ? 'Дата отправки должна быть в будущем.' : 'Scheduled time must be in the future.');
        return false;
      }
    }

    return true;
  }, [estimate, form.htmlBody, form.scheduledAt, form.sendMode, form.subject, form.textBody, form.title, isRu, loadEmailPreview, step, validateAudienceStep]);

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
    } catch (requestError) {
      setError(getAdminEmailErrorMessage(requestError, locale));
    } finally {
      setSaving(false);
    }
  }, [form, locale, router, validateStep]);

  return (
    <div className="signal-page-shell admin-control-page admin-email-wizard-page">
      <AdminPageHeader
        title={isRu ? 'Новая рассылка' : 'New broadcast'}
        subtitle={stepLabels[step][isRu ? 'ru' : 'en']}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <div className="admin-wizard-steps">
        {([1, 2, 3, 4, 5] as BroadcastWizardStep[]).map((wizardStep) => (
          <button
            key={wizardStep}
            type="button"
            className={`admin-wizard-step ${step === wizardStep ? 'active' : ''} ${step > wizardStep ? 'completed' : ''}`}
            onClick={() => wizardStep < step && setStep(wizardStep)}
            disabled={wizardStep > step}
          >
            <span className="admin-wizard-step-num">{wizardStep}</span>
            <span className="admin-wizard-step-label">{stepLabels[wizardStep][isRu ? 'ru' : 'en']}</span>
          </button>
        ))}
      </div>

      {step === 1 && (
        <Panel variant="elevated" className="admin-command-panel">
          <div className="admin-email-section-head">
            <h2>{isRu ? 'Основные настройки' : 'Basic settings'}</h2>
            <p className="signal-muted">
              {isRu
                ? 'Сначала задайте понятное имя рассылки, её тип и при необходимости подгрузите шаблон.'
                : 'Start with a clear internal name, broadcast type, and an optional template.'}
            </p>
          </div>

          <div className="admin-email-form-grid">
            <label>
              <span>{isRu ? 'Название рассылки' : 'Broadcast title'} *</span>
              <FieldInput
                value={form.title}
                onChange={(e) => updateForm({ title: e.target.value })}
                placeholder={isRu ? 'Например: Майский дайджест 2026' : 'e.g. May 2026 digest'}
              />
            </label>

            <label>
              <span>{isRu ? 'Тип рассылки' : 'Broadcast type'}</span>
              <FieldSelect value={form.type} onChange={(e) => updateForm({ type: e.target.value as BroadcastFormState['type'] })}>
                <option value="marketing">{isRu ? 'Маркетинговая' : 'Marketing'}</option>
                <option value="event_announcement">{isRu ? 'Анонс события' : 'Event announcement'}</option>
                <option value="event_reminder">{isRu ? 'Напоминание о событии' : 'Event reminder'}</option>
                <option value="system_notification">{isRu ? 'Системное уведомление' : 'System notification'}</option>
                <option value="admin_test">{isRu ? 'Операционная / тестовая' : 'Operational / admin test'}</option>
                <option value="transactional">{isRu ? 'Транзакционная' : 'Transactional'}</option>
              </FieldSelect>
            </label>

            <label>
              <span>{isRu ? 'Шаблон' : 'Template'}</span>
              <FieldSelect value={form.templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">{isRu ? 'Без шаблона' : 'No template'}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </FieldSelect>
            </label>
          </div>

          <div className="signal-row-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void nextStep()}>
              {isRu ? 'Далее' : 'Next'} →
            </button>
          </div>
        </Panel>
      )}

      {step === 2 && (
        <Panel variant="elevated" className="admin-command-panel">
          <div className="admin-email-section-head">
            <h2>{isRu ? 'Аудитория и получатели' : 'Audience and recipients'}</h2>
            <p className="signal-muted">
              {isRu
                ? 'Здесь важно не просто выбрать источник, а заранее увидеть, кому письмо реально уйдёт и кто будет пропущен.'
                : 'Choose the audience carefully and preview who will actually receive the message before sending.'}
            </p>
          </div>

          <div className="admin-email-form-grid">
            <label>
              <span>{isRu ? 'Источник аудитории' : 'Audience source'}</span>
              <FieldSelect
                value={form.audienceSource}
                onChange={(e) => updateForm({ audienceSource: e.target.value as BroadcastFormState['audienceSource'] })}
              >
                <option value="static_filter">{isRu ? 'Статический фильтр' : 'Static filter'}</option>
                <option value="event_participants">{isRu ? 'Участники события' : 'Event participants'}</option>
                <option value="event_teams">{isRu ? 'Команды события' : 'Event teams'}</option>
                <option value="manual_selection">{isRu ? 'Ручной выбор' : 'Manual selection'}</option>
              </FieldSelect>
            </label>

            <label>
              <span>{isRu ? 'Тип аудитории' : 'Audience kind'}</span>
              <FieldSelect
                value={form.audienceKind}
                onChange={(e) => updateForm({ audienceKind: e.target.value as BroadcastFormState['audienceKind'] })}
              >
                <option value="mailing_consent">{isRu ? 'С согласием на рассылки' : 'Mailing consent'}</option>
                <option value="verified_users">{isRu ? 'Подтверждённые пользователи' : 'Verified users'}</option>
                <option value="active_users">{isRu ? 'Активные пользователи' : 'Active users'}</option>
                <option value="platform_admins">{isRu ? 'Администраторы платформы' : 'Platform admins'}</option>
              </FieldSelect>
            </label>

            {(isEventScoped || isManualSelection) && (
              <label>
                <span>{isRu ? (isManualSelection ? 'Событие (для scope / доступа)' : 'Событие') : (isManualSelection ? 'Event (scope / access)' : 'Event')}</span>
                <FieldSelect
                  value={form.eventId}
                  onChange={(e) => updateForm({ eventId: e.target.value })}
                >
                  <option value="">{isRu ? 'Не выбрано' : 'Not selected'}</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>{event.title}</option>
                  ))}
                </FieldSelect>
              </label>
            )}

            {isEventScoped && (
              <>
                <label>
                  <span>{isRu ? 'Роли участников' : 'Member roles'}</span>
                  <FieldSelect
                    value={form.memberRoles[0] ?? 'PARTICIPANT'}
                    onChange={(e) => updateForm({ memberRoles: [e.target.value] })}
                  >
                    <option value="PARTICIPANT">{isRu ? 'Участник' : 'Participant'}</option>
                    <option value="TEAM_CAPTAIN">{isRu ? 'Капитан команды' : 'Team captain'}</option>
                    <option value="ORGANIZER">{isRu ? 'Организатор' : 'Organizer'}</option>
                    <option value="VOLUNTEER">{isRu ? 'Волонтёр' : 'Volunteer'}</option>
                  </FieldSelect>
                </label>

                <label>
                  <span>{isRu ? 'Статус участников' : 'Member status'}</span>
                  <FieldSelect
                    value={form.memberStatuses[0] ?? 'ACTIVE'}
                    onChange={(e) => updateForm({ memberStatuses: [e.target.value] })}
                  >
                    <option value="ACTIVE">{isRu ? 'Активные' : 'Active'}</option>
                    <option value="RESERVE">{isRu ? 'В резерве' : 'Reserve'}</option>
                    <option value="PENDING">{isRu ? 'Ожидающие' : 'Pending'}</option>
                  </FieldSelect>
                </label>

                <label>
                  <span>{isRu ? 'Командный фильтр' : 'Team filter'}</span>
                  <FieldSelect
                    value={form.teamMembership}
                    onChange={(e) => updateForm({ teamMembership: e.target.value as BroadcastFormState['teamMembership'] })}
                  >
                    <option value="ANY">{isRu ? 'Любые' : 'Any'}</option>
                    <option value="WITH_TEAM">{isRu ? 'Только в команде' : 'Only with a team'}</option>
                    <option value="WITHOUT_TEAM">{isRu ? 'Только без команды' : 'Only without a team'}</option>
                  </FieldSelect>
                </label>
              </>
            )}

            {isManualSelection && (
              <label className="admin-email-form-wide">
                <span>{isRu ? 'Конкретные получатели' : 'Specific recipients'}</span>
                <FieldTextarea
                  rows={8}
                  value={form.manualRecipientsInput}
                  onChange={(e) => updateForm({ manualRecipientsInput: e.target.value })}
                  placeholder={
                    isRu
                      ? 'user@example.com\nanother@example.com\nuser_123456'
                      : 'user@example.com\nanother@example.com\nuser_123456'
                  }
                />
              </label>
            )}
          </div>

          {isManualSelection ? (
            <div className="admin-email-note">
              <strong>{isRu ? 'Как это работает:' : 'How it works:'}</strong>{' '}
              {isRu
                ? 'вставьте по одному email или user id на строку, через запятую или ";". Для event-admin лучше указывать событие выше, чтобы выборка оставалась в рамках доступного события.'
                : 'Paste one email or user id per line, or separate them with commas / semicolons. Event admins should choose an event scope above to keep the audience inside an allowed event.'}
            </div>
          ) : null}

          {isManualSelection ? (
            <div className="admin-email-manual-summary">
              <div className="admin-email-summary-pill">
                <strong>{manualSelection.emails.length}</strong>
                <span>{isRu ? 'email' : 'emails'}</span>
              </div>
              <div className="admin-email-summary-pill">
                <strong>{manualSelection.userIds.length}</strong>
                <span>{isRu ? 'user id' : 'user ids'}</span>
              </div>
              <div className={`admin-email-summary-pill ${manualSelection.invalid.length > 0 ? 'warning' : ''}`}>
                <strong>{manualSelection.invalid.length}</strong>
                <span>{isRu ? 'сомнительных записей' : 'invalid tokens'}</span>
              </div>
            </div>
          ) : null}

          {isManualSelection && manualSelection.invalid.length > 0 ? (
            <Notice tone="warning">
              {isRu ? 'Эти записи не распознаны как email или user id:' : 'These entries were not recognized as an email or user id:'}{' '}
              {manualSelection.invalid.slice(0, 6).join(', ')}
              {manualSelection.invalid.length > 6 ? '...' : ''}
            </Notice>
          ) : null}

          <div className="signal-row-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={loadingAudienceInsights}
              onClick={() => void loadAudienceInsights()}
            >
              {loadingAudienceInsights
                ? '...'
                : isRu
                  ? 'Проверить аудиторию'
                  : 'Review audience'}
            </button>
          </div>

          {loadingAudienceInsights ? <LoadingLines rows={6} /> : null}

          {estimate ? (
            <div className="admin-email-audience-results">
              <div className="signal-kpi-grid">
                <MetricCard label={isRu ? 'Найдено' : 'Matched'} value={estimate.totalMatched} tone="info" />
                <MetricCard label={isRu ? 'Eligible' : 'Eligible'} value={estimate.totalEligible} tone="success" />
                <MetricCard label={isRu ? 'Пропущено' : 'Skipped'} value={estimate.totalSkipped} tone="warning" />
              </div>

              {skippedByReason.length > 0 ? (
                <div className="admin-email-skip-list">
                  {skippedByReason.map(([reason, count]) => (
                    <div key={reason} className="admin-email-skip-item">
                      <span>{formatPreviewStatus(reason, locale)}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              {previewRows.length > 0 ? (
                <div className="admin-table-mobile-cards">
                  <AdminDataTable minWidth={920}>
                    <AdminDataTableHeader
                      columns={[
                        { label: isRu ? 'Получатель' : 'Recipient', width: '31%' },
                        { label: isRu ? 'Статус' : 'Status', width: '17%' },
                        { label: isRu ? 'Причина / комментарий' : 'Reason / comment', width: '28%' },
                        { label: isRu ? 'Источник' : 'Source', width: '24%' },
                      ]}
                    />
                    <AdminDataTableBody>
                      {previewRows.map((item, index) => (
                        <AdminDataTableRow key={`${item.userId ?? item.email ?? 'preview'}-${index}`}>
                          <AdminDataTableCell>
                            <AdminTableCellMain title={item.name ?? item.email ?? '—'} subtitle={item.email ?? item.userId ?? '—'} />
                          </AdminDataTableCell>
                          <AdminDataTableCell>
                            <StatusBadge tone={statusTone(item.status ?? 'QUEUED')}>
                              {formatPreviewStatus(item.status ?? 'QUEUED', locale)}
                            </StatusBadge>
                          </AdminDataTableCell>
                          <AdminDataTableCell truncate className="signal-muted">
                            {item.skipReason ?? (item.eligible ? (isRu ? 'Будет отправлено' : 'Ready to send') : '—')}
                          </AdminDataTableCell>
                          <AdminDataTableCell truncate className="signal-muted">
                            {formatAudienceReason(item, locale)}
                          </AdminDataTableCell>
                        </AdminDataTableRow>
                      ))}
                    </AdminDataTableBody>
                  </AdminDataTable>

                  <AdminMobileList>
                    {previewRows.map((item, index) => (
                      <AdminMobileCard
                        key={`${item.userId ?? item.email ?? 'preview'}-${index}`}
                        title={item.name ?? item.email ?? '—'}
                        subtitle={item.email ?? item.userId ?? '—'}
                        badge={
                          <StatusBadge tone={statusTone(item.status ?? 'QUEUED')}>
                            {formatPreviewStatus(item.status ?? 'QUEUED', locale)}
                          </StatusBadge>
                        }
                        meta={[
                          {
                            label: isRu ? 'Причина' : 'Reason',
                            value: item.skipReason ?? (item.eligible ? (isRu ? 'Будет отправлено' : 'Ready to send') : '—'),
                          },
                          {
                            label: isRu ? 'Источник' : 'Source',
                            value: formatAudienceReason(item, locale),
                          },
                        ]}
                      />
                    ))}
                  </AdminMobileList>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title={isRu ? 'Проверка аудитории' : 'Audience review'}
              description={
                isRu
                  ? 'Запустите проверку, чтобы заранее увидеть eligible получателей и причины пропуска.'
                  : 'Run an audience review to see eligible recipients and skip reasons before sending.'
              }
            />
          )}

          <div className="signal-row-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void prevStep()}>
              ← {isRu ? 'Назад' : 'Back'}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void nextStep()}>
              {isRu ? 'Далее' : 'Next'} →
            </button>
          </div>
        </Panel>
      )}

      {step === 3 && (
        <Panel variant="elevated" className="admin-command-panel">
          <div className="admin-email-section-head">
            <h2>{isRu ? 'Контент письма' : 'Email content'}</h2>
            <p className="signal-muted">
              {isRu
                ? 'Готовьте письмо сразу в двух видах: аккуратный текст и HTML-версию. Это упростит preview и повысит доставляемость.'
                : 'Prepare both a clean text version and an HTML version for better preview and deliverability.'}
            </p>
          </div>

          <div className="admin-email-form-grid">
            <label className="admin-email-form-wide">
              <span>{isRu ? 'Тема письма' : 'Subject'} *</span>
              <FieldInput
                value={form.subject}
                onChange={(e) => updateForm({ subject: e.target.value })}
                placeholder={isRu ? 'Например: Новости платформы RDEvents' : 'e.g. RDEvents platform updates'}
              />
            </label>

            <label className="admin-email-form-wide">
              <span>Preheader</span>
              <FieldInput
                value={form.preheader}
                onChange={(e) => updateForm({ preheader: e.target.value })}
                placeholder={isRu ? 'Краткое пояснение рядом с темой' : 'A short line shown next to the subject'}
              />
            </label>

            <label className="admin-email-form-wide">
              <span>{isRu ? 'Текстовая версия' : 'Text version'}</span>
              <FieldTextarea
                rows={11}
                value={form.textBody}
                onChange={(e) => updateForm({ textBody: e.target.value })}
              />
            </label>

            <label className="admin-email-form-wide">
              <span>HTML</span>
              <FieldTextarea
                rows={11}
                value={form.htmlBody}
                onChange={(e) => updateForm({ htmlBody: e.target.value })}
                placeholder="<p>HTML content...</p>"
              />
            </label>
          </div>

          <div className="admin-email-note">
            <strong>{isRu ? 'Переменные:' : 'Variables:'}</strong>{' '}
            {'{{name}}'}, {'{{firstName}}'}, {'{{lastName}}'}, {'{{email}}'}, {'{{unsubscribeUrl}}'}
          </div>

          <div className="signal-row-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void prevStep()}>
              ← {isRu ? 'Назад' : 'Back'}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void nextStep()}>
              {isRu ? 'Далее' : 'Next'} →
            </button>
          </div>
        </Panel>
      )}

      {step === 4 && (
        <>
          <Panel variant="elevated" className="admin-command-panel">
            <div className="admin-email-section-head">
              <h2>{isRu ? 'Preview и тестовая отправка' : 'Preview and test send'}</h2>
              <p className="signal-muted">
                {isRu
                  ? 'Preview рендерится на основе реального sample recipient из текущей аудитории, если он уже найден.'
                  : 'The preview is rendered using a real sample recipient from the current audience whenever possible.'}
              </p>
            </div>

            <div className="admin-email-form-grid">
              <label className="admin-email-form-wide">
                <span>{isRu ? 'Email для тестовой отправки' : 'Test send email'}</span>
                <FieldInput
                  type="email"
                  value={form.testEmail}
                  onChange={(e) => updateForm({ testEmail: e.target.value })}
                  placeholder="admin@example.com"
                />
              </label>
            </div>

            <div className="signal-row-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadEmailPreview()}>
                {loadingEmailPreview ? '...' : isRu ? 'Обновить preview' : 'Refresh preview'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void testSend()}>
                {isRu ? 'Отправить тест' : 'Send test'}
              </button>
            </div>
          </Panel>

          {loadingEmailPreview ? <LoadingLines rows={8} /> : null}

          {emailPreview?.warnings?.length ? (
            <Notice tone="warning">
              <strong>{isRu ? 'Предупреждения:' : 'Warnings:'}</strong>{' '}
              {emailPreview.warnings.join(' · ')}
            </Notice>
          ) : null}

          {emailPreview ? (
            <div className="admin-email-preview-layout">
              <Panel variant="elevated" className="admin-command-panel">
                <div className="admin-email-preview-frame">
                  <div className="admin-email-preview-frame-top">
                    <span className="admin-email-preview-dot" />
                    <span className="admin-email-preview-dot" />
                    <span className="admin-email-preview-dot" />
                  </div>
                  <div className="admin-email-preview-frame-body">
                    <div className="admin-email-preview-meta">
                      <p className="admin-email-preview-subject">{emailPreview.subjectPreview}</p>
                      {emailPreview.preheaderPreview ? (
                        <p className="admin-email-preview-preheader">{emailPreview.preheaderPreview}</p>
                      ) : null}
                    </div>

                    {emailPreview.htmlPreview ? (
                      <div className="admin-email-preview-html" dangerouslySetInnerHTML={{ __html: emailPreview.htmlPreview }} />
                    ) : (
                      <div className="admin-email-preview-empty">
                        {isRu ? 'HTML-версия не заполнена.' : 'HTML version is empty.'}
                      </div>
                    )}
                  </div>
                </div>
              </Panel>

              <div className="admin-email-preview-side">
                <Panel variant="elevated" className="admin-command-panel">
                  <h3>{isRu ? 'Sample recipient' : 'Sample recipient'}</h3>
                  {previewSampleRecipient ? (
                    <div className="admin-email-sample-recipient">
                      <div className="admin-email-keyvalue">
                        <span>{isRu ? 'Имя' : 'Name'}</span>
                        <strong>{previewSampleRecipient.name ?? '—'}</strong>
                      </div>
                      <div className="admin-email-keyvalue">
                        <span>Email</span>
                        <strong className="text-wrap-safe">{previewSampleRecipient.email ?? '—'}</strong>
                      </div>
                      <div className="admin-email-keyvalue">
                        <span>{isRu ? 'Источник' : 'Source'}</span>
                        <strong>{formatAudienceReason(previewSampleRecipient, locale)}</strong>
                      </div>
                      <div className="admin-email-keyvalue">
                        <span>{isRu ? 'Статус' : 'Status'}</span>
                        <StatusBadge tone={statusTone(previewSampleRecipient.status ?? 'QUEUED')}>
                          {formatPreviewStatus(previewSampleRecipient.status ?? 'QUEUED', locale)}
                        </StatusBadge>
                      </div>
                    </div>
                  ) : (
                    <p className="signal-muted">
                      {isRu
                        ? 'Пока нет sample recipient. Сначала проверьте аудиторию на предыдущем шаге.'
                        : 'No sample recipient yet. Review the audience on the previous step first.'}
                    </p>
                  )}
                </Panel>

                <Panel variant="elevated" className="admin-command-panel">
                  <h3>{isRu ? 'Текстовая версия' : 'Text version'}</h3>
                  <pre className="admin-email-text-preview">{emailPreview.textPreview}</pre>
                </Panel>
              </div>
            </div>
          ) : (
            <EmptyState
              title={isRu ? 'Preview письма' : 'Email preview'}
              description={
                isRu
                  ? 'Нажмите "Обновить preview", чтобы увидеть, как письмо будет выглядеть для конкретного получателя.'
                  : 'Click "Refresh preview" to see how the email will look for a specific recipient.'
              }
            />
          )}

          <div className="signal-row-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void prevStep()}>
              ← {isRu ? 'Назад' : 'Back'}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void nextStep()}>
              {isRu ? 'Далее' : 'Next'} →
            </button>
          </div>
        </>
      )}

      {step === 5 && (
        <Panel variant="elevated" className="admin-command-panel">
          <div className="admin-email-section-head">
            <h2>{isRu ? 'Проверка перед сохранением и отправкой' : 'Final review before saving or sending'}</h2>
            <p className="signal-muted">
              {isRu
                ? 'Последний шаг нужен для спокойной проверки: что именно отправляем, кому, и в каком режиме.'
                : 'Use this final review to verify content, audience, and delivery mode before committing the broadcast.'}
            </p>
          </div>

          <div className="admin-email-summary-grid">
            <div className="admin-email-summary-card">
              <h3>{isRu ? 'Рассылка' : 'Broadcast'}</h3>
              <div className="admin-email-keyvalue">
                <span>{isRu ? 'Название' : 'Title'}</span>
                <strong>{form.title || '—'}</strong>
              </div>
              <div className="admin-email-keyvalue">
                <span>{isRu ? 'Тип' : 'Type'}</span>
                <strong>{broadcastTypeLabels[form.type][isRu ? 'ru' : 'en']}</strong>
              </div>
              <div className="admin-email-keyvalue">
                <span>{isRu ? 'Шаблон' : 'Template'}</span>
                <strong>{templates.find((item) => item.id === form.templateId)?.name ?? (isRu ? 'Без шаблона' : 'No template')}</strong>
              </div>
            </div>

            <div className="admin-email-summary-card">
              <h3>{isRu ? 'Аудитория' : 'Audience'}</h3>
              <div className="admin-email-keyvalue">
                <span>{isRu ? 'Источник' : 'Source'}</span>
                <strong>{audienceSourceLabels[form.audienceSource][isRu ? 'ru' : 'en']}</strong>
              </div>
              <div className="admin-email-keyvalue">
                <span>{isRu ? 'Сегмент' : 'Segment'}</span>
                <strong>{audienceKindLabels[form.audienceKind][isRu ? 'ru' : 'en']}</strong>
              </div>
              <div className="admin-email-keyvalue">
                <span>{isRu ? 'Eligible' : 'Eligible'}</span>
                <strong>{estimate ? `${estimate.totalEligible} / ${estimate.totalMatched}` : '—'}</strong>
              </div>
            </div>

            <div className="admin-email-summary-card">
              <h3>{isRu ? 'Контент' : 'Content'}</h3>
              <div className="admin-email-keyvalue">
                <span>{isRu ? 'Тема' : 'Subject'}</span>
                <strong className="text-wrap-safe">{form.subject || '—'}</strong>
              </div>
              <div className="admin-email-keyvalue">
                <span>Preheader</span>
                <strong className="text-wrap-safe">{form.preheader || '—'}</strong>
              </div>
              <div className="admin-email-keyvalue">
                <span>{isRu ? 'Preview на sample' : 'Preview sample'}</span>
                <strong className="text-wrap-safe">{previewSampleRecipient?.email ?? (isRu ? 'Не выбран' : 'Not selected')}</strong>
              </div>
            </div>
          </div>

          <div className="admin-email-form-grid">
            <label>
              <span>{isRu ? 'Режим отправки' : 'Send mode'}</span>
              <FieldSelect
                value={form.sendMode}
                onChange={(e) => updateForm({ sendMode: e.target.value as BroadcastFormState['sendMode'] })}
              >
                <option value="draft">{isRu ? 'Сохранить как черновик' : 'Save as draft'}</option>
                <option value="send_now">{isRu ? 'Отправить сразу' : 'Send now'}</option>
                <option value="scheduled">{isRu ? 'Запланировать' : 'Schedule'}</option>
              </FieldSelect>
            </label>

            {form.sendMode === 'scheduled' ? (
              <label>
                <span>{isRu ? 'Дата и время' : 'Date and time'}</span>
                <FieldInput
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => updateForm({ scheduledAt: e.target.value })}
                />
              </label>
            ) : null}

            <label>
              <span>{isRu ? 'Часовой пояс' : 'Timezone'}</span>
              <FieldSelect value={form.timezone} onChange={(e) => updateForm({ timezone: e.target.value })}>
                <option value="Asia/Tashkent">Asia/Tashkent (UTC+5)</option>
                <option value="Europe/Moscow">Europe/Moscow (UTC+3)</option>
                <option value="UTC">UTC</option>
              </FieldSelect>
            </label>

            <label className="admin-email-form-wide">
              <span>{isRu ? 'Внутренние заметки' : 'Internal notes'}</span>
              <FieldTextarea
                rows={4}
                value={form.internalNotes}
                onChange={(e) => updateForm({ internalNotes: e.target.value })}
                placeholder={isRu ? 'Эти заметки видны только администраторам.' : 'These notes are visible only to admins.'}
              />
            </label>
          </div>

          <div className="signal-row-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void prevStep()}>
              ← {isRu ? 'Назад' : 'Back'}
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={() => void handleSave()}>
              {saving
                ? '...'
                : form.sendMode === 'draft'
                  ? (isRu ? 'Сохранить черновик' : 'Save draft')
                  : form.sendMode === 'send_now'
                    ? (isRu ? 'Создать и отправить' : 'Create and send now')
                    : (isRu ? 'Создать и запланировать' : 'Create and schedule')}
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}
