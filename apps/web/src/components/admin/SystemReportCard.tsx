'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Panel, StatusBadge, LoadingLines } from '@/components/ui/signal-primitives';
import type { ReportRun } from '@/lib/api';
import { systemReportsApi } from '@/lib/api';

type ReportState = ReportRun['status'] | 'idle';

function stateLabel(state: ReportState, t: (key: string) => string, locale: string): string {
  switch (state) {
    case 'idle': return t('idle');
    case 'queued': return t('queued');
    case 'running': return t('running');
    case 'success': return t('success');
    case 'failed': return t('failed');
    case 'partial_success': return locale === 'ru' ? 'Частично готов' : 'Partial success';
    case 'canceled': return locale === 'ru' ? 'Отменен' : 'Canceled';
    case 'stale': return locale === 'ru' ? 'Устарел' : 'Stale';
  }
}

function stateTone(state: ReportState): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  switch (state) {
    case 'idle': return 'neutral';
    case 'queued': return 'warning';
    case 'running': return 'info';
    case 'success': return 'success';
    case 'partial_success': return 'warning';
    case 'failed': return 'danger';
    case 'canceled':
    case 'stale':
      return 'neutral';
  }
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface InfoRowProps {
  label: string;
  value: string | null;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="sr-info-row">
      <span className="sr-info-label">{label}</span>
      <span className="sr-info-value">{value ?? '-'}</span>
    </div>
  );
}

export function SystemReportCard({ locale }: { locale: string }) {
  const t = useTranslations('admin.systemReport');
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchRuns = useCallback(async () => {
    try {
      const data = await systemReportsApi.getRuns();
      if (mountedRef.current) {
        setRuns(data);
        setError(null);
      }
    } catch {
      if (mountedRef.current) setError(t('loadFailed'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [t]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const data = await systemReportsApi.getRuns();
        if (!mountedRef.current) return;
        setRuns(data);
        const latest = data[0];
        if (latest?.status !== 'queued' && latest?.status !== 'running') {
          stopPolling();
        }
      } catch {
        // Keep the dashboard quiet while the full page can show detailed errors.
      }
    }, 2000);
  }, [stopPolling]);

  useEffect(() => {
    mountedRef.current = true;
    fetchRuns();
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [fetchRuns, stopPolling]);

  const latestRun = runs[0] ?? null;
  const reportArtifact = useMemo(
    () => latestRun?.artifacts.find((artifact) => artifact.kind === 'report') ?? latestRun?.artifacts[0] ?? null,
    [latestRun]
  );

  useEffect(() => {
    if (latestRun?.status === 'queued' || latestRun?.status === 'running') {
      startPolling();
    } else {
      stopPolling();
    }
  }, [latestRun?.status, startPolling, stopPolling]);

  const handleDownload = async () => {
    if (downloading || !latestRun || !reportArtifact) return;
    setDownloading(true);
    try {
      await systemReportsApi.downloadArtifact(latestRun.id, reportArtifact.id, reportArtifact.fileName);
    } catch {
      if (mountedRef.current) setError(t('downloadFailed'));
    } finally {
      if (mountedRef.current) setDownloading(false);
    }
  };

  const canDownload = Boolean(reportArtifact);
  const currentState: ReportState = latestRun?.status ?? 'idle';
  const reportsHref = `/${locale}/admin/system-reports`;
  const newReportHref = `/${locale}/admin/system-reports/new`;

  return (
    <Panel variant="elevated" className="sr-card">
      <div className="sr-header">
        <div>
          <h2>{t('title')}</h2>
          <p className="sr-subtitle">{t('subtitle')}</p>
        </div>
        <StatusBadge tone={stateTone(currentState)}>
          {loading ? '...' : stateLabel(currentState, (key) => t(`states.${key}`), locale)}
        </StatusBadge>
      </div>

      {loading ? (
        <LoadingLines rows={4} />
      ) : (
        <>
          <div className="sr-actions">
            <Link className="sr-btn sr-btn-primary" href={newReportHref}>
              {locale === 'ru' ? 'Создать отчет' : 'Create report'}
            </Link>
            <Link className="sr-btn sr-btn-secondary" href={reportsHref}>
              {locale === 'ru' ? 'История' : 'History'}
            </Link>
            <button
              className="sr-btn sr-btn-secondary"
              disabled={!canDownload || downloading}
              onClick={handleDownload}
            >
              {downloading ? t('downloading') : t('download')}
            </button>
          </div>

          {error && (
            <div className="sr-error">{error}</div>
          )}

          <div className="sr-info-grid">
            <InfoRow label={t('fields.lastRequest')} value={formatDate(latestRun?.createdAt ?? null, locale)} />
            <InfoRow label={t('fields.requestedBy')} value={latestRun?.requestedByEmail ?? null} />
            <InfoRow label={t('fields.fileSize')} value={formatBytes(reportArtifact?.sizeBytes ?? null)} />
            <InfoRow label={t('fields.generatedAt')} value={formatDate(latestRun?.finishedAt ?? latestRun?.startedAt ?? null, locale)} />
            <InfoRow label={t('fields.sha256')} value={reportArtifact?.checksum ? `${reportArtifact.checksum.slice(0, 12)}...` : null} />
            <InfoRow label={locale === 'ru' ? 'Прогресс' : 'Progress'} value={latestRun ? `${latestRun.progressPercent}%` : null} />
          </div>

          {latestRun?.errorText && (
            <div className="sr-error-details">
              <span className="sr-error-label">{t('fields.error')}:</span>
              <code>{latestRun.errorText}</code>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
