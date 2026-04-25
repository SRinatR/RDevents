'use client';

import type { ReportSection, ReportConfig, SystemReportGeneration } from '@/lib/api';
import { Panel, StatusBadge } from '@/components/ui/signal-primitives';
import { systemReportApi } from '@/lib/api';

interface ReportPreviewPanelProps {
  config: ReportConfig | null;
  sections: ReportSection[];
  activeGeneration: SystemReportGeneration | null;
  t: (key: string) => string;
  locale: string;
}

export function ReportPreviewPanel({
  config,
  sections,
  activeGeneration,
  t,
  locale,
}: ReportPreviewPanelProps) {
  if (!config) {
    return (
      <Panel variant="elevated" className="preview-panel">
        <div className="panel-placeholder">
          <p>{locale === 'ru' ? 'Выберите шаблон для просмотра' : 'Select a template to preview'}</p>
        </div>
      </Panel>
    );
  }

  const enabledSections = sections.filter((s) => {
    const sectionConfig = config.sections.find((c) => c.key === s.key);
    return sectionConfig?.enabled;
  });

  const getFormatDescription = (format: string) => {
    const descriptions: Record<string, { en: string; ru: string }> = {
      txt: { en: 'Plain text format', ru: 'Простой текст' },
      json: { en: 'JSON structured data', ru: 'Структурированный JSON' },
      md: { en: 'Markdown format', ru: 'Markdown формат' },
    };
    return descriptions[format]?.[locale === 'ru' ? 'ru' : 'en'] || format;
  };

  const estimateSize = () => {
    let estimate = 0;
    enabledSections.forEach((section) => {
      const sectionConfig = config.sections.find((c) => c.key === section.key);
      if (section.key === 'release') estimate += 5;
      if (section.key === 'health') estimate += 2;
      if (section.key === 'docker') estimate += (sectionConfig?.params as any)?.logLines || 50;
      if (section.key === 'systemd') estimate += 3;
      if (section.key === 'database') estimate += (config.detailLevel === 'detailed' ? 10 : 3);
      if (section.key === 'storage') estimate += 2;
      if (section.key === 'security') estimate += 1;
      if (section.key === 'performance') estimate += 2;
      if (section.key === 'audit') estimate += (sectionConfig?.params as any)?.limit || 20;
    });

    if (config.format === 'json') estimate = Math.floor(estimate * 1.2);

    if (estimate < 10) return `~${estimate} KB`;
    return `~${Math.floor(estimate / 10) * 10} KB`;
  };

  const isGenerating = activeGeneration && (activeGeneration.status === 'queued' || activeGeneration.status === 'running');
  const isReady = activeGeneration && activeGeneration.status === 'success';

  return (
    <Panel variant="elevated" className="preview-panel">
      <div className="panel-header">
        <h3>{t('preview')}</h3>
      </div>

      <div className="preview-content">
        {activeGeneration && (
          <div className="generation-status">
            <div className="status-row">
              <span className="status-label">{t('status')}:</span>
              <StatusBadge
                tone={
                  activeGeneration.status === 'success' ? 'success' :
                  activeGeneration.status === 'running' ? 'info' :
                  activeGeneration.status === 'failed' ? 'danger' :
                  'neutral'
                }
              >
                {activeGeneration.status === 'queued' && (locale === 'ru' ? 'В очереди' : 'Queued')}
                {activeGeneration.status === 'running' && (locale === 'ru' ? 'Генерация' : 'Running')}
                {activeGeneration.status === 'success' && (locale === 'ru' ? 'Готов' : 'Ready')}
                {activeGeneration.status === 'failed' && (locale === 'ru' ? 'Ошибка' : 'Failed')}
              </StatusBadge>
            </div>

            {activeGeneration.progress > 0 && (
              <div className="status-row">
                <span className="status-label">{t('progress')}:</span>
                <span>{activeGeneration.progress}%</span>
              </div>
            )}

            {isReady && (
              <button
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  const fileName = `system-report-${activeGeneration.id}.${activeGeneration.format}`;
                  await systemReportApi.downloadGeneration(activeGeneration.id, fileName);
                }}
              >
                {locale === 'ru' ? 'Скачать' : 'Download'}
              </button>
            )}
          </div>
        )}

        <div className="preview-section">
          <h4>{locale === 'ru' ? 'Включённые секции' : 'Included Sections'}</h4>
          {enabledSections.length > 0 ? (
            <ul className="preview-sections-list">
              {enabledSections.map((section) => (
                <li key={section.key} className="preview-section-item">
                  <span className="section-icon">✓</span>
                  <span className="section-name">{section.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="preview-empty">{locale === 'ru' ? 'Не выбрано ни одной секции' : 'No sections selected'}</p>
          )}
        </div>

        <div className="preview-section">
          <h4>{locale === 'ru' ? 'Формат вывода' : 'Output Format'}</h4>
          <div className="format-info">
            <span className="format-name">{config.format.toUpperCase()}</span>
            <span className="format-desc">{getFormatDescription(config.format)}</span>
          </div>
        </div>

        <div className="preview-section">
          <h4>{locale === 'ru' ? 'Ожидаемый размер' : 'Estimated Size'}</h4>
          <span className="size-estimate">{estimateSize()}</span>
        </div>

        <div className="preview-section">
          <h4>{locale === 'ru' ? 'Параметры' : 'Options'}</h4>
          <div className="options-list">
            <div className="option-item">
              <span className="option-label">
                {locale === 'ru' ? 'Маскирование данных' : 'Data masking'}:
              </span>
              <StatusBadge tone={config.maskSensitiveData ? 'success' : 'warning'}>
                {config.maskSensitiveData ? (locale === 'ru' ? 'Включено' : 'Enabled') : (locale === 'ru' ? 'Отключено' : 'Disabled')}
              </StatusBadge>
            </div>
            {config.detailLevel && (
              <div className="option-item">
                <span className="option-label">
                  {locale === 'ru' ? 'Уровень детализации' : 'Detail level'}:
                </span>
                <span>{config.detailLevel === 'detailed' ? (locale === 'ru' ? 'Подробный' : 'Detailed') : (locale === 'ru' ? 'Базовый' : 'Basic')}</span>
              </div>
            )}
          </div>
        </div>

        {enabledSections.length > 0 && (
          <div className="preview-section warnings">
            <h4>{locale === 'ru' ? 'Предупреждения' : 'Warnings'}</h4>
            <ul className="warnings-list">
              {config.format === 'txt' && (
                <li>{locale === 'ru' ? 'TXT не поддерживает вложения' : 'TXT does not support attachments'}</li>
              )}
              {enabledSections.some(s => s.key === 'docker') && (
                <li>{locale === 'ru' ? 'Секция Docker может содержать много данных' : 'Docker section may contain large amounts of data'}</li>
              )}
              {config.maskSensitiveData && (
                <li>{locale === 'ru' ? 'Чувствительные данные будут замаскированы' : 'Sensitive data will be masked'}</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
