'use client';

import { Panel, SectionHeader } from '@/components/ui/signal-primitives';
import { formatDeadlineType, formatDeadlineDate } from './dashboard.formatters';
import type { DeadlineData } from './dashboard.types';

interface CabinetDeadlinesCardProps {
  deadlines: DeadlineData[];
  locale: string;
}

export function CabinetDeadlinesCard({ deadlines, locale }: CabinetDeadlinesCardProps) {
  if (!deadlines || deadlines.length === 0) {
    return (
      <Panel className="deadlines-panel">
        <SectionHeader title={locale === 'ru' ? 'Важные даты' : 'Important dates'} />
        <p className="signal-muted deadlines-empty">
          {locale === 'ru' ? 'Нет предстоящих дедлайнов' : 'No upcoming deadlines'}
        </p>
      </Panel>
    );
  }

  const sortedDeadlines = [...deadlines].sort((a, b) => 
    new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  return (
    <Panel className="deadlines-panel">
      <SectionHeader title={locale === 'ru' ? 'Важные даты' : 'Important dates'} />
      
      <div className="deadlines-timeline">
        {sortedDeadlines.map((deadline, idx) => {
          const { date, time, isPast, isToday, isTomorrow, relativeLabel } = formatDeadlineDate(deadline.at, locale);
          const typeLabel = formatDeadlineType(deadline.type, locale);
          const isNext = idx === 0 && !isPast;
          
          return (
            <div 
              key={idx} 
              className={`deadline-item ${isPast ? 'past' : ''} ${isNext ? 'next' : ''}`}
            >
              <div className="deadline-indicator">
                {isNext ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" fill="none" />
                  </svg>
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              
              <div className="deadline-content">
                <span className="deadline-type">{typeLabel}</span>
                <span className="deadline-date">
                  {date}
                  {!isToday && !isTomorrow && `, ${time}`}
                  {(isToday || isTomorrow) && ` ${time}`}
                </span>
              </div>
              
              {relativeLabel && !isPast && (
                <span className={`deadline-badge ${isToday ? 'today' : 'tomorrow'}`}>
                  {relativeLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
