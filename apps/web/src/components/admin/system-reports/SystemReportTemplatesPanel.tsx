'use client';

import { useState } from 'react';
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
        <h3>Templates</h3>
        <button
          className="save-template-btn"
          onClick={() => setShowSaveDialog(true)}
          disabled={!currentConfig}
        >
          {locale === 'ru' ? '💾 Сохранить' : '💾 Save'}
        </button>
      </div>

      {showSaveDialog && (
        <div className="save-dialog">
          <h4>{locale === 'ru' ? 'Сохранить как шаблон' : 'Save as Template'}</h4>
          <label className="dialog-field">
            <span>Name</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={locale === 'ru' ? 'Название шаблона' : 'Template name'}
            />
          </label>
          <label className="dialog-field">
            <span>Description</span>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={locale === 'ru' ? 'Описание (опц.)' : 'Description (optional)'}
            />
          </label>
          <label className="dialog-checkbox">
            <input
              type="checkbox"
              checked={newIsDefault}
              onChange={(e) => setNewIsDefault(e.target.checked)}
            />
            <span>{locale === 'ru' ? 'По умолчанию' : 'Set as default'}</span>
          </label>
          <div className="dialog-actions">
            <button onClick={() => setShowSaveDialog(false)}>
              {locale === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
            <button className="primary" onClick={handleSave} disabled={!newName.trim()}>
              {locale === 'ru' ? 'Сохранить' : 'Save'}
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
          {locale === 'ru' ? 'Нет сохранённых шаблонов' : 'No saved templates'}
        </p>
      ) : (
        <ul className="templates-list">
          {templates.map((template) => (
            <li key={template.id} className={`template-item ${template.isDefault ? 'is-default' : ''}`}>
              <div className="template-info">
                <span className="template-name">
                  {template.name}
                  {template.isDefault && <span className="default-badge">Default</span>}
                </span>
                {template.description && (
                  <span className="template-description">{template.description}</span>
                )}
              </div>
              <div className="template-actions">
                <button
                  className="template-action load-btn"
                  onClick={() => onLoad(template)}
                  title={locale === 'ru' ? 'Загрузить в конструктор' : 'Load into builder'}
                >
                  {locale === 'ru' ? '📂' : '📂'}
                </button>
                {!template.isDefault && (
                  <button
                    className="template-action default-btn"
                    onClick={() => onSetDefault(template.id)}
                    title={locale === 'ru' ? 'Сделать по умолчанию' : 'Set as default'}
                  >
                    ★
                  </button>
                )}
                {confirmDelete === template.id ? (
                  <>
                    <button
                      className="template-action confirm-delete-btn"
                      onClick={() => handleDelete(template.id)}
                      title={locale === 'ru' ? 'Подтвердить удаление' : 'Confirm delete'}
                    >
                      ✓
                    </button>
                    <button
                      className="template-action cancel-delete-btn"
                      onClick={() => setConfirmDelete(null)}
                      title={locale === 'ru' ? 'Отмена' : 'Cancel'}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <button
                    className="template-action delete-btn"
                    onClick={() => setConfirmDelete(template.id)}
                    title={locale === 'ru' ? 'Удалить' : 'Delete'}
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
