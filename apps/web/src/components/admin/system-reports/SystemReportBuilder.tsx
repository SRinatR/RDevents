'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
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

const CATEGORY_LABELS_I18N: Record<string, string> = {
  system: 'category.system',
  application: 'category.application',
  infrastructure: 'category.infrastructure',
  security: 'category.security',
};

const DEPENDENCY_HINTS: Array<{
  key: string;
  when: (enabled: Set<string>, value: BuilderConfig) => boolean;
}> = [
  {
    key: 'dockerWithoutSystemd',
    when: (enabled) => enabled.has('docker') && !enabled.has('systemd'),
  },
  {
    key: 'systemdWithoutDocker',
    when: (enabled) => enabled.has('systemd') && !enabled.has('docker'),
  },
  {
    key: 'databaseWithoutHealth',
    when: (enabled) => enabled.has('database') && !enabled.has('health'),
  },
  {
    key: 'securityWithoutRelease',
    when: (enabled) => enabled.has('security') && !enabled.has('release'),
  },
  {
    key: 'redactionOff',
    when: (_enabled, value) => value.redactionLevel === 'off',
  },
];

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
  const t = useTranslations('admin.builder');
  const [preview, setPreview] = useState<SystemReportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [saveTemplateLoading, setSaveTemplateLoading] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);

  const selectedSections = useMemo(() => {
    if (!config || !value) return [];
    const enabledByKey = new Map(value.sections.map((section) => [section.key, section.enabled]));
    return config.sections.filter((section) => enabledByKey.get(section.key));
  }, [config, value]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const section of selectedSections) {
      counts.set(section.category, (counts.get(section.category) ?? 0) + 1);
    }
    return counts;
  }, [selectedSections]);

  const dependencyHintKeys = useMemo(() => {
    if (!value) return [];
    const enabled = new Set(selectedSections.map((section) => section.key));
    return DEPENDENCY_HINTS.filter((hint) => hint.when(enabled, value)).map((hint) => hint.key);
  }, [selectedSections, value]);

  const handleFormatChange = useCallback((format: BuilderConfig['format']) => {
    if (!value) return;
    onChange({ ...value, format });
    setPreview(null);
  }, [value, onChange]);

  const handleRedactionLevelChange = useCallback((redactionLevel: BuilderConfig['redactionLevel']) => {
    if (!value) return;
    onChange({ ...value, redactionLevel: redactionLevel || 'standard' });
  }, [value, onChange]);

  const handleDateRangeChange = useCallback(
    (patch: { start?: string; end?: string }) => {
      if (!value) return;

      onChange({
        ...value,
        dateRange: {
          ...value.dateRange,
          ...patch,
        },
      });
      setPreview(null);
    },
    [value, onChange]
  );

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
    setBuilderError(null);
    setPreviewLoading(true);
    try {
      const result = await onPreview(value);
      setPreview(result);
    } catch (e) {
      console.error('Preview failed:', e);
      setBuilderError(t('previewError') || 'Failed to generate report preview.');
    } finally {
      setPreviewLoading(false);
    }
  }, [value, onPreview, t]);

  const handleRunNow = useCallback(async () => {
    if (!value) return;
    setBuilderError(null);
    setRunLoading(true);
    try {
      await onRunNow(value, title);
    } catch (e) {
      console.error('Run failed:', e);
      setBuilderError(t('runError') || 'Failed to start report run.');
    } finally {
      setRunLoading(false);
    }
  }, [value, title, onRunNow, t]);

  const handleSaveTemplate = useCallback(async () => {
    const templateName = title.trim();

    if (!templateName) {
      setBuilderError(t('templateNameRequired') || 'Enter a title before saving a template.');
      return;
    }

    setBuilderError(null);
    setSaveTemplateLoading(true);

    try {
      await onSaveTemplate(templateName, undefined, false);
    } catch (e) {
      console.error('Save template failed:', e);
      setBuilderError(t('saveTemplateError') || 'Failed to save template.');
    } finally {
      setSaveTemplateLoading(false);
    }
  }, [title, onSaveTemplate, t]);

  if (!config || !value) {
    return (
      <div className="sr-builder loading">
        <div className="builder-loading">
          <span className="loading-spinner" />
          {t('loading') || 'Loading configuration...'}
        </div>
      </div>
    );
  }

  const groupedSections = groupSectionsByCategory(config.sections);
  const categories = Object.keys(groupedSections);
  const formatLabel = config.formats.find((format) => format.value === value.format)?.label ?? value.format.toUpperCase();
  const redactionLabel =
    config.redactionLevels.find((redaction) => redaction.value === (value.redactionLevel || 'standard'))?.label ??
    (value.redactionLevel || 'standard');
  const dateRangeLabel =
    value.dateRange?.start || value.dateRange?.end
      ? `${value.dateRange?.start ? new Date(value.dateRange.start).toLocaleString(locale) : t('notSet')} - ${
          value.dateRange?.end ? new Date(value.dateRange.end).toLocaleString(locale) : t('notSet')
        }`
      : t('notSet');

  return (
    <div className="sr-builder">
      <div className="builder-main">
        <div className="builder-header">
          <h3>{t('title') || 'Builder'}</h3>
        </div>

        {builderError && (
          <div className="error-banner">
            <span className="error-icon">⚠</span>
            <span>{builderError}</span>
          </div>
        )}

        <div className="builder-fields">
          <label className="builder-field">
            <span className="field-label">{t('fieldTitle') || 'Title'}</span>
            <input
              type="text"
              className="field-input"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={t('titlePlaceholder') || 'Report title (optional)'}
            />
          </label>

          <label className="builder-field">
            <span className="field-label">{t('fieldFormat') || 'Format'}</span>
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
            <span className="field-label">{t('fieldRedactionLevel') || 'Redaction Level'}</span>
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

          <div className="builder-field-row">
            <label className="builder-field">
              <span className="field-label">{t('dateFrom') || 'Date from'}</span>
              <input
                type="datetime-local"
                className="field-input"
                value={value.dateRange?.start ? value.dateRange.start.slice(0, 16) : ''}
                onChange={(e) =>
                  handleDateRangeChange({
                    start: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                  })
                }
              />
            </label>

            <label className="builder-field">
              <span className="field-label">{t('dateTo') || 'Date to'}</span>
              <input
                type="datetime-local"
                className="field-input"
                value={value.dateRange?.end ? value.dateRange.end.slice(0, 16) : ''}
                onChange={(e) =>
                  handleDateRangeChange({
                    end: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                  })
                }
              />
            </label>
          </div>
        </div>

        <div className="builder-sections">
          {categories.map((category) => (
            <div key={category} className="section-category">
              <h4 className="category-title">
                {t(CATEGORY_LABELS_I18N[category]) || CATEGORY_LABELS[category] || category}
                <span className="category-count">
                  {categoryCounts.get(category) ?? 0}/{groupedSections[category].length}
                </span>
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

        <div className="builder-summary-panel">
          <div className="builder-summary-header">
            <h4>{t('selectedSummary') || 'Selected report composition'}</h4>
            <span>
              {selectedSections.length}/{config.sections.length} {t('selectedSections') || 'sections'}
            </span>
          </div>

          <div className="builder-summary-grid">
            <div>
              <span>{t('formatSummary') || 'Format'}</span>
              <strong>{formatLabel}</strong>
            </div>
            <div>
              <span>{t('redactionSummary') || 'Redaction'}</span>
              <strong>{redactionLabel}</strong>
            </div>
            <div>
              <span>{t('dateRangeSummary') || 'Date range'}</span>
              <strong>{dateRangeLabel}</strong>
            </div>
          </div>

          {value.format === 'zip' && (
            <p className="builder-summary-note">
              {t('zipBundleHint') || 'ZIP bundle will include report.txt, metadata.json and per-section files.'}
            </p>
          )}

          {dependencyHintKeys.length > 0 && (
            <div className="builder-dependency-hints">
              <span>{t('softDependencies') || 'Composition hints'}</span>
              <ul>
                {dependencyHintKeys.map((key) => (
                  <li key={key}>{t(`dependencies.${key}`)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="builder-actions">
          <button
            className="action-btn preview-btn"
            onClick={handlePreview}
            disabled={previewLoading}
          >
            {previewLoading ? '...' : '👁'} {t('preview') || 'Preview'}
          </button>
          <button
            className="action-btn save-template-btn"
            onClick={handleSaveTemplate}
            disabled={saveTemplateLoading || !title.trim()}
          >
            {saveTemplateLoading ? '...' : '💾'} {t('saveTemplate') || 'Save Template'}
          </button>
          <button
            className="action-btn run-btn"
            onClick={handleRunNow}
            disabled={runLoading}
          >
            {runLoading ? '...' : '▶'} {t('runNow') || 'Run Now'}
          </button>
        </div>
      </div>

      <div className="builder-preview">
        <SystemReportPreviewPanel preview={preview} loading={previewLoading} />
      </div>
    </div>
  );
}
