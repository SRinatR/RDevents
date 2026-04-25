'use client';

import { useState, useCallback } from 'react';
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
  const t = useTranslations('admin.systemReports.builder');
  const [preview, setPreview] = useState<SystemReportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);

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
            {previewLoading ? '...' : '👁'} {t('preview') || 'Preview'}
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
