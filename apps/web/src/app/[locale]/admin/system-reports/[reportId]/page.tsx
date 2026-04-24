'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { systemReportApi } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Panel, StatusBadge, LoadingLines } from '@/components/ui/signal-primitives';
import type { ReportRun } from '@/lib/api';

type ReportStatus = 'queued' | 'running' | 'success' | 'failed' | 'partial_success' | 'canceled' | 'stale';
type ReportStage = 'queued' | 'collecting' | 'assembling' | 'writing_artifacts' | 'finalizing';

export default function ReportDetailPage() {
  const params = useParams();
  const reportId = params?.reportId as string;
  const t = useTranslations('admin.systemReports');
  const locale = useRouteLocale();

  const [run, setRun] = useState<ReportRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchRun = useCallback(async () => {
    if (!reportId) return;

    try {
      const data = await systemReportApi.getRun(reportId);
      setRun(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchRun();
    const interval = setInterval(fetchRun, 2000);
    return () => clearInterval(interval);
  }, [fetchRun]);

  const handleDownload = async (artifactId: string, fileName: string) => {
    setDownloading(artifactId);
    try {
      await systemReportApi.downloadArtifact(reportId, artifactId, fileName);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(null);
    }
  };

  const handleCancel = async () => {
    try {
      await systemReportApi.cancelRun(reportId);
      fetchRun();
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  };

  const handleRetry = async () => {
    try {
      await systemReportApi.retryRun(reportId);
      fetchRun();
    } catch (err) {
      console.error('Retry failed:', err);
    }
  };

  const getStatusTone = (status: string) => {
    switch (status) {
      case 'success': return 'success';
      case 'running': return 'info';
      case 'failed': return 'danger';
      case 'partial_success': return 'warning';
      case 'canceled': return 'neutral';
      default: return 'neutral';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      success: locale === 'ru' ? 'Успешно' : 'Success',
      running: locale === 'ru' ? 'Выполняется' : 'Running',
      failed: locale === 'ru' ? 'Ошибка' : 'Failed',
      partial_success: locale === 'ru' ? 'Частично' : 'Partial',
      canceled: locale === 'ru' ? 'Отменён' : 'Canceled',
      queued: locale === 'ru' ? 'В очереди' : 'Queued',
      stale: locale === 'ru' ? 'Устаревший' : 'Stale',
    };
    return labels[status] || status;
  };

  const getStageLabel = (stage?: string) => {
    if (!stage) return '';
    const labels: Record<string, string> = {
      queued: locale === 'ru' ? 'В очереди' : 'Queued',
      collecting: locale === 'ru' ? 'Сбор данных' : 'Collecting data',
      assembling: locale === 'ru' ? 'Сборка' : 'Assembling',
      writing_artifacts: locale === 'ru' ? 'Запись файлов' : 'Writing files',
      finalizing: locale === 'ru' ? 'Финализация' : 'Finalizing',
    };
    return labels[stage] || stage;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="signal-page-shell admin-dashboard-shell route-shell">
        <AdminPageHeader
          title={t('reportDetails') || 'Report Details'}
        />
        <LoadingLines rows={8} />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="signal-page-shell admin-dashboard-shell route-shell">
        <AdminPageHeader
          title={t('reportDetails') || 'Report Details'}
        />
        <Panel variant="elevated">
          <div className="error-state">
            <h3>{locale === 'ru' ? 'Ошибка загрузки' : 'Failed to load'}</h3>
            <p>{error || 'Report not found'}</p>
          </div>
        </Panel>
      </div>
    );
  }

  const isActive = run.status === 'queued' || run.status === 'running';

  return (
    <div className="signal-page-shell admin-dashboard-shell route-shell route-report-detail">
      <AdminPageHeader
        title={run.title || `${locale === 'ru' ? 'Отчёт' : 'Report'} #${run.id.slice(0, 8)}`}
        subtitle={run.templateName ? `Template: ${run.templateName}` : undefined}
        actions={
          <div className="report-detail-actions">
            {isActive && (
              <button className="btn btn-secondary" onClick={handleCancel}>
                {locale === 'ru' ? 'Отменить' : 'Cancel'}
              </button>
            )}
            {(run.status === 'failed' || run.status === 'canceled') && (
              <button className="btn btn-primary" onClick={handleRetry}>
                {locale === 'ru' ? 'Повторить' : 'Retry'}
              </button>
            )}
          </div>
        }
      />

      <div className="report-detail-grid">
        <Panel variant="elevated" className="status-panel">
          <h3>{locale === 'ru' ? 'Статус' : 'Status'}</h3>

          <div className="status-row">
            <StatusBadge tone={getStatusTone(run.status)}>
              {getStatusLabel(run.status)}
            </StatusBadge>
            {run.stage && (
              <span className="stage-label">{getStageLabel(run.stage)}</span>
            )}
          </div>

          {isActive && (
            <div className="progress-section">
              <div className="progress-header">
                <span>{run.progressPercent}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${run.progressPercent}%` }}
                />
              </div>
            </div>
          )}

          <div className="meta-grid">
            <div className="meta-item">
              <span className="meta-label">{locale === 'ru' ? 'Создан' : 'Created'}</span>
              <span className="meta-value">{formatDate(run.createdAt)}</span>
            </div>
            {run.startedAt && (
              <div className="meta-item">
                <span className="meta-label">{locale === 'ru' ? 'Начат' : 'Started'}</span>
                <span className="meta-value">{formatDate(run.startedAt)}</span>
              </div>
            )}
            {run.finishedAt && (
              <div className="meta-item">
                <span className="meta-label">{locale === 'ru' ? 'Завершён' : 'Finished'}</span>
                <span className="meta-value">{formatDate(run.finishedAt)}</span>
              </div>
            )}
            <div className="meta-item">
              <span className="meta-label">{locale === 'ru' ? 'Формат' : 'Format'}</span>
              <span className="meta-value">{run.config.format.toUpperCase()}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">{locale === 'ru' ? 'Инициатор' : 'Requested by'}</span>
              <span className="meta-value">{run.requestedByEmail}</span>
            </div>
          </div>

          {run.errorText && (
            <div className="error-box">
              <h4>{locale === 'ru' ? 'Ошибка' : 'Error'}</h4>
              <p>{run.errorText}</p>
            </div>
          )}
        </Panel>

        <Panel variant="elevated" className="events-panel">
          <h3>{locale === 'ru' ? 'События' : 'Events'}</h3>

          {run.events.length === 0 ? (
            <p className="empty-message">
              {locale === 'ru' ? 'Нет событий' : 'No events'}
            </p>
          ) : (
            <div className="events-list">
              {run.events.map((event) => (
                <div key={event.id} className={`event-item ${event.level}`}>
                  <div className="event-header">
                    <span className="event-level">{event.level}</span>
                    <span className="event-code">{event.code}</span>
                    <span className="event-time">{formatDate(event.createdAt)}</span>
                  </div>
                  <p className="event-message">{event.message}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel variant="elevated" className="artifacts-panel">
          <h3>{locale === 'ru' ? 'Файлы' : 'Artifacts'}</h3>

          {run.artifacts.length === 0 ? (
            <p className="empty-message">
              {locale === 'ru' ? 'Нет файлов' : 'No artifacts'}
            </p>
          ) : (
            <div className="artifacts-list">
              {run.artifacts.map((artifact) => (
                <div key={artifact.id} className="artifact-item">
                  <div className="artifact-info">
                    <span className="artifact-name">{artifact.fileName}</span>
                    <span className="artifact-size">{formatBytes(artifact.sizeBytes)}</span>
                    <span className="artifact-kind">{artifact.kind}</span>
                  </div>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleDownload(artifact.id, artifact.fileName)}
                    disabled={downloading === artifact.id}
                  >
                    {downloading === artifact.id
                      ? (locale === 'ru' ? 'Загрузка...' : 'Downloading...')
                      : (locale === 'ru' ? 'Скачать' : 'Download')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel variant="elevated" className="config-panel">
          <h3>{locale === 'ru' ? 'Конфигурация' : 'Configuration'}</h3>

          <div className="config-section">
            <h4>{locale === 'ru' ? 'Секции' : 'Sections'}</h4>
            <div className="sections-list">
              {run.config.sections
                .filter(s => s.enabled)
                .map((section) => (
                  <div key={section.key} className="section-item">
                    <span className="section-icon">✓</span>
                    <span className="section-name">{section.key}</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="config-section">
            <h4>{locale === 'ru' ? 'Маскирование' : 'Redaction'}</h4>
            <StatusBadge tone={run.config.redactionLevel === 'strict' ? 'success' : run.config.redactionLevel === 'off' ? 'warning' : 'neutral'}>
              {run.config.redactionLevel}
            </StatusBadge>
          </div>
        </Panel>
      </div>
    </div>
  );
}
