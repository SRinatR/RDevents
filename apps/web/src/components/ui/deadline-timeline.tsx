'use client';

import { useTranslations } from 'next-intl';
import { StatusBadge } from './status-badge';

interface Deadline {
  type: string;
  at: string;
  label?: string;
}

interface DeadlineTimelineProps {
  deadlines: Deadline[];
  locale: string;
  compact?: boolean;
}

const DEADLINE_LABELS: Record<string, { ru: string; en: string }> = {
  REGISTRATION_OPEN: { ru: 'Открытие регистрации', en: 'Registration opens' },
  REGISTRATION_CLOSE: { ru: 'Закрытие регистрации', en: 'Registration closes' },
  TEAM_SUBMIT_DEADLINE: { ru: 'Подача команды', en: 'Team submission deadline' },
  DOCUMENT_UPLOAD_DEADLINE: { ru: 'Загрузка документов', en: 'Document upload deadline' },
  CHECK_IN: { ru: 'Заезд / регистрация', en: 'Check-in' },
  EVENT_START: { ru: 'Начало события', en: 'Event starts' },
  EVENT_END: { ru: 'Завершение события', en: 'Event ends' },
  CUSTOM: { ru: 'Важная дата', en: 'Important date' },
};

function formatDate(dateStr: string, locale: string): { date: string; time: string; isPast: boolean } {
  const date = new Date(dateStr);
  const now = new Date();
  const isPast = date < now;
  
  const dateFormatter = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
  
  const timeFormatter = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    date: dateFormatter.format(date),
    time: timeFormatter.format(date),
    isPast,
  };
}

export function DeadlineTimeline({ deadlines, locale, compact = false }: DeadlineTimelineProps) {
  const t = useTranslations();

  if (!deadlines || deadlines.length === 0) {
    return (
      <div className="text-muted text-sm">
        {locale === 'ru' ? 'Нет предстоящих дедлайнов' : 'No upcoming deadlines'}
      </div>
    );
  }

  const sortedDeadlines = [...deadlines].sort((a, b) => 
    new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        {sortedDeadlines.slice(0, 4).map((deadline, idx) => {
          const { date, time, isPast } = formatDate(deadline.at, locale);
          const labels = DEADLINE_LABELS[deadline.type] ?? { 
            ru: deadline.type.replace(/_/g, ' '), 
            en: deadline.type.replace(/_/g, ' ') 
          };

          return (
            <div key={idx} className={`flex items-center gap-2 text-sm ${isPast ? 'opacity-50' : ''}`}>
              <div className={`w-2 h-2 rounded-full ${isPast ? 'bg-gray-400' : 'bg-blue-500'}`} />
              <span className="text-muted">{labels[locale === 'ru' ? 'ru' : 'en']}</span>
              <span className="font-medium ml-auto">
                {date}, {time}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
      <div className="flex flex-col gap-4">
        {sortedDeadlines.map((deadline, idx) => {
          const { date, time, isPast } = formatDate(deadline.at, locale);
          const labels = DEADLINE_LABELS[deadline.type] ?? { 
            ru: deadline.type.replace(/_/g, ' '), 
            en: deadline.type.replace(/_/g, ' ') 
          };
          const isNext = idx === 0 && !isPast;
          const isSoon = !isPast && new Date(deadline.at).getTime() - Date.now() < 24 * 60 * 60 * 1000;

          return (
            <div key={idx} className="relative flex items-start gap-4">
              <div 
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  isNext 
                    ? 'bg-blue-500 border-blue-500 text-white' 
                    : isPast 
                      ? 'bg-gray-100 border-gray-300 text-gray-500' 
                      : 'bg-white border-blue-300 text-blue-600'
                }`}
              >
                {isNext ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="text-xs font-bold">{idx + 1}</span>
                )}
              </div>
              
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${isPast ? 'text-muted' : 'text-gray-900'}`}>
                    {labels[locale === 'ru' ? 'ru' : 'en']}
                  </span>
                  {isNext && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                      {locale === 'ru' ? 'Скоро' : 'Next'}
                    </span>
                  )}
                  {isSoon && !isNext && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                      {locale === 'ru' ? 'Вскоре' : 'Soon'}
                    </span>
                  )}
                </div>
                <div className={`text-sm ${isPast ? 'text-muted' : 'text-gray-600'}`}>
                  {date} {locale === 'ru' ? 'в' : 'at'} {time}
                </div>
                {deadline.label && (
                  <div className="mt-1 text-xs text-muted">{deadline.label}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}