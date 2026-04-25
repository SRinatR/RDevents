'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, FieldTextarea, LoadingLines, Notice, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbarSearch, AdminToolbarSelect } from '@/components/admin/AdminToolbar';

type EmailTemplateRow = {
  id: string;
  name: string;
  key: string;
  subject: string;
  preheader: string | null;
  htmlBody?: string;
  textBody?: string;
  status: string;
  updatedAt: string;
};

type TemplateForm = {
  name: string;
  key: string;
  subject: string;
  preheader: string;
  status: string;
  textBody: string;
  htmlBody: string;
};

const emptyTemplateForm: TemplateForm = {
  name: '',
  key: '',
  subject: '',
  preheader: '',
  status: 'draft',
  textBody: '',
  htmlBody: '',
};

const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  active: 'success',
  draft: 'warning',
  archived: 'neutral',
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export default function AdminEmailTemplatesPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showComposer, setShowComposer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyTemplateForm);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  const loadTemplates = useCallback(async () => {
    setLoadingData(true);
    setError(null);

    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await adminEmailApi.listTemplates(params);
      setTemplates(res.data);
    } catch (e) {
      console.error('Load email templates failed:', e);
      setTemplates([]);
      setError(locale === 'ru' ? 'Не удалось загрузить шаблоны.' : 'Failed to load email templates.');
    } finally {
      setLoadingData(false);
    }
  }, [locale, search, statusFilter]);

  useEffect(() => {
    if (!user || !isAdmin || !isPlatformAdmin) return;
    void loadTemplates();
  }, [user, isAdmin, isPlatformAdmin, loadTemplates]);

  const composerTitle = useMemo(() => {
    if (editingId) return locale === 'ru' ? 'Редактировать шаблон' : 'Edit template';
    return locale === 'ru' ? 'Новый шаблон' : 'New template';
  }, [editingId, locale]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyTemplateForm);
    setError(null);
    setNotice(null);
    setShowComposer(true);
  };

  const startEdit = (template: EmailTemplateRow) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      key: template.key,
      subject: template.subject,
      preheader: template.preheader ?? '',
      status: template.status,
      textBody: template.textBody ?? '',
      htmlBody: template.htmlBody ?? '',
    });
    setError(null);
    setNotice(null);
    setShowComposer(true);
  };

  const submitTemplate = async () => {
    const name = form.name.trim();
    const subject = form.subject.trim();
    const textBody = form.textBody.trim();

    if (!name || !subject || !textBody) {
      setError(locale === 'ru' ? 'Заполните название, тему и текст письма.' : 'Fill in name, subject, and text body.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body = {
        name,
        key: form.key.trim() || undefined,
        subject,
        preheader: form.preheader.trim() || undefined,
        status: form.status,
        textBody,
        htmlBody: form.htmlBody.trim() || textToHtml(textBody),
      };

      if (editingId) {
        await adminEmailApi.updateTemplate(editingId, body);
        setNotice(locale === 'ru' ? 'Шаблон обновлён.' : 'Template updated.');
      } else {
        await adminEmailApi.createTemplate(body);
        setNotice(locale === 'ru' ? 'Шаблон создан.' : 'Template created.');
      }

      setShowComposer(false);
      setEditingId(null);
      setForm(emptyTemplateForm);
      await loadTemplates();
    } catch (e) {
      console.error('Save email template failed:', e);
      setError(locale === 'ru' ? 'Не удалось сохранить шаблон. Проверьте уникальность ключа.' : 'Failed to save template. Check that the key is unique.');
    } finally {
      setSaving(false);
    }
  };

  const archiveTemplate = async (templateId: string) => {
    setError(null);
    setNotice(null);

    try {
      await adminEmailApi.archiveTemplate(templateId);
      setNotice(locale === 'ru' ? 'Шаблон архивирован.' : 'Template archived.');
      await loadTemplates();
    } catch (e) {
      console.error('Archive email template failed:', e);
      setError(locale === 'ru' ? 'Не удалось архивировать шаблон.' : 'Failed to archive template.');
    }
  };

  if (loading || !user || !isAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="signal-page-shell admin-control-page">
        <EmptyState
          title={locale === 'ru' ? 'Доступ запрещён' : 'Access denied'}
          description={locale === 'ru' ? 'Управление шаблонами доступно только платформенным администраторам.' : 'Template management is only available to platform administrators.'}
        />
      </div>
    );
  }

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={t('admin.templates') ?? 'Templates'}
        subtitle={locale === 'ru' ? 'Рабочие email шаблоны для рассылок' : 'Working email templates for broadcasts'}
        actions={<button className="btn btn-primary btn-sm" onClick={startCreate}>{locale === 'ru' ? 'Создать шаблон' : 'Create template'}</button>}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {showComposer ? (
        <Panel variant="elevated" className="admin-command-panel">
          <div className="signal-section-header">
            <div>
              <h2>{composerTitle}</h2>
              <p className="signal-muted">{locale === 'ru' ? 'Текстовая версия обязательна; HTML можно оставить пустым, он будет собран из текста.' : 'Text body is required; HTML can be generated from it.'}</p>
            </div>
          </div>

          <div className="admin-email-form-grid">
            <label>
              <span>{locale === 'ru' ? 'Название' : 'Name'}</span>
              <FieldInput value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </label>
            <label>
              <span>{locale === 'ru' ? 'Ключ' : 'Key'}</span>
              <FieldInput value={form.key} onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))} placeholder="season-announcement" />
            </label>
            <label>
              <span>{locale === 'ru' ? 'Тема письма' : 'Subject'}</span>
              <FieldInput value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} />
            </label>
            <label>
              <span>{locale === 'ru' ? 'Статус' : 'Status'}</span>
              <FieldSelect value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="draft">{locale === 'ru' ? 'Черновик' : 'Draft'}</option>
                <option value="active">{locale === 'ru' ? 'Активный' : 'Active'}</option>
                <option value="archived">{locale === 'ru' ? 'Архив' : 'Archived'}</option>
              </FieldSelect>
            </label>
            <label className="admin-email-form-wide">
              <span>Preheader</span>
              <FieldInput value={form.preheader} onChange={(e) => setForm((prev) => ({ ...prev, preheader: e.target.value }))} />
            </label>
            <label className="admin-email-form-wide">
              <span>{locale === 'ru' ? 'Текст письма' : 'Text body'}</span>
              <FieldTextarea rows={8} value={form.textBody} onChange={(e) => setForm((prev) => ({ ...prev, textBody: e.target.value }))} placeholder="{{name}}, {{email}}" />
            </label>
            <label className="admin-email-form-wide">
              <span>HTML</span>
              <FieldTextarea rows={8} value={form.htmlBody} onChange={(e) => setForm((prev) => ({ ...prev, htmlBody: e.target.value }))} />
            </label>
          </div>

          <div className="signal-row-actions">
            <button className="btn btn-primary btn-sm" onClick={() => void submitTemplate()} disabled={saving}>{saving ? '...' : locale === 'ru' ? 'Сохранить' : 'Save'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowComposer(false)} disabled={saving}>{locale === 'ru' ? 'Отмена' : 'Cancel'}</button>
          </div>
        </Panel>
      ) : null}

      <Panel variant="elevated" className="admin-command-panel">
        <ToolbarRow>
          <AdminToolbarSearch
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по названию, ключу или теме...' : 'Search by name, key, or subject...'}
          />
          <AdminToolbarSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
            <option value="active">{locale === 'ru' ? 'Активные' : 'Active'}</option>
            <option value="draft">{locale === 'ru' ? 'Черновики' : 'Drafts'}</option>
            <option value="archived">{locale === 'ru' ? 'Архивные' : 'Archived'}</option>
          </AdminToolbarSelect>
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={6} />
        ) : templates.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет шаблонов' : 'No templates'}
            description={locale === 'ru' ? 'Создайте первый email шаблон для рассылок.' : 'Create the first email template for broadcasts.'}
            actions={<button className="btn btn-secondary btn-sm" onClick={startCreate}>{locale === 'ru' ? 'Создать шаблон' : 'Create template'}</button>}
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Название' : 'Name'}</th>
                  <th>{locale === 'ru' ? 'Ключ' : 'Key'}</th>
                  <th>{locale === 'ru' ? 'Тема' : 'Subject'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{locale === 'ru' ? 'Обновлено' : 'Updated'}</th>
                  <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tmpl) => (
                  <tr key={tmpl.id}>
                    <td><strong>{tmpl.name}</strong></td>
                    <td className="signal-muted signal-overflow-ellipsis">{tmpl.key}</td>
                    <td className="signal-overflow-ellipsis">{tmpl.subject}</td>
                    <td><StatusBadge tone={toneByStatus[tmpl.status] ?? 'neutral'}>{tmpl.status}</StatusBadge></td>
                    <td className="signal-muted">{new Date(tmpl.updatedAt).toLocaleDateString()}</td>
                    <td className="right">
                      <div className="signal-row-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => startEdit(tmpl)}>{locale === 'ru' ? 'Редактировать' : 'Edit'}</button>
                        {tmpl.status !== 'archived' ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => void archiveTemplate(tmpl.id)}>{locale === 'ru' ? 'В архив' : 'Archive'}</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}
