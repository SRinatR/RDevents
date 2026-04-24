'use client';

import type { SystemReportGeneration } from '@/lib/api';

interface GenerationHistoryTableProps {
  generations: SystemReportGeneration[];
  onSelect: (generation: SystemReportGeneration) => void;
  onDownload: (generation: SystemReportGeneration) => void;
}

export function GenerationHistoryTable({
  generations,
  onSelect,
  onDownload,
}: GenerationHistoryTableProps) {
  const getStatusBadge = (status: string) => {
    const tones: Record<string, string> = {
      success: 'success',
      failed: 'danger',
      running: 'info',
      queued: 'warning',
      partial_success: 'warning',
      canceled: 'neutral',
      stale: 'danger',
      idle: 'neutral',
    };
    const labels: Record<string, string> = {
      success: 'Success',
      failed: 'Failed',
      running: 'Running',
      queued: 'Queued',
      partial_success: 'Partial',
      canceled: 'Canceled',
      stale: 'Stale',
      idle: 'Idle',
    };

    return (
      <span className={`status-badge ${tones[status] || 'neutral'}`}>
        {labels[status] || status}
      </span>
    );
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

  if (generations.length === 0) {
    return (
      <div className="history-empty-state">
        <div className="empty-icon">📋</div>
        <h3>No Generation History</h3>
        <p>Reports you generate will appear here</p>
      </div>
    );
  }

  return (
    <div className="history-table-container">
      <table className="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Template</th>
            <th>Status</th>
            <th>Format</th>
            <th>Progress</th>
            <th>Artifacts</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {generations.map((gen) => (
            <tr key={gen.id} onClick={() => onSelect(gen)}>
              <td className="date-cell">
                <div className="date-primary">{formatDate(gen.createdAt)}</div>
                {gen.startedAt && (
                  <div className="date-secondary">
                    Started {formatDate(gen.startedAt)}
                  </div>
                )}
              </td>

              <td className="template-cell">
                {gen.templateName || 'Custom'}
              </td>

              <td className="status-cell">
                {getStatusBadge(gen.status)}
              </td>

              <td className="format-cell">
                {gen.format.toUpperCase()}
              </td>

              <td className="progress-cell">
                <div className="progress-wrapper">
                  <div className="progress-bar-mini">
                    <div
                      className="progress-fill-mini"
                      style={{ width: `${gen.progress}%` }}
                    />
                  </div>
                  <span className="progress-text">{gen.progress}%</span>
                </div>
              </td>

              <td className="artifacts-cell">
                {gen.attachments?.length || 0}
              </td>

              <td className="actions-cell">
                {gen.status === 'success' && (
                  <button
                    className="download-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(gen);
                    }}
                  >
                    ↓ Download
                  </button>
                )}
                {gen.status === 'failed' && gen.errorMessage && (
                  <span className="error-indicator" title={gen.errorMessage}>
                    ⚠ Error
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
