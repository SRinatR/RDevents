'use client';

import { FormEvent, useState } from 'react';
import { adminApi } from '@/lib/api';
import { useRouteLocale, useRouteParam } from '@/hooks/useRouteParams';
import { FieldInput, FieldSelect, Notice, PageHeader, Panel, SectionHeader } from '@/components/ui/signal-primitives';

const EVENT_ROLES = ['ADMIN', 'MANAGER', 'PR_MANAGER', 'CHECKIN_OPERATOR', 'VIEWER'];

export default function WorkspaceAccessPage() {
  const locale = useRouteLocale();
  const workspaceId = useRouteParam('workspaceId');
  const isRu = locale === 'ru';
  const [form, setForm] = useState({
    userId: '',
    role: 'PR_MANAGER',
    includePastEvents: false,
    includeCurrentEvents: true,
    includeFutureEvents: true,
    includeCancelledEvents: false,
    autoApplyToNewEvents: true,
    fullWorkspaceAccess: false,
  });
  const [preview, setPreview] = useState<any | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');

  function body() {
    return { ...form };
  }

  async function doPreview(event: FormEvent) {
    event.preventDefault();
    setError('');
    setResult(null);
    try {
      setPreview(await adminApi.previewWorkspacePolicy(workspaceId, body()));
    } catch (err: any) {
      setError(err?.message || (isRu ? 'Не удалось построить предпросмотр.' : 'Failed to preview policy.'));
    }
  }

  async function applyPolicy() {
    setError('');
    try {
      setResult(await adminApi.createWorkspacePolicy(workspaceId, body()));
    } catch (err: any) {
      setError(err?.message || (isRu ? 'Не удалось выдать доступ.' : 'Failed to grant access.'));
    }
  }

  return (
    <div className="admin-page">
      <PageHeader title={isRu ? 'Политики доступа' : 'Access policies'} subtitle={isRu ? 'Массовая выдача доступа всегда идёт через предпросмотр.' : 'Bulk access always goes through preview first.'} />
      <Panel>
        <form className="signal-form-grid" onSubmit={doPreview}>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          {result ? <Notice tone="success">{isRu ? 'Доступ выдан.' : 'Access granted.'}</Notice> : null}
          <label>
            User ID
            <FieldInput value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} required />
          </label>
          <label>
            {isRu ? 'Роль в мероприятиях' : 'Event role'}
            <FieldSelect value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {EVENT_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </FieldSelect>
          </label>
          <div className="signal-form-wide">
            <label><input type="checkbox" checked={form.fullWorkspaceAccess} onChange={(event) => setForm({ ...form, fullWorkspaceAccess: event.target.checked })} /> {isRu ? 'Полный доступ к отделу' : 'Full workspace access'}</label>
            <label><input type="checkbox" checked={form.includeCurrentEvents} onChange={(event) => setForm({ ...form, includeCurrentEvents: event.target.checked })} /> {isRu ? 'Текущие мероприятия' : 'Current events'}</label>
            <label><input type="checkbox" checked={form.includeFutureEvents} onChange={(event) => setForm({ ...form, includeFutureEvents: event.target.checked })} /> {isRu ? 'Будущие мероприятия' : 'Future events'}</label>
            <label><input type="checkbox" checked={form.includePastEvents} onChange={(event) => setForm({ ...form, includePastEvents: event.target.checked })} /> {isRu ? 'Прошедшие мероприятия' : 'Past events'}</label>
            <label><input type="checkbox" checked={form.includeCancelledEvents} onChange={(event) => setForm({ ...form, includeCancelledEvents: event.target.checked })} /> {isRu ? 'Отменённые мероприятия' : 'Cancelled events'}</label>
            <label><input type="checkbox" checked={form.autoApplyToNewEvents} onChange={(event) => setForm({ ...form, autoApplyToNewEvents: event.target.checked })} /> {isRu ? 'Автоматически применять к новым мероприятиям' : 'Auto-apply to new events'}</label>
          </div>
          <div className="signal-form-actions">
            <button className="btn btn-secondary" type="submit">{isRu ? 'Предпросмотр' : 'Preview'}</button>
            <button className="btn btn-primary" type="button" onClick={applyPolicy} disabled={!preview}>{isRu ? 'Выдать доступ' : 'Grant access'}</button>
          </div>
        </form>
      </Panel>

      {preview ? (
        <Panel>
          <SectionHeader title={isRu ? 'Предпросмотр' : 'Preview'} subtitle={`${preview.totalMatched ?? 0} ${isRu ? 'мероприятий' : 'events'}`} />
          <div className="signal-metrics-grid">
            {(['current', 'future', 'past', 'cancelled'] as const).map((scope) => (
              <div key={scope} className="signal-metric-card">
                <div className="signal-metric-label">{scope}</div>
                <div className="signal-metric-value">{preview.matchedEvents?.[scope]?.length ?? 0}</div>
              </div>
            ))}
          </div>
          {preview.autoApplyToNewEvents ? <Notice tone="info">{isRu ? 'Новые мероприятия отдела будут получать доступ автоматически.' : 'New workspace events will receive access automatically.'}</Notice> : null}
        </Panel>
      ) : null}
    </div>
  );
}
