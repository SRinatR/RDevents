'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { systemReportsApi } from '@/lib/api';
import type { ReportRun } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Panel, StatusBadge, LoadingLines } from '@/components/ui/signal-primitives';

export default function SystemReportRunPage() {
  const params = useParams<{ locale: string; runId: string }>();
  const locale = params?.locale ?? 'uz';
  const runId = params?.runId ?? '';

  const [run, setRun] = useState<ReportRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    try {
      const data = await systemReportsApi.getRun(runId);
      setRun(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load run');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const hasActiveRun = !run || run.status === 'queued' || run.status === 'running';
    if (!hasActiveRun) return;

    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const handleDownload = async (artifactId: string, fileName: string) => {
    setDownloading(artifactId);
    try {
      await systemReportsApi.downloadArtifact(runId, artifactId, fileName);
    } catch (e) {
      console.error('Download failed:', e);
    } finally {
      setDownloading(null);
    }
  };

  const handleCancel = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      await systemReportsApi.cancelRun(runId);
      await load();
    } catch (e) {
      console.error('Cancel failed:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const newRun = await systemReportsApi.retryRun(runId);
      window.location.href = `/${locale}/admin/system-reports/${newRun.id}`;
    } catch (e) {
      console.error('Retry failed:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US');
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
      writing_artifacts: locale === 'ru' ? 'Запись файлов' : 'Writing artifacts',
      finalizing: locale === 'ru' ? 'Финализация' : 'Finalizing',
    };
    return labels[stage] || stage;
  };

  if (loading) {
    return (
      <div className="signal-page-shell admin-dashboard-shell route-shell">
        <AdminPageHeader title={locale === 'ru' ? 'Детали отчёта' : 'Run Details'} />
        <LoadingLines rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="signal-page-shell admin-dashboard-shell route-shell">
        <AdminPageHeader title={locale === 'ru' ? 'Ошибка' : 'Error'} />
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
        </div>
        <Link href={`/${locale}/admin/system-reports`} className="back-link">
          ← {locale === 'ru' ? 'Назад' : 'Back'}
        </Link>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="signal-page-shell admin-dashboard-shell route-shell">
        <AdminPageHeader title={locale === 'ru' ? 'Не найден' : 'Not found'} />
        <p>{locale === 'ru' ? 'Run не найден' : 'Run not found'}</p>
        <Link href={`/${locale}/admin/system-reports`} className="back-link">
          ← {locale === 'ru' ? 'Назад' : 'Back'}
        </Link>
      </div>
    );
  }

  const isActive = run.status === 'queued' || run.status === 'running';
  const canRetry = run.status === 'failed' || run.status === 'canceled';

  return (
    <div className="signal-page-shell admin-dashboard-shell route-shell route-system-report-run">
      <AdminPageHeader
        title={`System Report #${run.id.slice(0, 8)}`}
        subtitle={run.title}
        actions={
          <Link href={`/${locale}/admin/system-reports`} className="back-link">
            ← {locale === 'ru' ? 'К списку' : 'Back to list'}
          </Link>
        }
      />

      <div className="run-detail-layout">
        <div className="run-main-column">
          <Panel variant="elevated" className="run-overview-panel">
            <h3>{locale === 'ru' ? 'Обзор' : 'Overview'}</h3>
            <div className="overview-grid">
              <div className="overview-row">
                <span className="overview-label">{locale === 'ru' ? 'Статус' : 'Status'}</span>
                <StatusBadge tone={getStatusTone(run.status)}>
                  {getStatusLabel(run.status)}
                </StatusBadge>
              </div>

              {run.stage && (
                <div className="overview-row">
                  <span className="overview-label">{locale === 'ru' ? 'Этап' : 'Stage'}</span>
                  <span className="overview-value">{getStageLabel(run.stage)}</span>
                </div>
              )}

              {isActive && (
                <div className="overview-row">
                  <span className="overview-label">{locale === 'ru' ? 'Прогресс' : 'Progress'}</span>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${run.progressPercent}%` }} />
                    <span className="progress-percent">{run.progressPercent}%</span>
                  </div>
                </div>
              )}

              <div className="overview-row">
                <span className="overview-label">{locale === 'ru' ? 'Формат' : 'Format'}</span>
                <span className="overview-value">{run.config.format.toUpperCase()}</span>
              </div>

              <div className="overview-row">
                <span className="overview-label">{locale === 'ru' ? 'Инициатор' : 'Requested by'}</span>
                <span className="overview-value">{run.requestedByEmail}</span>
              </div>

              {run.templateName && (
                <div className="overview-row">
                  <span className="overview-label">{locale === 'ru' ? 'Шаблон' : 'Template'}</span>
                  <span className="overview-value">{run.templateName}</span>
                </div>
              )}

              <div className="overview-row">
                <span className="overview-label">{locale === 'ru' ? 'Создан' : 'Created'}</span>
                <span className="overview-value">{formatDate(run.createdAt)}</span>
              </div>

              {run.startedAt && (
                <div className="overview-row">
                  <span className="overview-label">{locale === 'ru' ? 'Начат' : 'Started'}</span>
                  <span className="overview-value">{formatDate(run.startedAt)}</span>
                </div>
              )}

              {run.finishedAt && (
                <div className="overview-row">
                  <span className="overview-label">{locale === 'ru' ? 'Завершён' : 'Finished'}</span>
                  <span className="overview-value">{formatDate(run.finishedAt)}</span>
                </div>
              )}
            </div>
          </Panel>

          <Panel variant="elevated" className="run-artifacts-panel">
            <h3>{locale === 'ru' ? 'Файлы' : 'Artifacts'} ({run.artifacts.length})</h3>
            {run.artifacts.length === 0 ? (
              <p className="empty-hint">{locale === 'ru' ? 'Нет файлов' : 'No artifacts'}</p>
            ) : (
              <ul className="artifacts-list">
                {run.artifacts.map((artifact) => (
                  <li key={artifact.id} className="artifact-item">
                    <div className="artifact-info">
                      <span className="artifact-name">{artifact.fileName}</span>
                      <span className="artifact-meta">
                        {artifact.kind} · {formatBytes(artifact.sizeBytes)}
                      </span>
                    </div>
                    <button
                      className="download-btn"
                      onClick={() => handleDownload(artifact.id, artifact.fileName)}
                      disabled={downloading === artifact.id}
                    >
                      {downloading === artifact.id ? '...' : '⬇'} {locale === 'ru' ? 'Скачать' : 'Download'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel variant="elevated" className="run-events-panel">
            <h3>{locale === 'ru' ? 'События' : 'Events'}</h3>
            {run.events.length === 0 ? (
              <p className="empty-hint">{locale === 'ru' ? 'Нет событий' : 'No events'}</p>
            ) : (
              <ul className="events-list">
                {run.events.map((event) => (
                  <li key={event.id} className={`event-item event-${event.level}`}>
                    <div className="event-header">
                      <span className={`event-level-badge ${event.level}`}>{event.level}</span>
                      <span className="event-code">{event.code}</span>
                      <span className="event-time">{formatDate(event.createdAt)}</span>
                    </div>
                    <p className="event-message">{event.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {run.errorText && (
            <Panel variant="elevated" className="run-error-panel">
              <h3>{locale === 'ru' ? 'Ошибка' : 'Error'}</h3>
              <pre className="error-text">{run.errorText}</pre>
            </Panel>
          )}
        </div>

        <div className="run-actions-column">
          <Panel variant="elevated" className="run-actions-panel">
            <h3>{locale === 'ru' ? 'Действия' : 'Actions'}</h3>
            <div className="actions-list">
              {isActive && (
                <button
                  className="action-btn cancel-btn"
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  {actionLoading ? '...' : '✕'} {locale === 'ru' ? 'Отменить' : 'Cancel'}
                </button>
              )}

              {canRetry && (
                <button
                  className="action-btn retry-btn"
                  onClick={handleRetry}
                  disabled={actionLoading}
                >
                  {actionLoading ? '...' : '↻'} {locale === 'ru' ? 'Повторить' : 'Retry'}
                </button>
              )}

              {(run.status === 'success' || run.status === 'partial_success') && run.artifacts.length > 0 && (
                <button
                  className="action-btn download-all-btn"
                  onClick={() => {
                    const main = run.artifacts.find((a) => a.kind === 'report') || run.artifacts[0];
                    handleDownload(main.id, main.fileName);
                  }}
                >
                  ⬇ {locale === 'ru' ? 'Скачать' : 'Download Report'}
                </button>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
