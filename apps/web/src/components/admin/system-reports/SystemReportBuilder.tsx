'use client';

import { useState, useCallback } from 'react';
import type {
  SystemReportConfigResponse,
  SystemReportSectionDefinition,
  BuilderConfig,
  SystemReportPreview,
  SystemReportTemplate,
} from '@/lib/api';
import { SystemReportSectionCard } from './SystemReportSectionCard';
import { SystemReportPreviewPanel } from './SystemReportPreviewPanel';

interface SystemReportBuilderProps {
  config: SystemReportConfigResponse | null;
  onPreview: (cfg: BuilderConfig) => Promise<SystemReportPreview | null>;
  onRunNow: (cfg: BuilderConfig) => Promise<void>;
  onSaveTemplate: (name: string, description?: string) => Promise<void>;
  onReset: () => void;
  initialConfig?: BuilderConfig | null;
  locale: string;
}

interface SectionState {
  key: string;
  enabled: boolean;
  options: Record<string, unknown>;
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
  onPreview,
  onRunNow,
  onSaveTemplate,
  onReset,
  initialConfig,
  locale,
}: SystemReportBuilderProps) {
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<'txt' | 'json' | 'md' | 'zip'>('txt');
  const [redactionLevel, setRedactionLevel] = useState<'strict' | 'standard' | 'off'>('standard');
  const [sections, setSections] = useState<SectionState[]>(() => {
    if (!config) return [];
    return config.sections.map((s) => ({
      key: s.key,
      enabled: true,
      options: Object.fromEntries(s.options.map((o) => [o.key, o.default])),
    }));
  });
  const [preview, setPreview] = useState<SystemReportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  const loadFromTemplate = useCallback((template: SystemReportTemplate) => {
    const cfg = template.config;
    setTitle('');
    setFormat(cfg.format);
    setRedactionLevel(cfg.redactionLevel || 'standard');
    setSections(
      config?.sections.map((s) => {
        const existing = cfg.sections.find((cs) => cs.key === s.key);
        return {
          key: s.key,
          enabled: existing?.enabled ?? true,
          options: existing?.options ?? Object.fromEntries(s.options.map((o) => [o.key, o.default])),
        };
      }) ?? []
    );
    setPreview(null);
  }, [config]);

  const handleToggleSection = useCallback((key: string, enabled: boolean) => {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, enabled } : s)));
    setPreview(null);
  }, []);

  const handleOptionChange = useCallback((key: string, optionKey: string, value: unknown) => {
    setSections((prev) =>
      prev.map((s) =>
        s.key === key ? { ...s, options: { ...s.options, [optionKey]: value } } : s
      )
    );
    setPreview(null);
  }, []);

  const buildConfig = useCallback((): BuilderConfig => ({
    format,
    sections: sections.map((s) => ({ key: s.key, enabled: s.enabled, options: s.options })),
    redactionLevel,
  }), [format, sections, redactionLevel]);

  const handlePreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const result = await onPreview(buildConfig());
      setPreview(result);
    } catch (e) {
      console.error('Preview failed:', e);
    } finally {
      setPreviewLoading(false);
    }
  }, [buildConfig, onPreview]);

  const handleRunNow = useCallback(async () => {
    setRunLoading(true);
    try {
      await onRunNow(buildConfig());
    } catch (e) {
      console.error('Run failed:', e);
    } finally {
      setRunLoading(false);
    }
  }, [buildConfig, onRunNow]);

  const handleSave = useCallback(async () => {
    if (!saveName.trim()) return;
    try {
      await onSaveTemplate(saveName.trim(), saveDescription.trim() || undefined);
      setSaveName('');
      setSaveDescription('');
      setShowSaveDialog(false);
    } catch (e) {
      console.error('Save template failed:', e);
    }
  }, [saveName, saveDescription, onSaveTemplate]);

  const handleReset = useCallback(() => {
    setTitle('');
    setFormat('txt');
    setRedactionLevel('standard');
    setSections(
      config?.sections.map((s) => ({
        key: s.key,
        enabled: true,
        options: Object.fromEntries(s.options.map((o) => [o.key, o.default])),
      })) ?? []
    );
    setPreview(null);
    onReset();
  }, [config, onReset]);

  if (!config) {
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
              onChange={(e) => setTitle(e.target.value)}
              placeholder={locale === 'ru' ? 'Название отчёта (опц.)' : 'Report title (optional)'}
            />
          </label>

          <label className="builder-field">
            <span className="field-label">Format</span>
            <select
              className="field-select"
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
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
              value={redactionLevel}
              onChange={(e) => setRedactionLevel(e.target.value as typeof redactionLevel)}
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
                  const state = sections.find((s) => s.key === sectionDef.key);
                  return (
                    <SystemReportSectionCard
                      key={sectionDef.key}
                      section={sectionDef}
                      enabled={state?.enabled ?? false}
                      options={state?.options ?? {}}
                      onToggle={(enabled) => handleToggleSection(sectionDef.key, enabled)}
                      onOptionsChange={(key, value) => handleOptionChange(sectionDef.key, key, value)}
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
          <button className="action-btn reset-btn" onClick={handleReset}>
            ↺ {locale === 'ru' ? 'Сброс' : 'Reset'}
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
