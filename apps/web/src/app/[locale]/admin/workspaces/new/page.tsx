'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { FieldInput, FieldSelect, FieldTextarea, Notice, PageHeader, Panel } from '@/components/ui/signal-primitives';

const KINDS = ['ROOT_ORGANIZATION', 'DEPARTMENT', 'SUBDEPARTMENT', 'WORKING_GROUP', 'EXTERNAL_PARTNER'];

export default function NewWorkspacePage() {
  const locale = useRouteLocale();
  const isRu = locale === 'ru';
  const router = useRouter();
  const [form, setForm] = useState({ name: '', slug: '', description: '', kind: 'DEPARTMENT', parentId: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await adminApi.createWorkspace({
        ...form,
        parentId: form.parentId || null,
        description: form.description || null,
      });
      router.push(`/${locale}/admin/workspaces/${result.workspace.id}`);
    } catch (err: any) {
      setError(err?.message || (isRu ? 'Не удалось создать отдел.' : 'Failed to create workspace.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <PageHeader title={isRu ? 'Новый отдел' : 'New workspace'} subtitle={isRu ? 'Создайте отдел, подотдел, рабочую группу или партнёра.' : 'Create a department, subgroup, working group or partner.'} />
      <Panel>
        <form className="signal-form-grid" onSubmit={submit}>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <label>
            {isRu ? 'Название' : 'Name'}
            <FieldInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label>
            Slug
            <FieldInput value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required pattern="[a-z0-9-]+" />
          </label>
          <label>
            {isRu ? 'Тип' : 'Kind'}
            <FieldSelect value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
              {KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </FieldSelect>
          </label>
          <label>
            Parent ID
            <FieldInput value={form.parentId} onChange={(event) => setForm({ ...form, parentId: event.target.value })} placeholder={isRu ? 'Опционально' : 'Optional'} />
          </label>
          <label className="signal-form-wide">
            {isRu ? 'Описание' : 'Description'}
            <FieldTextarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} />
          </label>
          <div className="signal-form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? (isRu ? 'Создание...' : 'Creating...') : (isRu ? 'Создать' : 'Create')}</button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
