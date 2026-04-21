'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface ActionItem {
  id: string;
  type: 'profile' | 'team' | 'document' | 'confirmation' | 'invitation' | 'general';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description?: string;
  href: string;
  dueDate?: string;
  completed?: boolean;
}

interface ActionCenterProps {
  actions: ActionItem[];
  locale: string;
  eventSlug?: string;
}

const PRIORITY_CONFIG = {
  high: {
    icon: '⚠️',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
  },
  medium: {
    icon: '📋',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
  },
  low: {
    icon: '💡',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
  },
};

const TYPE_ICONS: Record<string, string> = {
  profile: '👤',
  team: '👥',
  document: '📄',
  confirmation: '✅',
  invitation: '📬',
  general: '⭐',
};

export function ActionCenter({ actions, locale, eventSlug }: ActionCenterProps) {
  const t = useTranslations();

  if (!actions || actions.length === 0) {
    return (
      <div className="action-center-empty">
        <div className="check-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <p className="text-muted">
          {locale === 'ru' ? 'Всё выполнено!' : 'All done!'}
        </p>
      </div>
    );
  }

  const highPriority = actions.filter(a => a.priority === 'high');
  const mediumPriority = actions.filter(a => a.priority === 'medium');
  const lowPriority = actions.filter(a => a.priority !== 'high' && a.priority !== 'medium');

  const sections = [
    { label: locale === 'ru' ? 'Срочно' : 'Urgent', items: highPriority },
    { label: locale === 'ru' ? 'Нужно сделать' : 'To do', items: mediumPriority },
    { label: locale === 'ru' ? 'Дополнительно' : 'Optional', items: lowPriority },
  ].filter(s => s.items.length > 0);

  return (
    <div className="action-center-list">
      {sections.map((section, sIdx) => (
        <div key={section.label} className="action-section">
          <div className="action-section-header">
            <span className="action-section-label">{section.label}</span>
            <span className="action-section-count">{section.items.length}</span>
          </div>
          <div className="action-items">
            {section.items.map((action) => {
              const config = PRIORITY_CONFIG[action.priority];
              const icon = TYPE_ICONS[action.type] || TYPE_ICONS.general;

              return (
                <Link
                  key={action.id}
                  href={action.href}
                  className={`action-item ${config.bg} ${config.border} border`}
                >
                  <div className="action-icon">{icon}</div>
                  <div className="action-content">
                    <div className="action-title">{action.title}</div>
                    {action.description && (
                      <div className="action-description">{action.description}</div>
                    )}
                  </div>
                  {action.dueDate && (
                    <div className="action-due">
                      <span className="due-label">
                        {locale === 'ru' ? 'до' : 'by'}
                      </span>
                      <span className="due-date">
                        {new Date(action.dueDate).toLocaleDateString(
                          locale === 'ru' ? 'ru-RU' : 'en-US',
                          { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                        )}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}