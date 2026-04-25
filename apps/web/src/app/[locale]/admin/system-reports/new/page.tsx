'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { systemReportsApi } from '@/lib/api';
import type { SystemReportTemplate, SystemReportConfigResponse, SystemReportSectionDefinition } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Panel } from '@/components/ui/signal-primitives';

export default function NewReportPage() {
  const t = useTranslations('admin.systemReports');
  const locale = useRouteLocale();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [format, setFormat] = useState<'txt' | 'json' | 'md'>('txt');
  const [redactionLevel, setRedactionLevel] = useState<'strict' | 'standard' | 'off'>('standard');
  const [sections, setSections] = useState<Array<{ key: string; label: string; enabled: boolean; options: Record<string, unknown> }>>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const [config, setConfig] = useState<SystemReportConfigResponse | null>(null);
  const [templates, setTemplates] = useState<SystemReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [configData, templatesData] = await Promise.all([
          systemReportsApi.getConfig(),
          systemReportsApi.getTemplates(),
        ]);
        setConfig(configData);
        setTemplates(templatesData);

        const defaultSections = configData.sections.map((s: SystemReportSectionDefinition) => ({
          key: s.key,
          label: s.label,
          enabled: true,
          options: Object.fromEntries(s.options.map(o => [o.key, o.default])),
        }));
        setSections(defaultSections);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template && config) {
        setFormat(template.config.format === 'zip' ? 'txt' : template.config.format as 'txt' | 'json' | 'md');
        if (template.config.redactionLevel) {
          setRedactionLevel(template.config.redactionLevel);
        }
        const templateSections = config.sections.map((s: SystemReportSectionDefinition) => {
          const configSection = template.config.sections.find(sc => sc.key === s.key);
          return {
            key: s.key,
            label: s.label,
            enabled: configSection?.enabled ?? true,
            options: configSection?.options ?? Object.fromEntries(s.options.map(o => [o.key, o.default])),
          };
        });
        setSections(templateSections);
      }
    } else if (config) {
      const defaultSections = config.sections.map((s: SystemReportSectionDefinition) => ({
        key: s.key,
        label: s.label,
        enabled: true,
        options: Object.fromEntries(s.options.map(o => [o.key, o.default])),
      }));
      setSections(defaultSections);
    }
  };

  const toggleSection = (key: string) => {
    setSections(prev =>
      prev.map(s => s.key === key ? { ...s, enabled: !s.enabled } : s)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const enabledSections = sections.filter(s => s.enabled);
    if (enabledSections.length === 0) {
      setError(locale === 'ru' ? 'Выберите хотя бы одну секцию' : 'Select at least one section');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const sectionsConfig = sections.map(s => ({
        key: s.key,
        enabled: s.enabled,
        options: s.options,
      }));

      const runData = {
        templateId: selectedTemplateId || undefined,
        title: title || undefined,
        format,
        sections: sectionsConfig,
        redactionLevel,
      };

      const run = await systemReportsApi.createRun(runData);

      if (saveAsTemplate && templateName) {
        try {
          const templateConfig = {
            format,
            sections: sectionsConfig,
            redactionLevel,
          };
          await systemReportsApi.createTemplate({
            name: templateName,
            config: templateConfig,
          });
        } catch (templateErr) {
          console.error('Failed to save template:', templateErr);
        }
      }

      router.push(`/${locale}/admin/system-reports/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create report');
      setSubmitting(false);
    }
  };

  const formatLabels: Record<string, string> = {
    txt: locale === 'ru' ? 'Plain Text (.txt)' : 'Plain Text (.txt)',
    json: locale === 'ru' ? 'JSON (.json)' : 'JSON (.json)',
    md: locale === 'ru' ? 'Markdown (.md)' : 'Markdown (.md)',
  };

  const redactionLabels: Record<string, string> = {
    strict: locale === 'ru' ? 'Строгая' : 'Strict',
    standard: locale === 'ru' ? 'Стандартная' : 'Standard',
    off: locale === 'ru' ? 'Без редактирования' : 'No Redaction',
  };

  if (loading) {
    return (
      <div className="signal-page-shell admin-dashboard-shell route-shell">
        <AdminPageHeader title={locale === 'ru' ? 'Создание отчёта' : 'Create Report'} />
        <div className="loading-spinner" />
      </div>
    );
  }

  const availableFormats = config?.formats.filter(f => f.value !== 'zip') || [
    { value: 'txt' as const, label: 'Plain Text (.txt)' },
    { value: 'json' as const, label: 'JSON (.json)' },
    { value: 'md' as const, label: 'Markdown (.md)' },
  ];

  return (
    <div className="signal-page-shell admin-dashboard-shell route-shell">
      <AdminPageHeader
        title={locale === 'ru' ? 'Создание отчёта' : 'Create Report'}
        subtitle={locale === 'ru' ? 'Настройте параметры системного отчёта' : 'Configure system report parameters'}
      />

      <form onSubmit={handleSubmit} className="report-builder-form">
        <div className="report-builder-grid">
          <Panel variant="elevated" className="builder-main-panel">
            <div className="form-section">
              <label className="form-label">
                {locale === 'ru' ? 'Название отчёта (опционально)' : 'Report title (optional)'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={locale === 'ru' ? 'Мой системный отчёт' : 'My system report'}
                className="signal-input"
              />
            </div>

            <div className="form-section">
              <label className="form-label">
                {locale === 'ru' ? 'Шаблон' : 'Template'}
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="signal-select"
              >
                <option value="">{locale === 'ru' ? 'Без шаблона (ручная настройка)' : 'No template (manual setup)'}</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="form-section">
              <label className="form-label">
                {locale === 'ru' ? 'Формат' : 'Format'}
              </label>
              <div className="format-selector">
                {availableFormats.map(f => (
                  <button
                    key={f.value}
                    type="button"
                    className={`format-option ${format === f.value ? 'selected' : ''}`}
                    onClick={() => setFormat(f.value as 'txt' | 'json' | 'md')}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <label className="form-label">
                {locale === 'ru' ? 'Уровень редактирования' : 'Redaction Level'}
              </label>
              <div className="redaction-selector">
                {(config?.redactionLevels || [
                  { value: 'strict' as const, label: 'Strict', description: '' },
                  { value: 'standard' as const, label: 'Standard', description: '' },
                  { value: 'off' as const, label: 'No Redaction', description: '' },
                ]).map(r => (
                  <button
                    key={r.value}
                    type="button"
                    className={`redaction-option ${redactionLevel === r.value ? 'selected' : ''}`}
                    onClick={() => setRedactionLevel(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <label className="form-label">
                {locale === 'ru' ? 'Секции' : 'Sections'}
              </label>
              <div className="sections-checklist">
                {sections.map(section => (
                  <label key={section.key} className="section-checkbox">
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      onChange={() => toggleSection(section.key)}
                    />
                    <span className="section-label">{section.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-section template-save-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                />
                <span>{locale === 'ru' ? 'Сохранить как шаблон' : 'Save as template'}</span>
              </label>
              {saveAsTemplate && (
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={locale === 'ru' ? 'Название шаблона' : 'Template name'}
                  className="signal-input"
                  required
                />
              )}
            </div>
          </Panel>

          <Panel variant="elevated" className="builder-summary-panel">
            <h3>{locale === 'ru' ? 'Итоговая конфигурация' : 'Final Configuration'}</h3>
            <div className="summary-item">
              <span className="summary-label">{locale === 'ru' ? 'Формат:' : 'Format:'}</span>
              <span className="summary-value">{formatLabels[format]}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">{locale === 'ru' ? 'Редактирование:' : 'Redaction:'}</span>
              <span className="summary-value">{redactionLabels[redactionLevel]}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">{locale === 'ru' ? 'Секций:' : 'Sections:'}</span>
              <span className="summary-value">{sections.filter(s => s.enabled).length} / {sections.length}</span>
            </div>
          </Panel>
        </div>

        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            onClick={() => router.push(`/${locale}/admin/system-reports`)}
            className="signal-button secondary"
          >
            {locale === 'ru' ? 'Отмена' : 'Cancel'}
          </button>
          <button
            type="submit"
            className="signal-button primary"
            disabled={submitting}
          >
            {submitting
              ? (locale === 'ru' ? 'Создание...' : 'Creating...')
              : (locale === 'ru' ? 'Создать отчёт' : 'Create Report')
            }
          </button>
        </div>
      </form>

      <style>{`
        .report-builder-form {
          max-width: 1200px;
        }

        .report-builder-grid {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 24px;
          margin-bottom: 24px;
        }

        .builder-main-panel {
          padding: 24px;
        }

        .builder-summary-panel {
          padding: 24px;
          height: fit-content;
        }

        .builder-summary-panel h3 {
          margin-top: 0;
          margin-bottom: 16px;
          font-size: 16px;
          font-weight: 600;
        }

        .form-section {
          margin-bottom: 24px;
        }

        .form-section:last-child {
          margin-bottom: 0;
        }

        .form-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          font-size: 14px;
        }

        .signal-input, .signal-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 6px;
          font-size: 14px;
          background: var(--bg-primary, #fff);
          color: var(--text-primary, #111827);
        }

        .signal-input:focus, .signal-select:focus {
          outline: none;
          border-color: var(--primary-color, #3b82f6);
          box-shadow: 0 0 0 2px var(--primary-color-alpha, rgba(59, 130, 246, 0.1));
        }

        .format-selector, .redaction-selector {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .format-option, .redaction-option {
          padding: 8px 16px;
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 6px;
          background: var(--bg-primary, #fff);
          color: var(--text-secondary, #6b7280);
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .format-option.selected, .redaction-option.selected {
          border-color: var(--primary-color, #3b82f6);
          background: var(--primary-color-alpha, rgba(59, 130, 246, 0.1);
          color: var(--primary-color, #3b82f6);
        }

        .sections-checklist {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .section-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .section-checkbox:has(input:checked) {
          border-color: var(--primary-color, #3b82f6);
          background: var(--primary-color-alpha, rgba(59, 130, 246, 0.05));
        }

        .section-checkbox input[type="checkbox"] {
          width: 16px;
          height: 16px;
        }

        .section-label {
          font-size: 14px;
        }

        .template-save-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          cursor: pointer;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--border-color, #e5e7eb);
        }

        .summary-item:last-child {
          border-bottom: none;
        }

        .summary-label {
          font-size: 14px;
          color: var(--text-secondary, #6b7280);
        }

        .summary-value {
          font-size: 14px;
          font-weight: 500;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: var(--danger-bg, #fee2e2);
          color: var(--danger-text, #991b1b);
          border-radius: 6px;
          margin-bottom: 24px;
        }

        .error-icon {
          font-size: 16px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .signal-button {
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .signal-button.primary {
          background: var(--primary-color, #3b82f6);
          color: white;
          border: none;
        }

        .signal-button.primary:hover {
          background: var(--primary-color-dark, #2563eb);
        }

        .signal-button.primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .signal-button.secondary {
          background: var(--bg-primary, #fff);
          color: var(--text-secondary, #6b7280);
          border: 1px solid var(--border-color, #e5e7eb);
        }

        .signal-button.secondary:hover {
          background: var(--bg-secondary, #f9fafb);
        }

        @media (max-width: 768px) {
          .report-builder-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
