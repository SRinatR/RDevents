'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SystemReportGeneration, ReportSection, SystemReportTemplate, ReportConfig } from '@/lib/api';
import { Panel, StatusBadge, LoadingLines } from '@/components/ui/signal-primitives';

type ReportStatus = 'idle' | 'queued' | 'running' | 'success' | 'failed' | 'partial_success' | 'canceled' | 'stale';
type ReportStage = 'queued' | 'collecting' | 'assembling' | 'writing_artifacts' | 'finalizing';

interface GenerationDetail {
  id: string;
  requestId: string;
  templateId?: string;
  templateName?: string;
  status: ReportStatus;
  stage?: ReportStage;
  progress: number;
  format: string;
  initiatedByEmail?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  artifactCount: number;
  sectionsSummary: Array<{
    key: string;
    label: string;
    status: string;
  }>;
}

interface CurrentStatusResponse {
  latestGeneration?: GenerationDetail;
  activeGenerations: GenerationDetail[];
}

export function SystemReportsDashboard() {
  const [currentStatus, setCurrentStatus] = useState<CurrentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/system-report/v2/current-status', {
        headers: {
          'Cache-Control': 'no-store',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      setCurrentStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading) return <LoadingLines rows={6} />;
  if (error) return <div className="error-state">{error}</div>;

  const latest = currentStatus?.latestGeneration;
  const active = currentStatus?.activeGenerations || [];

  return (
    <div className="reports-dashboard">
      <div className="dashboard-grid">
        <StatusCard generation={latest} />

        {active.length > 0 && (
          <ActiveJobsCard generations={active} />
        )}

        <QuickActionsCard onRefresh={fetchStatus} />
      </div>
    </div>
  );
}

function StatusCard({ generation }: { generation?: GenerationDetail }) {
  const getStatusTone = (status: ReportStatus) => {
    switch (status) {
      case 'success': return 'success';
      case 'running': return 'info';
      case 'failed': return 'danger';
      case 'partial_success': return 'warning';
      case 'queued': return 'warning';
      default: return 'neutral';
    }
  };

  const formatDate = (iso: string | undefined) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU', {
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

  return (
    <Panel variant="elevated" className="status-card">
      <div className="card-header">
        <h3>Current Status</h3>
        <StatusBadge tone={generation ? getStatusTone(generation.status) : 'neutral'}>
          {generation?.status || 'idle'}
        </StatusBadge>
      </div>

      {generation ? (
        <div className="card-content">
          <div className="status-meta">
            <div className="meta-row">
              <span className="meta-label">Last Run</span>
              <span className="meta-value">{formatDate(generation.completedAt)}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Format</span>
              <span className="meta-value">{generation.format.toUpperCase()}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Artifacts</span>
              <span className="meta-value">{generation.artifactCount}</span>
            </div>
            {generation.initiatedByEmail && (
              <div className="meta-row">
                <span className="meta-label">By</span>
                <span className="meta-value">{generation.initiatedByEmail}</span>
              </div>
            )}
          </div>

          {generation.status === 'running' && (
            <div className="progress-section">
              <div className="progress-header">
                <span>{getStageLabel(generation.stage)}</span>
                <span>{generation.progress}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${generation.progress}%` }}
                />
              </div>
            </div>
          )}

          {generation.errorMessage && (
            <div className="error-message">
              <span className="error-icon">⚠</span>
              {generation.errorMessage}
            </div>
          )}

          {generation.sectionsSummary.length > 0 && (
            <div className="sections-summary">
              <h4>Sections</h4>
              <div className="sections-list">
                {generation.sectionsSummary.map((section) => (
                  <div key={section.key} className="section-item">
                    <span className="section-name">{section.label}</span>
                    <StatusBadge
                      tone={section.status === 'completed' ? 'success' : section.status === 'failed' ? 'danger' : 'neutral'}
                    >
                      {section.status}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <p>No reports generated yet</p>
        </div>
      )}
    </Panel>
  );
}

function ActiveJobsCard({ generations }: { generations: GenerationDetail[] }) {
  return (
    <Panel variant="elevated" className="active-jobs-card">
      <div className="card-header">
        <h3>Active Jobs</h3>
        <span className="badge-count">{generations.length}</span>
      </div>

      <div className="card-content">
        <div className="jobs-list">
          {generations.map((gen) => (
            <div key={gen.id} className="job-item">
              <div className="job-info">
                <span className="job-id">#{gen.id.slice(0, 8)}</span>
                {gen.templateName && (
                  <span className="job-template">{gen.templateName}</span>
                )}
              </div>
              <div className="job-progress">
                <div className="mini-progress">
                  <div
                    className="mini-progress-fill"
                    style={{ width: `${gen.progress}%` }}
                  />
                </div>
                <span>{gen.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function QuickActionsCard({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Panel variant="elevated" className="quick-actions-card">
      <div className="card-header">
        <h3>Quick Actions</h3>
      </div>

      <div className="card-content">
        <div className="actions-list">
          <button className="action-btn primary" onClick={onRefresh}>
            <span className="action-icon">↻</span>
            Refresh Status
          </button>
          <button className="action-btn secondary">
            <span className="action-icon">⚡</span>
            Quick Report
          </button>
          <button className="action-btn secondary">
            <span className="action-icon">📊</span>
            Open Constructor
          </button>
        </div>
      </div>
    </Panel>
  );
}

function getStageLabel(stage?: ReportStage): string {
  const labels: Record<string, string> = {
    queued: 'Waiting in queue...',
    collecting: 'Collecting data...',
    assembling: 'Assembling report...',
    writing_artifacts: 'Writing files...',
    finalizing: 'Finalizing...',
  };
  return stage ? labels[stage] || stage : '';
}
