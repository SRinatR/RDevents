'use client';

import type { ReportStage } from '@/lib/api';

interface TimelineStage {
  key: ReportStage;
  label: string;
  description: string;
}

const TIMELINE_STAGES: TimelineStage[] = [
  {
    key: 'queued',
    label: 'Queued',
    description: 'Report job is waiting to be processed',
  },
  {
    key: 'collecting',
    label: 'Collecting Data',
    description: 'Gathering information from all enabled sections',
  },
  {
    key: 'assembling',
    label: 'Assembling',
    description: 'Building the final report from collected data',
  },
  {
    key: 'writing_artifacts',
    label: 'Writing Files',
    description: 'Saving report files and attachments',
  },
  {
    key: 'finalizing',
    label: 'Finalizing',
    description: 'Completing the generation process',
  },
];

interface GenerationTimelineProps {
  currentStage?: ReportStage;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  stages?: Array<{
    key: string;
    label: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    message?: string;
  }>;
}

export function GenerationTimeline({
  currentStage,
  progress,
  startedAt,
  completedAt,
  stages,
}: GenerationTimelineProps) {
  const getStageIndex = (stage?: string) => {
    if (!stage) return -1;
    return TIMELINE_STAGES.findIndex((s) => s.key === stage);
  };

  const currentIndex = getStageIndex(currentStage);
  const isCompleted = completedAt !== undefined;

  const formatDuration = (start?: string, end?: string) => {
    if (!start) return '';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diff = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);

    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  return (
    <div className="generation-timeline">
      <div className="timeline-header">
        <h4>Generation Progress</h4>
        {startedAt && (
          <div className="timeline-meta">
            <span>Started: {new Date(startedAt).toLocaleTimeString()}</span>
            {completedAt && (
              <span>Duration: {formatDuration(startedAt, completedAt)}</span>
            )}
          </div>
        )}
      </div>

      <div className="timeline-stages">
        {TIMELINE_STAGES.map((stage, index) => {
          const isPast = index < currentIndex || isCompleted;
          const isCurrent = index === currentIndex && !isCompleted;
          const isFuture = index > currentIndex && !isCompleted;

          const stageDetail = stages?.find((s) => s.key === stage.key);

          let statusClass = 'future';
          if (isPast) statusClass = 'past';
          if (isCurrent) statusClass = 'current';
          if (isCompleted && index <= currentIndex) statusClass = 'completed';

          return (
            <div
              key={stage.key}
              className={`timeline-stage ${statusClass}`}
            >
              <div className="stage-marker">
                <div className="stage-dot">
                  {isPast || (isCompleted && index <= currentIndex) ? (
                    <span className="check-icon">✓</span>
                  ) : isCurrent ? (
                    <span className="spinner-icon">◌</span>
                  ) : (
                    <span className="pending-icon">○</span>
                  )}
                </div>
                {index < TIMELINE_STAGES.length - 1 && (
                  <div className={`stage-line ${isPast || (isCompleted && index < currentIndex) ? 'filled' : ''}`} />
                )}
              </div>

              <div className="stage-content">
                <div className="stage-header">
                  <span className="stage-label">{stage.label}</span>
                  {stageDetail?.startedAt && (
                    <span className="stage-duration">
                      {formatDuration(stageDetail.startedAt, stageDetail.completedAt)}
                    </span>
                  )}
                </div>
                <p className="stage-description">{stage.description}</p>

                {stageDetail?.message && (
                  <div className="stage-message">
                    {stageDetail.message}
                  </div>
                )}

                {isCurrent && (
                  <div className="stage-progress">
                    <div className="stage-progress-bar">
                      <div
                        className="stage-progress-fill"
                        style={{
                          width: `${Math.max(0, Math.min(100, progress - index * 20))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isCompleted && (
        <div className="timeline-footer">
          <div className="completion-badge">
            <span className="badge-icon">✓</span>
            Report Generation {currentStage === 'finalizing' ? 'Completed' : 'Failed'}
          </div>
        </div>
      )}
    </div>
  );
}
