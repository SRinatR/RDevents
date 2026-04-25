'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { systemReportsApi, ApiError } from '@/lib/api';
import type {
  ReportRun,
  BuilderConfig,
  SystemReportTemplate,
  SystemReportConfigResponse,
  SystemReportPreview,
} from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { SystemReportBuilder } from '@/components/admin/system-reports/SystemReportBuilder';
import { SystemReportTemplatesPanel } from '@/components/admin/system-reports/SystemReportTemplatesPanel';
import { Panel, StatusBadge, LoadingLines } from '@/components/ui/signal-primitives';

type ReportStatus = 'queued' | 'running' | 'success' | 'failed' | 'partial_success' | 'canceled' | 'stale';

function makeDefaultBuilderConfig(config: SystemReportConfigResponse): BuilderConfig {
  return {
    format: 'txt',
    redactionLevel: 'standard',
    sections: config.sections.map((s) => ({
      key: s.key,
      enabled: true,
      options: Object.fromEntries(s.options.map((o) => [o.key, o.default])),
    })),
  };
}

function normalizeBuilderConfigForCurrentSchema(
  config: SystemReportConfigResponse,
  templateConfig: BuilderConfig
): { value: BuilderConfig; adjusted: boolean } {
  const formatValues = new Set(config.formats.map((format) => format.value));
  const redactionValues = new Set(config.redactionLevels.map((redaction) => redaction.value));
  const templateSections = new Map(templateConfig.sections.map((section) => [section.key, section]));
  let adjusted = false;

  const sections = config.sections.map((sectionDefinition) => {
    const templateSection = templateSections.get(sectionDefinition.key);
    if (!templateSection) adjusted = true;

    const options = Object.fromEntries(
      sectionDefinition.options.map((optionDefinition) => {
        const templateValue = templateSection?.options?.[optionDefinition.key];
        if (templateSection && !(optionDefinition.key in (templateSection.options ?? {}))) {
          adjusted = true;
        }
        return [optionDefinition.key, templateValue ?? optionDefinition.default];
      })
    );

    if (templateSection) {
      for (const optionKey of Object.keys(templateSection.options ?? {})) {
        if (!sectionDefinition.options.some((optionDefinition) => optionDefinition.key === optionKey)) {
          adjusted = true;
          break;
        }
      }
    }

    return {
      key: sectionDefinition.key,
      enabled: templateSection?.enabled ?? false,
      options,
    };
  });

  for (const section of templateConfig.sections) {
    if (!config.sections.some((definition) => definition.key === section.key)) {
      adjusted = true;
      break;
    }
  }

  const format = formatValues.has(templateConfig.format)
    ? templateConfig.format
    : (config.formats[0]?.value ?? 'txt');
  if (format !== templateConfig.format) adjusted = true;

  const redactionLevel =
    templateConfig.redactionLevel && redactionValues.has(templateConfig.redactionLevel)
      ? templateConfig.redactionLevel
      : 'standard';
  if (redactionLevel !== templateConfig.redactionLevel) adjusted = true;

  return {
    value: {
      format,
      redactionLevel,
      sections,
      dateRange: templateConfig.dateRange,
    },
    adjusted,
  };
}

function pickPrimaryArtifact(run: ReportRun) {
  const expectedExt = `.${run.config.format.toLowerCase()}`;
  return (
    run.artifacts.find(
      (a) => a.kind === 'report' && a.fileName.toLowerCase().endsWith(expectedExt)
    ) ??
    run.artifacts.find((a) => a.kind === 'report') ??
    run.artifacts[0] ??
    null
  );
}

