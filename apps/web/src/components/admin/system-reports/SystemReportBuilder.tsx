'use client';

import { useState, useCallback } from 'react';
import type {
  SystemReportConfigResponse,
  SystemReportSectionDefinition,
  BuilderConfig,
  SystemReportPreview,
} from '@/lib/api';
import { SystemReportSectionCard } from './SystemReportSectionCard';
import { SystemReportPreviewPanel } from './SystemReportPreviewPanel';

interface SystemReportBuilderProps {
  config: SystemReportConfigResponse | null;
  value: BuilderConfig | null;
  title: string;
  onTitleChange: (title: string) => void;
  onChange: (next: BuilderConfig) => void;
  onPreview: (cfg: BuilderConfig) => Promise<SystemReportPreview | null>;
  onRunNow: (cfg: BuilderConfig, title?: string) => Promise<void>;
  onSaveTemplate: (name: string, description?: string, isDefault?: boolean) => Promise<void>;
  locale: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  system: 'System',
  application: 'Application',
  infrastructure: 'Infrastructure',
  security: 'Security',
};

function groupSectionsByCategory(
  sections: SystemReportSectionDefinition[]
): Record<string, SystemReportSectionDefinition[]> {
  const groups: Record<string, SystemReportSectionDefinition[]> = {};
  for (const section of sections) {
    const cat = section.category || 'system';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(section);
  }
  return groups;
}

