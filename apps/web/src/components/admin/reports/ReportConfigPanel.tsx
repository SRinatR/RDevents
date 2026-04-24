'use client';

import { useState } from 'react';
import type { ReportSection, ReportConfig, ReportSectionConfig, SystemReportGeneration } from '@/lib/api';
import { Panel, StatusBadge } from '@/components/ui/signal-primitives';

interface ReportConfigPanelProps {
  config: ReportConfig | null;
  sections: ReportSection[];
  onUpdate: (config: ReportConfig) => void;
  generating: boolean;
  activeGeneration: SystemReportGeneration | null;
  onGenerate: () => void;
  onSaveAsTemplate: (name: string, description?: string) => void;
  t: (key: string) => string;
  locale: string;
}

export function ReportConfigPanel({
  config,
  sections,
  onUpdate,
  generating,
  activeGeneration,
  onGenerate,
  onSaveAsTemplate,
  t,
  locale,
}: ReportConfigPanelProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  if (!config) {
    return (
      <Panel variant="elevated" className="config-panel">
        <div className="panel-placeholder">
          <p>{locale === 'ru' ? 'Выберите шаблон или создайте новый' : 'Select a template or create a new one'}</p>
        </div>
      </Panel>
    );
  }

  const updateSection = (key: string, updates: Partial<ReportSectionConfig>) => {
    const updatedSections = config.sections.map((s) =>
      s.key === key ? { ...s, ...updates } : s
    );
    onUpdate({ ...config, sections: updatedSections });
  };

  const toggleSection = (key: string) => {
    const section = config.sections.find((s) => s.key === key);
    if (section) {
      updateSection(key, { enabled: !section.enabled });
    }
  };

  const getSectionConfig = (key: string) => {
    return config.sections.find((s) => s.key === key);
  };

  const getProgressText = () => {
    if (!activeGeneration) return '';
    const status = activeGeneration.status;
    switch (status) {
      case 'queued':
        return locale === 'ru' ? 'Ожидает запуска...' : 'Queued...';
      case 'running':
        return `${locale === 'ru' ? 'Генерация' : 'Generating'}: ${activeGeneration.progress}%`;
      case 'success':
        return locale === 'ru' ? 'Готов к скачиванию' : 'Ready to download';
      case 'failed':
        return `${locale === 'ru' ? 'Ошибка' : 'Failed'}: ${activeGeneration.errorMessage || 'Unknown error'}`;
      default:
        return '';
    }
  };

  const isGenerating = activeGeneration && (activeGeneration.status === 'queued' || activeGeneration.status === 'running');

  return (
    <Panel variant="elevated" className="config-panel">
      <div className="panel-header">
        <h3>{t('configuration')}</h3>
      </div>

      <div className="config-sections">
        <div className="config-section">
          <h4>{t('sections')}</h4>
          <div className="sections-list">
            {sections.map((section) => {
              const sectionConfig = getSectionConfig(section.key);
              const enabled = Boolean(sectionConfig?.enabled);

              return (
                <div key={section.key} className="section-item">
                  <div className="section-item-header">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={enabled as boolean}
                        onChange={() => toggleSection(section.key)}
                        disabled={isGenerating as boolean}
                      />
                      <span className="section-title">{section.label}</span>
                    </label>
                  </div>
                  <p className="section-description">{section.description}</p>

                  {enabled && sectionConfig && (
                    <SectionParams
                      section={section}
                      params={sectionConfig.params}
                      onUpdate={(params) => updateSection(section.key, { params }) as void}
                      disabled={isGenerating as boolean}
                      locale={locale}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="config-section">
          <h4>{t('outputFormat')}</h4>
          <div className="format-selector">
            {(['txt', 'json', 'md', 'zip'] as const).map((format) => (
              <label key={format} className="format-option">
                <input
                type="radio"
                name="format"
                value={format}
                checked={config.format === format}
                onChange={() => onUpdate({ ...config, format })}
                disabled={isGenerating as boolean}
              />
                <span className="format-label">
                  {format.toUpperCase()}
                  {format === 'zip' && (
                    <span className="format-badge">{locale === 'ru' ? 'Рекомендуется' : 'Recommended'}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="config-section">
          <h4>{t('security')}</h4>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(config.maskSensitiveData) as boolean}
              onChange={(e) => onUpdate({ ...config, maskSensitiveData: e.target.checked as boolean })}
              disabled={isGenerating as boolean}
            />
            <span>{locale === 'ru' ? 'Маскировать чувствительные данные' : 'Mask sensitive data'}</span>
          </label>
        </div>

        {activeGeneration && activeGeneration.status === 'running' && (
          <div className="config-section generation-progress">
            <h4>{t('progress')}</h4>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${activeGeneration.progress}%` }} />
            </div>
            <p className="progress-text">{getProgressText()}</p>

            {activeGeneration.sections && activeGeneration.sections.length > 0 && (
              <div className="section-progress-list">
                {activeGeneration.sections.map((s) => (
                  <div key={s.key} className="section-progress-item">
                    <span className="section-progress-name">{s.label}</span>
                    <StatusBadge tone={s.status === 'completed' ? 'success' : s.status === 'running' ? 'info' : s.status === 'failed' ? 'danger' : 'neutral'}>
                      {s.status}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="config-actions">
        <button
          className="btn btn-secondary"
          onClick={() => setShowSaveDialog(true)}
          disabled={isGenerating as boolean}
        >
          {t('saveAsTemplate')}
        </button>
        <button
          className="btn btn-primary"
          onClick={onGenerate}
          disabled={(generating || isGenerating || config.sections.filter(s => Boolean(s.enabled)).length === 0) as boolean}
        >
          {generating ? t('generating') : t('generate')}
        </button>
      </div>

      {showSaveDialog && (
        <div className="save-dialog-overlay" onClick={() => setShowSaveDialog(false)}>
          <div className="save-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{t('saveAsTemplate')}</h3>
            <div className="form-field">
              <label>{locale === 'ru' ? 'Название' : 'Name'}</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={locale === 'ru' ? 'Мой шаблон' : 'My template'}
              />
            </div>
            <div className="form-field">
              <label>{locale === 'ru' ? 'Описание (опц.)' : 'Description (opt.)'}</label>
              <textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder={locale === 'ru' ? 'Опишите шаблон' : 'Describe this template'}
              />
            </div>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setShowSaveDialog(false)}>
                {locale === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onSaveAsTemplate(templateName, templateDescription);
                  setShowSaveDialog(false);
                  setTemplateName('');
                  setTemplateDescription('');
                }}
                disabled={!templateName.trim()}
              >
                {locale === 'ru' ? 'Сохранить' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

interface SectionParamsProps {
  section: ReportSection;
  params: Record<string, unknown>;
  onUpdate: (params: Record<string, unknown>) => void;
  disabled: boolean;
  locale: string;
}

function SectionParams({ section, params, onUpdate, disabled, locale }: SectionParamsProps) {
  const renderParam = (key: string, value: unknown) => {
    const paramKey = key as keyof typeof section.defaultParams;

    if (typeof value === 'boolean' || value === null) {
      return (
        <label key={key} className="param-checkbox">
          <input
            type="checkbox"
            checked={value ?? false}
            onChange={(e) => onUpdate({ ...params, [key]: e.target.checked })}
            disabled={disabled}
          />
          <span>{formatParamLabel(key, locale)}</span>
        </label>
      );
    }

    if (typeof value === 'number') {
      const options = section.defaultParams[paramKey];
      if (Array.isArray(options)) {
        return (
          <div key={key} className="param-select">
            <label>{formatParamLabel(key, locale)}</label>
            <select
              value={value}
              onChange={(e) => onUpdate({ ...params, [key]: parseInt(e.target.value) })}
              disabled={disabled}
            >
              {options.map((opt: number) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );
      }
      return (
        <div key={key} className="param-number">
          <label>{formatParamLabel(key, locale)}</label>
          <input
            type="number"
            value={value}
            onChange={(e) => onUpdate({ ...params, [key]: parseInt(e.target.value) })}
            disabled={disabled}
          />
        </div>
      );
    }

    if (typeof value === 'string') {
      const options = section.defaultParams[paramKey];
      if (Array.isArray(options)) {
        return (
          <div key={key} className="param-select">
            <label>{formatParamLabel(key, locale)}</label>
            <select
              value={value}
              onChange={(e) => onUpdate({ ...params, [key]: e.target.value })}
              disabled={disabled}
            >
              {options.map((opt: string) => (
                <option key={opt} value={opt}>{formatOptionLabel(opt, locale)}</option>
              ))}
            </select>
          </div>
        );
      }
      return (
        <div key={key} className="param-text">
          <label>{formatParamLabel(key, locale)}</label>
          <input
            type="text"
            value={value}
            onChange={(e) => onUpdate({ ...params, [key]: e.target.value })}
            disabled={disabled}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="section-params">
      {Object.entries(params).map(([key, value]) => renderParam(key, value))}
    </div>
  );
}

function formatParamLabel(key: string, locale: string): string {
  const labels: Record<string, { en: string; ru: string }> = {
    deployHistoryLimit: { en: 'Deploy history limit', ru: 'Лимит истории deploy' },
    includeLogs: { en: 'Include logs', ru: 'Включить логи' },
    logLines: { en: 'Log lines', ru: 'Строк логов' },
    includeImageDigests: { en: 'Include image digests', ru: 'Включить digest образов' },
    includeFailedOnly: { en: 'Failed units only', ru: 'Только failed units' },
    detailLevel: { en: 'Detail level', ru: 'Уровень детализации' },
    includeSlowQueries: { en: 'Include slow queries', ru: 'Включить медленные запросы' },
    slowQueryThreshold: { en: 'Slow query threshold (ms)', ru: 'Порог медленных запросов (мс)' },
    largeFileThreshold: { en: 'Large file threshold (MB)', ru: 'Порог больших файлов (МБ)' },
    redactionLevel: { en: 'Redaction level', ru: 'Уровень маскирования' },
    timeWindow: { en: 'Time window', ru: 'Временное окно' },
    limit: { en: 'Limit', ru: 'Лимит' },
    includeBuildMetadata: { en: 'Include build metadata', ru: 'Включить метаданные сборки' },
  };

  return labels[key]?.[locale === 'ru' ? 'ru' : 'en'] || key;
}

function formatOptionLabel(option: string, locale: string): string {
  const labels: Record<string, { en: string; ru: string }> = {
    summary: { en: 'Summary', ru: 'Кратко' },
    detailed: { en: 'Detailed', ru: 'Подробно' },
    basic: { en: 'Basic', ru: 'Базовый' },
    strict: { en: 'Strict', ru: 'Строгий' },
    standard: { en: 'Standard', ru: 'Стандартный' },
    '1h': { en: 'Last hour', ru: 'Последний час' },
    '24h': { en: 'Last 24 hours', ru: 'Последние 24 часа' },
    '7d': { en: 'Last 7 days', ru: 'Последние 7 дней' },
  };

  return labels[option]?.[locale === 'ru' ? 'ru' : 'en'] || option;
}
