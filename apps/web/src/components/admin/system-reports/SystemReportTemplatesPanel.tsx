'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SystemReportTemplate, BuilderConfig } from '@/lib/api';

interface SystemReportTemplatesPanelProps {
  templates: SystemReportTemplate[];
  loading: boolean;
  onLoad: (template: SystemReportTemplate) => void;
  onSave: (name: string, description?: string, isDefault?: boolean) => void;
  onDelete: (templateId: string) => void;
  onSetDefault: (templateId: string) => void;
  currentConfig: BuilderConfig | null;
  locale: string;
}

export function SystemReportTemplatesPanel({
  templates,
  loading,
  onLoad,
  onSave,
  onDelete,
  onSetDefault,
  currentConfig,
  locale,
}: SystemReportTemplatesPanelProps) {
  const t = useTranslations('admin.systemReports.templates');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleSave = () => {
    if (!newName.trim()) return;
    onSave(newName.trim(), newDescription.trim() || undefined, newIsDefault);
    setNewName('');
    setNewDescription('');
    setNewIsDefault(false);
    setShowSaveDialog(false);
  };

  const handleDelete = (templateId: string) => {
    onDelete(templateId);
    setConfirmDelete(null);
  };

  return (
    <div className="sr-templates-panel">
      <div className="panel-header">
        <h3>{t('title') || 'Templates'}</h3>
        <button
          className="save-template-btn"
          onClick={() => setShowSaveDialog(true)}
          disabled={!currentConfig}
        >
          💾 {t('save') || 'Save'}
        </button>
      </div>

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
            <button onClick={() => setShowSaveDialog(false)}>
              {t('cancel') || 'Cancel'}
            </button>
            <button className="primary" onClick={handleSave} disabled={!newName.trim()}>
              {t('save') || 'Save'}
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
                    onClick={() => onSetDefault(template.id)}
                    title={t('setDefaultTitle') || 'Set as default'}
                  >
                    ★
                  </button>
                )}
                {confirmDelete === template.id ? (
                  <>
                    <button
                      className="template-action confirm-delete-btn"
                      onClick={() => handleDelete(template.id)}
                      title={t('confirmDeleteTitle') || 'Confirm delete'}
                    >
                      ✓
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