export default function SystemReportsPage() {
  const t = useTranslations('admin.systemReports');
  const locale = useRouteLocale();
  const router = useRouter();

  const [config, setConfig] = useState<SystemReportConfigResponse | null>(null);
  const [templates, setTemplates] = useState<SystemReportTemplate[]>([]);
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'builder' | 'history'>('builder');
  const [builderConfig, setBuilderConfig] = useState<BuilderConfig | null>(null);
  const [builderTitle, setBuilderTitle] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [configData, templatesData, runsData] = await Promise.all([
        systemReportsApi.getConfig(),
        systemReportsApi.getTemplates(),
        systemReportsApi.getRuns(),
      ]);
      setConfig(configData);
      setTemplates(templatesData);
      setRuns(runsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (config && !builderConfig) {
      setBuilderConfig(makeDefaultBuilderConfig(config));
    }
  }, [config, builderConfig]);

  useEffect(() => {
    const hasActiveRuns = runs.some((r) => r.status === 'queued' || r.status === 'running');
    if (!hasActiveRuns) return;

    const interval = setInterval(() => {
      fetchData();
    }, 3000);

    return () => clearInterval(interval);
  }, [runs, fetchData]);

  const handlePreview = useCallback(
    async (cfg: BuilderConfig): Promise<SystemReportPreview | null> => {
      const preview = await systemReportsApi.preview({
        format: cfg.format,
        sections: cfg.sections.map((s) => ({ key: s.key, enabled: s.enabled, options: s.options })),
        redactionLevel: cfg.redactionLevel || 'standard',
        dateRange: cfg.dateRange,
      });
      return preview;
    },
    []
  );

  const handleRunNow = useCallback(
    async (cfg: BuilderConfig, title?: string) => {
      setActionLoading('run');
      setActionError(null);
      setActionNotice(null);
      try {
        const run = await systemReportsApi.createRun({
          title: title?.trim() || undefined,
          format: cfg.format,
          sections: cfg.sections.map((s) => ({
            key: s.key,
            enabled: s.enabled,
            options: s.options,
          })),
          redactionLevel: cfg.redactionLevel || 'standard',
          dateRange: cfg.dateRange,
        });
        router.push(`/${locale}/admin/system-reports/${run.id}`);
      } catch (err) {
        console.error('Run failed:', err);
        alert(err instanceof Error ? err.message : 'Failed to run report');
      } finally {
        setActionLoading(null);
      }
    },
    [locale, router]
  );

  const handleSaveTemplate = useCallback(
    async (name: string, description?: string, isDefault?: boolean) => {
      if (!builderConfig) return;

      await systemReportsApi.createTemplate({
        name,
        description,
        isDefault,
        config: builderConfig,
      });

      const updated = await systemReportsApi.getTemplates();
      setTemplates(updated);
      setActionNotice(t('templateSaved') || 'Template saved.');
    },
    [builderConfig, t]
  );

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    try {
      await systemReportsApi.deleteTemplate(templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      console.error('Delete template failed:', err);
    }
  }, []);

  const handleSetDefaultTemplate = useCallback(async (templateId: string) => {
    try {
      await systemReportsApi.updateTemplate(templateId, { isDefault: true });
      const updated = await systemReportsApi.getTemplates();
      setTemplates(updated);
    } catch (err) {
      console.error('Set default template failed:', err);
    }
  }, []);

  const handleLoadTemplate = useCallback((template: SystemReportTemplate) => {
    if (!config) return;
    const normalized = normalizeBuilderConfigForCurrentSchema(config, template.config);
    setBuilderConfig(normalized.value);
    setBuilderTitle(template.name);
    setActionError(null);
    setActionNotice(
      normalized.adjusted
        ? (t('templateAdjusted') || 'Template was adjusted to the current report schema.')
        : null
    );
    setActiveTab('builder');
  }, [config, t]);

  const handleDownload = useCallback(async (run: ReportRun) => {
    const mainArtifact = pickPrimaryArtifact(run);
    if (!mainArtifact) return;

    setActionError(null);
    setActionLoading(run.id);
    try {
      await systemReportsApi.downloadArtifact(run.id, mainArtifact.id, mainArtifact.fileName);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ARTIFACT_FILE_MISSING') {
        setActionError(
          locale === 'ru'
            ? 'Файл отчёта отсутствует на диске. Перезапустите генерацию.'
            : 'Artifact file is missing on disk. Please rerun the report.'
        );
      } else {
        setActionError(
          locale === 'ru'
            ? 'Не удалось скачать файл отчёта.'
            : 'Failed to download report artifact.'
        );
      }
    } finally {
      setActionLoading(null);
    }
  }, [locale]);

  const handleRetry = useCallback(async (run: ReportRun) => {
    setActionLoading(run.id);
    try {
      await systemReportsApi.retryRun(run.id);
      fetchData();
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setActionLoading(null);
    }
  }, [fetchData]);

  const handleCancel = useCallback(async (run: ReportRun) => {
    setActionLoading(run.id);
    try {
      await systemReportsApi.cancelRun(run.id);
      fetchData();
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setActionLoading(null);
    }
  }, [fetchData]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start || !end) return '—';
    const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  const getStatusTone = (status: ReportStatus) => {
    switch (status) {
      case 'success': return 'success';
      case 'running': return 'info';
      case 'failed': return 'danger';
      case 'partial_success': return 'warning';
      case 'canceled': return 'neutral';
      default: return 'neutral';
    }
  };

  const getStatusLabel = (status: ReportStatus) => {
    const labels: Record<string, string> = {
      success: locale === 'ru' ? 'Успешно' : 'Success',
      running: locale === 'ru' ? 'Выполняется' : 'Running',
      queued: locale === 'ru' ? 'В очереди' : 'Queued',
      failed: locale === 'ru' ? 'Ошибка' : 'Failed',
      partial_success: locale === 'ru' ? 'Частично' : 'Partial',
      canceled: locale === 'ru' ? 'Отменён' : 'Canceled',
      stale: locale === 'ru' ? 'Устаревший' : 'Stale',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="signal-page-shell admin-dashboard-shell route-shell">
        <AdminPageHeader title={t('title') || 'System Reports'} />
        <LoadingLines rows={8} />
      </div>
    );
  }

  return (
    <div className="signal-page-shell admin-dashboard-shell route-shell route-system-reports">
      <AdminPageHeader
        title={t('title') || 'System Reports'}
        subtitle={locale === 'ru' ? 'Гибкий конструктор системных отчётов' : 'Flexible system report constructor'}
      />

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
          <button onClick={fetchData}>{locale === 'ru' ? 'Повторить' : 'Retry'}</button>
        </div>
      )}

      {actionError && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{actionError}</span>
        </div>
      )}

      {actionNotice && (
        <div className="signal-notice tone-info">
          {actionNotice}
        </div>
      )}

      <div className="sr-page-layout">
        <div className="sr-main-column">
          <div className="sr-tab-bar">
            <button
              className={`sr-tab ${activeTab === 'builder' ? 'active' : ''}`}
              onClick={() => setActiveTab('builder')}
            >
              {locale === 'ru' ? '📋 Конструктор' : '📋 Builder'}
            </button>
            <button
              className={`sr-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              {locale === 'ru' ? '📜 История' : '📜 History'}
              {runs.length > 0 && <span className="tab-badge">{runs.length}</span>}
            </button>
          </div>

          {activeTab === 'builder' ? (
            <div className="sr-builder-wrapper">
              <SystemReportBuilder
                config={config}
                value={builderConfig}
                title={builderTitle}
                onTitleChange={setBuilderTitle}
                onChange={setBuilderConfig}
                onPreview={handlePreview}
                onRunNow={handleRunNow}
                onSaveTemplate={handleSaveTemplate}
                locale={locale}
              />
            </div>
          ) : (
            <Panel variant="elevated" className="sr-history-panel">
              {runs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <h4>{locale === 'ru' ? 'История пуста' : 'No runs yet'}</h4>
                  <p>{locale === 'ru' ? 'Создайте первый отчёт' : 'Create your first report'}</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="runs-table">
                    <thead>
                      <tr>
                        <th>{locale === 'ru' ? 'Дата' : 'Date'}</th>
                        <th>{locale === 'ru' ? 'Название' : 'Title'}</th>
                        <th>{locale === 'ru' ? 'Шаблон' : 'Template'}</th>
                        <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                        <th>{locale === 'ru' ? 'Длит.' : 'Duration'}</th>
                        <th>{locale === 'ru' ? 'Формат' : 'Format'}</th>
                        <th>{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run) => {
                        const isActive = run.status === 'queued' || run.status === 'running';
                        const canDownload = (run.status === 'success' || run.status === 'partial_success') && run.artifacts.length > 0;
                        const canRetry = run.status === 'failed' || run.status === 'canceled';
                        const isLoading = actionLoading === run.id;

                        return (
                          <tr key={run.id} className={isActive ? 'active-row' : ''}>
                            <td className="date-cell">{formatDate(run.createdAt)}</td>
                            <td className="title-cell">
                              <span className="run-id">#{run.id.slice(0, 8)}</span>
                              {run.title && <span className="run-title">{run.title}</span>}
                            </td>
                            <td className="template-cell">
                              {run.templateName || (
                                <span className="no-template">
                                  {locale === 'ru' ? 'Без шаблона' : 'Custom'}
                                </span>
                              )}
                            </td>
                            <td className="status-cell">
                              <StatusBadge tone={getStatusTone(run.status)}>
                                {getStatusLabel(run.status)}
                              </StatusBadge>
                            </td>
                            <td className="duration-cell">
                              {run.startedAt && run.finishedAt
                                ? formatDuration(run.startedAt, run.finishedAt)
                                : run.startedAt
                                ? `${formatDuration(run.startedAt, new Date().toISOString())}`
                                : '—'}
                            </td>
                            <td className="format-cell">{run.config.format.toUpperCase()}</td>
                            <td className="actions-cell">
                              <div className="actions-buttons">
                                <Link
                                  href={`/${locale}/admin/system-reports/${run.id}`}
                                  className="action-btn view-btn"
                                  title={locale === 'ru' ? 'Открыть' : 'Open'}
                                >
                                  👁
                                </Link>
                                {canDownload && (
                                  <button
                                    className="action-btn download-btn"
                                    onClick={() => handleDownload(run)}
                                    disabled={isLoading}
                                    title={locale === 'ru' ? 'Скачать' : 'Download'}
                                  >
                                    {isLoading ? '...' : '⬇'}
                                  </button>
                                )}
                                {canRetry && (
                                  <button
                                    className="action-btn retry-btn"
                                    onClick={() => handleRetry(run)}
                                    disabled={isLoading}
                                    title={locale === 'ru' ? 'Повторить' : 'Retry'}
                                  >
                                    {isLoading ? '...' : '↻'}
                                  </button>
                                )}
                                {isActive && (
                                  <button
                                    className="action-btn cancel-btn"
                                    onClick={() => handleCancel(run)}
                                    disabled={isLoading}
                                    title={locale === 'ru' ? 'Отменить' : 'Cancel'}
                                  >
                                    {isLoading ? '...' : '✕'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </div>

        <div className="sr-sidebar">
          <SystemReportTemplatesPanel
            templates={templates}
            loading={loading}
            onLoad={handleLoadTemplate}
            onSave={handleSaveTemplate}
            onDelete={handleDeleteTemplate}
            onSetDefault={handleSetDefaultTemplate}
            currentConfig={builderConfig}
          />
        </div>
      </div>
    </div>
  );
}
