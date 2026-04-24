'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Panel, StatusBadge, LoadingLines } from '@/components/ui/signal-primitives';
import type { SystemReportStatus } from '@/lib/api';
import { systemReportApi } from '@/lib/api';

type ReportState = SystemReportStatus['state'];

function stateLabel(state: ReportState, t: (key: string) => string): string {
  switch (state) {
    case 'idle': return t('idle');
    case 'queued': return t('queued');
    case 'running': return t('running');
    case 'success': return t('success');
    case 'failed': return t('failed');
  }
}

function stateTone(state: ReportState): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  switch (state) {
    case 'idle': return 'neutral';
    case 'queued': return 'warning';
    case 'running': return 'info';
    case 'success': return 'success';
    case 'failed': return 'danger';
  }
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
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
      <span className="sr-info-value">{value ?? '—'}</span>
    </div>
  );
}

export function SystemReportCard({ locale }: { locale: string }) {
  const t = useTranslations('admin.systemReport');
  const [status, setStatus] = useState<SystemReportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await systemReportApi.getStatus();
      if (mountedRef.current) {
        setStatus(data);
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
        const data = await systemReportApi.getStatus();
        if (!mountedRef.current) return;
        setStatus(data);
        if (data.state !== 'queued' && data.state !== 'running') {
          stopPolling();
        }
      } catch {
        // Silent poll failure
      }
    }, 2000);
  }, [stopPolling]);

  useEffect(() => {
    mountedRef.current = true;
    fetchStatus();
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [fetchStatus, stopPolling]);

  useEffect(() => {
    if (status?.state === 'queued' || status?.state === 'running') {
      startPolling();
    } else {
      stopPolling();
    }
  }, [status?.state, startPolling, stopPolling]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      await systemReportApi.refresh();
      await fetchStatus();
      startPolling();
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as any).status === 409) {
        await fetchStatus();
        startPolling();
        if (mountedRef.current) setError(t('alreadyRunning'));
      } else if (mountedRef.current) {
        setError(t('refreshFailed'));
      }
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  };

  const handleDownload = async () => {
    if (downloading || !status?.downloadAvailable) return;
    setDownloading(true);
    try {
      await systemReportApi.downloadReport();
    } catch {
      if (mountedRef.current) setError(t('downloadFailed'));
    } finally {
      if (mountedRef.current) setDownloading(false);
    }
  };

  const isGenerating = status?.state === 'queued' || status?.state === 'running';
  const canDownload = status?.downloadAvailable ?? false;
  const currentState: ReportState = status?.state ?? 'idle';

  return (
    <Panel variant="elevated" className="sr-card">
      <div className="sr-header">
        <div>
          <h2>{t('title')}</h2>
          <p className="sr-subtitle">{t('subtitle')}</p>
        </div>
        <StatusBadge tone={stateTone(currentState)}>
          {loading ? '…' : stateLabel(currentState, (key) => t(`states.${key}`))}
        </StatusBadge>
      </div>

      {loading ? (
        <LoadingLines rows={4} />
      ) : (
        <>
          <div className="sr-actions">
            <button
              className="sr-btn sr-btn-primary"
              disabled={isGenerating || refreshing}
              onClick={handleRefresh}
            >
              {refreshing ? t('refreshing') : t('refresh')}
            </button>
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
            <InfoRow label={t('fields.lastSuccess')} value={formatDate(status?.lastSuccessAt ?? null, locale)} />
            <InfoRow label={t('fields.lastRequest')} value={formatDate(status?.requestedAt ?? null, locale)} />
            <InfoRow label={t('fields.requestedBy')} value={status?.requestedByEmail ?? null} />
            <InfoRow label={t('fields.fileSize')} value={formatBytes(status?.fileSizeBytes ?? null)} />
            <InfoRow label={t('fields.generatedAt')} value={formatDate(status?.generatedAt ?? null, locale)} />
            <InfoRow label={t('fields.sha256')} value={status?.sha256 ? `${status.sha256.slice(0, 12)}…` : null} />
          </div>

          {status?.lastError && (
            <div className="sr-error-details">
              <span className="sr-error-label">{t('fields.error')}:</span>
              <code>{status.lastError}</code>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}