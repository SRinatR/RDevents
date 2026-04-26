'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EmptyState, FieldInput, FieldSelect, FieldTextarea, MetricCard, Notice, Panel, StatusBadge, TableShell } from '@/components/ui/signal-primitives';

const emptyForm = {
  title: '',
  type: 'marketing',
  audienceSource: 'static_filter',
  audienceKind: 'mailing_consent',
  eventId: '',
  teamMembership: 'ANY',
  subject: '',
  preheader: '',
  textBody: 'Здравствуйте, {{name}}!\n\n{{unsubscribeUrl}}',
  htmlBody: '<p>Здравствуйте, {{name}}!</p><p><a href="{{unsubscribeUrl}}">Отписаться</a></p>',
  sendMode: 'draft',
  scheduledAt: '',
  testEmail: 'admin@example.com',
};

export default function NewEmailBroadcastPage() {
  const locale = useRouteLocale();
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [estimate, setEstimate] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [emailPreview, setEmailPreview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const audienceFilterJson = useMemo(() => ({
    ...(form.eventId.trim() ? { eventId: form.eventId.trim() } : {}),
    ...(form.teamMembership !== 'ANY' ? { teamMembership: form.teamMembership } : {}),
  }), [form.eventId, form.teamMembership]);

  const payload = useCallback(() => ({
    title: form.title,
    type: form.type,
    subject: form.subject,
    preheader: form.preheader || undefined,
    textBody: form.textBody,
    htmlBody: form.htmlBody,
    audienceKind: form.audienceKind,
    audienceSource: form.audienceSource,
    audienceFilterJson,
    sendMode: form.sendMode,
    scheduledAt: form.sendMode === 'scheduled' && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
    timezone: 'Asia/Tashkent',
  }), [form, audienceFilterJson]);

  const calculate = async () => {
    setError(null);
    setNotice(null);
    try {
      const body = payload();
      const [estimateRes, previewRes] = await Promise.all([
        adminEmailApi.estimateAudience({ broadcastType: form.type, audienceKind: form.audienceKind, audienceSource: form.audienceSource, audienceFilterJson }),
        adminEmailApi.previewAudience({ broadcastType: form.type, audienceKind: form.audienceKind, audienceSource: form.audienceSource, audienceFilterJson }, { limit: 8 }),
      ]);
      setEstimate(estimateRes);
      setPreview(previewRes);
      setNotice(locale === 'ru' ? 'Аудитория рассчитана.' : 'Audience calculated.');
      void body;
    } catch {
      setError(locale === 'ru' ? 'Не удалось рассчитать аудиторию.' : 'Failed to calculate audience.');
    }
  };

  const previewEmail = async () => {
    setError(null);
    try {
      setEmailPreview(await adminEmailApi.previewEmail({
        subject: form.subject,
        preheader: form.preheader,
        textBody: form.textBody,
        htmlBody: form.htmlBody,
        sampleVariables: { name: 'Admin', email: form.testEmail, unsubscribeUrl: `${window.location.origin}/${locale}/unsubscribe?token=preview` },
      }));
    } catch {
      setError(locale === 'ru' ? 'Не удалось собрать preview письма.' : 'Failed to build email preview.');
    }
  };

  const testSend = async () => {
    setError(null);
    setNotice(null);
    try {
      await adminEmailApi.testSendEmail({
        toEmail: form.testEmail || 'admin@example.com',
        subject: form.subject || 'Тест',
        preheader: form.preheader,
        textBody: form.textBody || 'Тест',
        htmlBody: form.htmlBody,
      });
      setNotice(locale === 'ru' ? `Тест отправлен на ${form.testEmail || 'admin@example.com'}.` : `Test sent to ${form.testEmail || 'admin@example.com'}.`);
    } catch {
      setError(locale === 'ru' ? 'Не удалось отправить тест.' : 'Failed to send test.');
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await adminEmailApi.createBroadcast(payload());
      router.push(`/${locale}/admin/email/broadcasts/${response.data.id}`);
    } catch {
      setError(locale === 'ru' ? 'Не удалось сохранить рассылку.' : 'Failed to save broadcast.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader title={locale === 'ru' ? 'Новая рассылка' : 'New broadcast'} subtitle={locale === 'ru' ? 'Черновик, аудитория, контент и отправка' : 'Draft, audience, content and delivery'} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <Panel variant="elevated" className="admin-command-panel">
        <div className="admin-email-form-grid">
          <label><span>{locale === 'ru' ? 'Название' : 'Title'}</span><FieldInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label><span>{locale === 'ru' ? 'Тип' : 'Type'}</span><FieldSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="marketing">Marketing</option><option value="event_announcement">Event announcement</option><option value="event_reminder">Event reminder</option><option value="admin_test">Admin test</option></FieldSelect></label>
          <label><span>{locale === 'ru' ? 'Источник' : 'Source'}</span><FieldSelect value={form.audienceSource} onChange={(e) => setForm({ ...form, audienceSource: e.target.value })}><option value="static_filter">Static filter</option><option value="event_participants">Event participants</option><option value="event_teams">Event teams</option></FieldSelect></label>
          <label><span>{locale === 'ru' ? 'Аудитория' : 'Audience'}</span><FieldSelect value={form.audienceKind} onChange={(e) => setForm({ ...form, audienceKind: e.target.value })}><option value="mailing_consent">Mailing consent</option><option value="verified_users">Verified users</option><option value="active_users">Active users</option><option value="platform_admins">Platform admins</option></FieldSelect></label>
          <label><span>Event ID</span><FieldInput value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })} /></label>
          <label><span>{locale === 'ru' ? 'Команда' : 'Team'}</span><FieldSelect value={form.teamMembership} onChange={(e) => setForm({ ...form, teamMembership: e.target.value })}><option value="ANY">Any</option><option value="WITH_TEAM">In team</option><option value="WITHOUT_TEAM">Without team</option></FieldSelect></label>
          <label className="admin-email-form-wide"><span>{locale === 'ru' ? 'Тема' : 'Subject'}</span><FieldInput value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
          <label className="admin-email-form-wide"><span>Preheader</span><FieldInput value={form.preheader} onChange={(e) => setForm({ ...form, preheader: e.target.value })} /></label>
          <label className="admin-email-form-wide"><span>Text</span><FieldTextarea rows={7} value={form.textBody} onChange={(e) => setForm({ ...form, textBody: e.target.value })} /></label>
          <label className="admin-email-form-wide"><span>HTML</span><FieldTextarea rows={7} value={form.htmlBody} onChange={(e) => setForm({ ...form, htmlBody: e.target.value })} /></label>
          <label><span>{locale === 'ru' ? 'Отправка' : 'Send mode'}</span><FieldSelect value={form.sendMode} onChange={(e) => setForm({ ...form, sendMode: e.target.value })}><option value="draft">Draft</option><option value="send_now">Send now</option><option value="scheduled">Scheduled</option></FieldSelect></label>
          <label><span>{locale === 'ru' ? 'Дата' : 'Date'}</span><FieldInput type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></label>
        </div>
        <div className="signal-row-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => void calculate()}>{locale === 'ru' ? 'Рассчитать' : 'Estimate'}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => void previewEmail()}>Preview</button>
          <button className="btn btn-secondary btn-sm" onClick={() => void testSend()}>{locale === 'ru' ? 'Тест' : 'Test'}</button>
          <button className="btn btn-primary btn-sm" onClick={() => void save()} disabled={saving}>{saving ? '...' : locale === 'ru' ? 'Сохранить' : 'Save'}</button>
        </div>
      </Panel>

      {estimate ? <div className="signal-kpi-grid"><MetricCard label="Matched" value={estimate.totalMatched} /><MetricCard label="Eligible" value={estimate.totalEligible} /><MetricCard label="Skipped" value={estimate.totalSkipped} /></div> : null}
      {preview?.data?.length ? (
        <Panel variant="elevated" className="admin-command-panel">
          <TableShell><table className="signal-table"><tbody>{preview.data.map((item: any) => <tr key={`${item.userId}-${item.email}`}><td>{item.name ?? '-'}</td><td>{item.email ?? '-'}</td><td><StatusBadge tone={item.eligible ? 'success' : 'warning'}>{item.status}</StatusBadge></td><td>{item.skipReason ?? '-'}</td></tr>)}</tbody></table></TableShell>
        </Panel>
      ) : null}
      {emailPreview ? <Panel variant="subtle" className="admin-command-panel"><h2>{emailPreview.subjectPreview}</h2><p className="signal-muted">{emailPreview.textPreview}</p><div dangerouslySetInnerHTML={{ __html: emailPreview.htmlPreview }} /></Panel> : null}
      {!estimate && !preview ? <EmptyState title={locale === 'ru' ? 'Готово к настройке' : 'Ready'} description={locale === 'ru' ? 'Заполните поля и рассчитайте аудиторию перед отправкой.' : 'Fill the fields and estimate the audience before sending.'} /> : null}
    </div>
  );
}
