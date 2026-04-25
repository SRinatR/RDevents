'use client';

import { useTranslations } from 'next-intl';
import type { SystemReportPreview } from '@/lib/api';

interface SystemReportPreviewPanelProps {
  preview: SystemReportPreview | null;
  loading: boolean;
}

export function SystemReportPreviewPanel({ preview, loading }: SystemReportPreviewPanelProps) {
  const t = useTranslations('admin.systemReports.preview');

  if (loading) {
    return (
      <div className="sr-preview-panel loading">
        <div className="preview-header">
          <h4>{t('title') || 'Preview'}</h4>
        </div>
        <div className="preview-loading">
          <span className="loading-spinner" />
          {t('generating') || 'Generating preview...'}
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="sr-preview-panel empty">
        <div className="preview-header">
          <h4>{t('title') || 'Preview'}</h4>
        </div>
        <p className="preview-empty-hint">
          {t('emptyHint') || 'Configure your report and click Preview to see a summary'}
        </p>
      </div>
    );
  }

  return (
    <div className="sr-preview-panel">
      <div className="preview-header">
        <h4>{t('title') || 'Preview'}</h4>
      </div>

      <div className="preview-stats">
        <div className="stat-item">
          <span className="stat-value">{preview.sections.length}</span>
          <span className="stat-label">{t('sections') || 'Sections'}</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{preview.estimatedSize}</span>
          <span className="stat-label">{t('estSize') || 'Est. Size'}</span>
        </div>
      </div>

      {preview.sections.length > 0 && (
        <div className="preview-sections">
          <h5>{t('includedSections') || 'Included Sections'}</h5>
          <ul className="section-list">
            {preview.sections.map((s) => (
              <li key={s.key} className="section-item">
                <span className="section-check">✓</span>
                <span className="section-name">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.warnings.length > 0 && (
        <div className="preview-warnings">
          <h5>{t('warnings') || 'Warnings'}</h5>
          <ul className="warnings-list">
            {preview.warnings.map((w, i) => (
              <li key={i} className="warning-item">
                ⚠ {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}