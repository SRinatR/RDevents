'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SystemReportTemplate, BuilderConfig } from '@/lib/api';

interface SystemReportTemplatesPanelProps {
  templates: SystemReportTemplate[];
  loading: boolean;
  onLoad: (template: SystemReportTemplate) => void;
  onSave: (name: string, description?: string, isDefault?: boolean) => Promise<void> | void;
  onDelete: (templateId: string) => Promise<void> | void;
  onSetDefault: (templateId: string) => Promise<void> | void;
  currentConfig: BuilderConfig | null;
}

export function SystemReportTemplatesPanel({
  templates,
  loading,
  onLoad,
  onSave,
  onDelete,
  onSetDefault,
  currentConfig,
}: SystemReportTemplatesPanelProps) {
  const t = useTranslations('admin.templates');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateActionLoading, setTemplateActionLoading] = useState<string | null>(null);

  const resetDialog = useCallback(() => {
    setNewName('');
    setNewDescription('');
    setNewIsDefault(false);
    setShowSaveDialog(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!newName.trim()) return;
    setTemplateError(null);
    setSaveLoading(true);
    try {
      await onSave(newName.trim(), newDescription.trim() || undefined, newIsDefault);
      resetDialog();
    } catch (error) {
      console.error('Save template failed:', error);
      setTemplateError(t('saveError') || 'Failed to save template.');
    } finally {
      setSaveLoading(false);
    }
  }, [newName, newDescription, newIsDefault, onSave, resetDialog, t]);

  const handleDelete = useCallback(async (templateId: string) => {
    setTemplateError(null);
    setTemplateActionLoading(`delete:${templateId}`);
    try {
      await onDelete(templateId);
      setConfirmDelete(null);
    } catch (error) {
      console.error('Delete template failed:', error);
      setTemplateError(t('deleteError') || 'Failed to delete template.');
    } finally {
      setTemplateActionLoading(null);
    }
  }, [onDelete, t]);

  const handleSetDefault = useCallback(async (templateId: string) => {
    setTemplateError(null);
    setTemplateActionLoading(`default:${templateId}`);
    try {
      await onSetDefault(templateId);
    } catch (error) {
      console.error('Set default template failed:', error);
      setTemplateError(t('defaultError') || 'Failed to update default template.');
    } finally {
      setTemplateActionLoading(null);
    }
  }, [onSetDefault, t]);

  return (
    <div className="sr-templates-panel">
      <div className="panel-header">
        <h3>{t('title') || 'Templates'}</h3>
        <button
          className="save-template-btn"
          onClick={() => {
            setTemplateError(null);
            setShowSaveDialog(true);
          }}
          disabled={!currentConfig}
        >
          💾 {t('save') || 'Save'}
        </button>
      </div>

      {templateError && (
        <div className="error-banner sr-template-error">
          <span className="error-icon">⚠</span>
          <span>{templateError}</span>
        </div>
      )}

      {showSaveDialog && (
        <div className="save-dialog">
          <h4>{t('saveAsTitle') || 'Save as Template'}</h4>
          <label className="dialog-field">
            <span>{t('name') || 'Name'}</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('namePlaceholder') || 'Template name'}
            />
          </label>
          <label className="dialog-field">
            <span>{t('description') || 'Description'}</span>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder') || 'Description (optional)'}
            />
          </label>
          <label className="dialog-checkbox">
            <input
              type="checkbox"
              checked={newIsDefault}
              onChange={(e) => setNewIsDefault(e.target.checked)}
            />
            <span>{t('setAsDefault') || 'Set as default'}</span>
          </label>
          <div className="dialog-actions">
            <button onClick={resetDialog} disabled={saveLoading}>
              {t('cancel') || 'Cancel'}
            </button>
            <button className="primary" onClick={handleSave} disabled={saveLoading || !newName.trim()}>
              {saveLoading ? t('saving') || 'Saving...' : t('save') || 'Save'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="templates-loading">
          <span className="loading-spinner" />
        </div>
      ) : templates.length === 0 ? (
        <p className="templates-empty-hint">
          {t('noTemplates') || 'No saved templates'}
        </p>
      ) : (
        <ul className="templates-list">
          {templates.map((template) => (
            <li key={template.id} className={`template-item ${template.isDefault ? 'is-default' : ''}`}>
              <div className="template-info">
                <span className="template-name">
                  {template.name}
                  {template.isDefault && <span className="default-badge">{t('defaultBadge') || 'Default'}</span>}
                </span>
                {template.description && (
                  <span className="template-description">{template.description}</span>
                )}
              </div>
              <div className="template-actions">
                <button
                  className="template-action load-btn"
                  onClick={() => onLoad(template)}
                  title={t('loadTitle') || 'Load into builder'}
                >
                  📂
                </button>
                {!template.isDefault && (
                  <button
                    className="template-action default-btn"
                    onClick={() => handleSetDefault(template.id)}
                    disabled={templateActionLoading === `default:${template.id}`}
                    title={t('setDefaultTitle') || 'Set as default'}
                  >
                    {templateActionLoading === `default:${template.id}` ? '...' : '★'}
                  </button>
                )}
                {confirmDelete === template.id ? (
                  <>
                    <button
                      className="template-action confirm-delete-btn"
                      onClick={() => handleDelete(template.id)}
                      disabled={templateActionLoading === `delete:${template.id}`}
                      title={t('confirmDeleteTitle') || 'Confirm delete'}
                    >
                      {templateActionLoading === `delete:${template.id}` ? '...' : '✓'}
                    </button>
                    <button
                      className="template-action cancel-delete-btn"
                      onClick={() => setConfirmDelete(null)}
                      title={t('cancel') || 'Cancel'}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <button
                    className="template-action delete-btn"
                    onClick={() => setConfirmDelete(template.id)}
                    title={t('deleteTitle') || 'Delete'}
                  >
                    🗑
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
