'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { systemReportApi } from '@/lib/api';
import type { ReportRun, ReportConfig, ReportSection, SystemReportTemplate } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Panel, StatusBadge, LoadingLines } from '@/components/ui/signal-primitives';

type ReportStatus = 'queued' | 'running' | 'success' | 'failed' | 'partial_success' | 'canceled' | 'stale';
type ReportStage = 'queued' | 'collecting' | 'assembling' | 'writing_artifacts' | 'finalizing';

interface RunFilters {
  status?: ReportStatus[];
  templateId?: string;
}

export default function SystemReportsPage() {
  const t = useTranslations('admin.systemReports');
  const locale = useRouteLocale();

  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [templates, setTemplates] = useState<SystemReportTemplate[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RunFilters>({});
  const [selectedRun, setSelectedRun] = useState<ReportRun | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [runsData, templatesData, configData] = await Promise.all([
        systemReportApi.getRuns(filters),
        systemReportApi.getTemplates(),
        systemReportApi.getConfig(),
      ]);
      setRuns(runsData);
      setTemplates(templatesData);
      setConfig(configData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const hasActiveRuns = runs.some(r => r.status === 'queued' || r.status === 'running');
    if (!hasActiveRuns) return;

    const interval = setInterval(() => {
      fetchData();
    }, 3000);

    return () => clearInterval(interval);
  }, [runs, fetchData]);

  const handleDownload = async (run: ReportRun) => {
    if (run.artifacts.length === 0) return;
    
    setActionLoading(run.id);
    try {
      const mainArtifact = run.artifacts.find(a => a.kind === 'report') || run.artifacts[0];
      await systemReportApi.downloadArtifact(run.id, mainArtifact.id, mainArtifact.fileName);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetry = async (run: ReportRun) => {
    setActionLoading(run.id);
    try {
      await systemReportApi.retryRun(run.id);
      fetchData();
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (run: ReportRun) => {
    setActionLoading(run.id);
    try {
      await systemReportApi.cancelRun(run.id);
      fetchData();
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

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
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);

    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTotalSize = (run: ReportRun) => {
    return run.artifacts.reduce((sum, a) => sum + a.sizeBytes, 0);
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

  const getStageLabel = (stage?: string) => {
    if (!stage) return '';
    const labels: Record<string, string> = {
      queued: locale === 'ru' ? 'Ожидание' : 'Queued',
      collecting: locale === 'ru' ? 'Сбор данных' : 'Collecting',
      assembling: locale === 'ru' ? 'Сборка' : 'Assembling',
      writing_artifacts: locale === 'ru' ? 'Запись' : 'Writing',
      finalizing: locale === 'ru' ? 'Финализация' : 'Finalizing',
    };
    return labels[stage] || stage;
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

      <div className="reports-page-grid">
        <Panel variant="elevated" className="reports-table-panel">
          <div className="table-header">
            <h3>{locale === 'ru' ? 'История запусков' : 'Run History'}</h3>
            <div className="table-filters">
              <select
                value={filters.templateId || ''}
                onChange={(e) => setFilters({ ...filters, templateId: e.target.value || undefined })}
                className="filter-select"
              >
                <option value="">{locale === 'ru' ? 'Все шаблоны' : 'All templates'}</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

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
                    <th>{locale === 'ru' ? 'Инициатор' : 'Initiated by'}</th>
                    <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                    <th>{locale === 'ru' ? 'Длит.' : 'Duration'}</th>
                    <th>{locale === 'ru' ? 'Формат' : 'Format'}</th>
                    <th>{locale === 'ru' ? 'Размер' : 'Size'}</th>
                    <th>{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const isActive = run.status === 'queued' || run.status === 'running';
                    const canDownload = run.status === 'success' && run.artifacts.length > 0;
                    const canRetry = run.status === 'failed' || run.status === 'canceled';
                    const isLoading = actionLoading === run.id;

                    return (
                      <tr
                        key={run.id}
                        className={isActive ? 'active-row' : ''}
                      >
                        <td className="date-cell">
                          {formatDate(run.createdAt)}
                        </td>
                        <td className="title-cell">
                          <span className="run-id">#{run.id.slice(0, 8)}</span>
                          {run.title && <span className="run-title">{run.title}</span>}
                        </td>
                        <td className="template-cell">
                          {run.templateName || <span className="no-template">{locale === 'ru' ? 'Без шаблона' : 'Custom'}</span>}
                        </td>
                        <td className="initiator-cell">
                          {run.requestedByEmail}
                        </td>
                        <td className="status-cell">
                          <div className="status-content">
                            <StatusBadge tone={getStatusTone(run.status)}>
                              {getStatusLabel(run.status)}
                            </StatusBadge>
                            {run.stage && (
                              <span className="stage-label">{getStageLabel(run.stage)}</span>
                            )}
                            {isActive && (
                              <div className="progress-mini">
                                <div
                                  className="progress-mini-fill"
                                  style={{ width: `${run.progressPercent}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="duration-cell">
                          {run.startedAt && run.finishedAt
                            ? formatDuration(run.startedAt, run.finishedAt)
                            : run.startedAt
                            ? `${formatDuration(run.startedAt, new Date().toISOString())}`
                            : '—'}
                        </td>
                        <td className="format-cell">
                          {run.config.format.toUpperCase()}
                        </td>
                        <td className="size-cell">
                          {run.artifacts.length > 0
                            ? formatBytes(getTotalSize(run))
                            : '—'}
                        </td>
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

                            {run.events.length > 0 && (
                              <button
                                className="action-btn log-btn"
                                onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}
                                title={locale === 'ru' ? 'Логи' : 'Logs'}
                              >
                                📜
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

        {selectedRun && selectedRun.events.length > 0 && (
          <Panel variant="elevated" className="events-panel">
            <div className="events-header">
              <h3>{locale === 'ru' ? 'События' : 'Events'}</h3>
              <button
                className="close-btn"
                onClick={() => setSelectedRun(null)}
              >
                ✕
              </button>
            </div>
            <div className="events-list">
              {selectedRun.events.map((event) => (
                <div key={event.id} className={`event-item ${event.level}`}>
                  <div className="event-header">
                    <span className="event-level">{event.level}</span>
                    <span className="event-code">{event.code}</span>
                    <span className="event-time">
                      {new Date(event.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="event-message">{event.message}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {selectedRun && selectedRun.errorText && (
          <Panel variant="elevated" className="error-details-panel">
            <h3>{locale === 'ru' ? 'Ошибка' : 'Error'}</h3>
            <pre className="error-text">{selectedRun.errorText}</pre>
          </Panel>
        )}
      </div>
    </div>
  );
}
