'use client';

import { useState } from 'react';
import type { SystemReportGeneration } from '@/lib/api';
import { Panel, StatusBadge, LoadingLines } from '@/components/ui/signal-primitives';
import { systemReportApi } from '@/lib/api';

interface GenerationHistoryPanelProps {
  generations: SystemReportGeneration[];
  onRefresh: () => void;
  t: (key: string) => string;
  locale: string;
}

export function GenerationHistoryPanel({
  generations,
  onRefresh,
  t,
  locale,
}: GenerationHistoryPanelProps) {
  const [selectedGeneration, setSelectedGeneration] = useState<SystemReportGeneration | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async (generation: SystemReportGeneration) => {
    setDownloading(generation.id);
    try {
      const fileName = `system-report-${generation.id}.${generation.format}`;
      await systemReportApi.downloadGeneration(generation.id, fileName);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(null);
    }
  };

  const getStatusTone = (status: string) => {
    switch (status) {
      case 'success': return 'success';
      case 'running': return 'info';
      case 'failed': return 'danger';
      case 'queued': return 'warning';
      default: return 'neutral';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; ru: string }> = {
      success: { en: 'Success', ru: 'Успешно' },
      running: { en: 'Running', ru: 'Выполняется' },
      failed: { en: 'Failed', ru: 'Ошибка' },
      queued: { en: 'Queued', ru: 'В очереди' },
    };
    return labels[status]?.[locale === 'ru' ? 'ru' : 'en'] || status;
  };

  return (
    <Panel variant="elevated" className="history-panel">
      <div className="panel-header">
        <h3>{t('generationHistory')}</h3>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={loading}>
          {loading ? '...' : (locale === 'ru' ? 'Обновить' : 'Refresh')}
        </button>
      </div>

      {loading ? (
        <LoadingLines rows={5} />
      ) : generations.length === 0 ? (
        <div className="history-empty">
          <p>{locale === 'ru' ? 'История генераций пуста' : 'No generation history yet'}</p>
        </div>
      ) : (
        <div className="generations-list">
          {generations.map((generation) => (
            <div
              key={generation.id}
              className={`generation-item ${selectedGeneration?.id === generation.id ? 'selected' : ''}`}
              onClick={() => setSelectedGeneration(selectedGeneration?.id === generation.id ? null : generation)}
            >
              <div className="generation-item-header">
                <div className="generation-meta">
                  <span className="generation-date">{formatDate(generation.createdAt)}</span>
                  {generation.templateName && (
                    <span className="generation-template">{generation.templateName}</span>
                  )}
                </div>
                <StatusBadge tone={getStatusTone(generation.status)}>
                  {getStatusLabel(generation.status)}
                </StatusBadge>
              </div>

              <div className="generation-item-details">
                <span className="detail-item">
                  {locale === 'ru' ? 'Формат' : 'Format'}: <strong>{generation.format.toUpperCase()}</strong>
                </span>
                {generation.progress > 0 && (
                  <span className="detail-item">
                    {locale === 'ru' ? 'Прогресс' : 'Progress'}: <strong>{generation.progress}%</strong>
                  </span>
                )}
                {generation.errorMessage && (
                  <span className="detail-item error">
                    {locale === 'ru' ? 'Ошибка' : 'Error'}: {generation.errorMessage}
                  </span>
                )}
              </div>

              {selectedGeneration?.id === generation.id && (
                <div className="generation-item-expanded">
                  {generation.sections && generation.sections.length > 0 && (
                    <div className="expanded-section">
                      <h5>{locale === 'ru' ? 'Секции' : 'Sections'}</h5>
                      <div className="sections-list">
                        {generation.sections.map((section) => (
                          <div key={section.key} className="section-status">
                            <span>{section.label}</span>
                            <StatusBadge tone={getStatusTone(section.status)}>
                              {section.status}
                            </StatusBadge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {generation.attachments && generation.attachments.length > 0 && (
                    <div className="expanded-section">
                      <h5>{locale === 'ru' ? 'Вложения' : 'Attachments'}</h5>
                      <div className="attachments-list">
                        {generation.attachments.map((attachment) => (
                          <div key={attachment.id} className="attachment-item">
                            <span className="attachment-name">{attachment.fileName}</span>
                            <span className="attachment-size">{formatBytes(attachment.fileSize)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="expanded-actions">
                    {generation.status === 'success' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(generation);
                        }}
                        disabled={downloading === generation.id}
                      >
                        {downloading === generation.id
                          ? (locale === 'ru' ? 'Загрузка...' : 'Downloading...')
                          : (locale === 'ru' ? 'Скачать' : 'Download')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