export function SystemReportBuilder({
  config,
  value,
  title,
  onTitleChange,
  onChange,
  onPreview,
  onRunNow,
  onSaveTemplate,
  locale,
}: SystemReportBuilderProps) {
  const [preview, setPreview] = useState<SystemReportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saveIsDefault, setSaveIsDefault] = useState(false);

  const handleFormatChange = useCallback((format: BuilderConfig['format']) => {
    if (!value) return;
    onChange({ ...value, format });
    setPreview(null);
  }, [value, onChange]);

  const handleRedactionLevelChange = useCallback((redactionLevel: BuilderConfig['redactionLevel']) => {
    if (!value) return;
    onChange({ ...value, redactionLevel: redactionLevel || 'standard' });
  }, [value, onChange]);

  const handleToggleSection = useCallback((key: string, enabled: boolean) => {
    if (!value) return;
    onChange({
      ...value,
      sections: value.sections.map((s) => (s.key === key ? { ...s, enabled } : s)),
    });
    setPreview(null);
  }, [value, onChange]);

  const handleOptionChange = useCallback((key: string, optionKey: string, optValue: unknown) => {
    if (!value) return;
    onChange({
      ...value,
      sections: value.sections.map((s) =>
        s.key === key ? { ...s, options: { ...s.options, [optionKey]: optValue } } : s
      ),
    });
    setPreview(null);
  }, [value, onChange]);

  const handlePreview = useCallback(async () => {
    if (!value) return;
    setPreviewLoading(true);
    try {
      const result = await onPreview(value);
      setPreview(result);
    } catch (e) {
      console.error('Preview failed:', e);
    } finally {
      setPreviewLoading(false);
    }
  }, [value, onPreview]);

  const handleRunNow = useCallback(async () => {
    if (!value) return;
    setRunLoading(true);
    try {
      await onRunNow(value, title);
    } catch (e) {
      console.error('Run failed:', e);
    } finally {
      setRunLoading(false);
    }
  }, [value, title, onRunNow]);

  const handleSave = useCallback(async () => {
    if (!saveName.trim()) return;
    try {
      await onSaveTemplate(saveName.trim(), saveDescription.trim() || undefined, saveIsDefault);
      setSaveName('');
      setSaveDescription('');
      setSaveIsDefault(false);
      setShowSaveDialog(false);
    } catch (e) {
      console.error('Save template failed:', e);
    }
  }, [saveName, saveDescription, saveIsDefault, onSaveTemplate]);

  if (!config || !value) {
    return (
      <div className="sr-builder loading">
        <div className="builder-loading">
          <span className="loading-spinner" />
          Loading configuration...
        </div>
      </div>
    );
  }

  const groupedSections = groupSectionsByCategory(config.sections);
  const categories = Object.keys(groupedSections);

  return (
    <div className="sr-builder">
      <div className="builder-main">
        <div className="builder-header">
          <h3>Builder</h3>
        </div>

        <div className="builder-fields">
          <label className="builder-field">
            <span className="field-label">Title</span>
            <input
              type="text"
              className="field-input"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={locale === 'ru' ? 'Название отчёта (опц.)' : 'Report title (optional)'}
            />
          </label>

          <label className="builder-field">
            <span className="field-label">Format</span>
            <select
              className="field-select"
              value={value.format}
              onChange={(e) => handleFormatChange(e.target.value as BuilderConfig['format'])}
            >
              {config.formats.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <label className="builder-field">
            <span className="field-label">Redaction Level</span>
            <select
              className="field-select"
              value={value.redactionLevel || 'standard'}
              onChange={(e) => handleRedactionLevelChange(e.target.value as BuilderConfig['redactionLevel'])}
            >
              {config.redactionLevels.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="builder-sections">
          {categories.map((category) => (
            <div key={category} className="section-category">
              <h4 className="category-title">
                {CATEGORY_LABELS[category] || category}
              </h4>
              <div className="category-sections">
                {groupedSections[category].map((sectionDef) => {
                  const state = value.sections.find((s) => s.key === sectionDef.key);
                  return (
                    <SystemReportSectionCard
                      key={sectionDef.key}
                      section={sectionDef}
                      enabled={state?.enabled ?? false}
                      options={state?.options ?? {}}
                      onToggle={(enabled) => handleToggleSection(sectionDef.key, enabled)}
                      onOptionsChange={(key, optValue) => handleOptionChange(sectionDef.key, key, optValue)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="builder-actions">
          <button
            className="action-btn preview-btn"
            onClick={handlePreview}
            disabled={previewLoading}
          >
            {previewLoading ? '...' : '👁'} Preview
          </button>
          <button
            className="action-btn run-btn"
            onClick={handleRunNow}
            disabled={runLoading}
          >
            {runLoading ? '...' : '▶'} {locale === 'ru' ? 'Запустить' : 'Run Now'}
          </button>
          <button
            className="action-btn save-btn"
            onClick={() => setShowSaveDialog(true)}
          >
            💾 {locale === 'ru' ? 'Сохранить шаблон' : 'Save as Template'}
          </button>
        </div>

        {showSaveDialog && (
          <div className="save-dialog-overlay">
            <div className="save-dialog">
              <h4>{locale === 'ru' ? 'Сохранить как шаблон' : 'Save as Template'}</h4>
              <label className="dialog-field">
                <span>Name</span>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder={locale === 'ru' ? 'Название шаблона' : 'Template name'}
                />
              </label>
              <label className="dialog-field">
                <span>Description</span>
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder={locale === 'ru' ? 'Описание (опц.)' : 'Description (optional)'}
                />
              </label>
              <label className="dialog-checkbox">
                <input
                  type="checkbox"
                  checked={saveIsDefault}
                  onChange={(e) => setSaveIsDefault(e.target.checked)}
                />
                <span>{locale === 'ru' ? 'По умолчанию' : 'Set as default'}</span>
              </label>
              <div className="dialog-actions">
                <button onClick={() => setShowSaveDialog(false)}>
                  {locale === 'ru' ? 'Отмена' : 'Cancel'}
                </button>
                <button className="primary" onClick={handleSave} disabled={!saveName.trim()}>
                  {locale === 'ru' ? 'Сохранить' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="builder-preview">
        <SystemReportPreviewPanel preview={preview} loading={previewLoading} />
      </div>
    </div>
  );
}
