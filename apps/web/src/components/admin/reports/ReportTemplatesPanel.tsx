'use client';

import { useState } from 'react';
import type { SystemReportTemplate } from '@/lib/api';
import { Panel } from '@/components/ui/signal-primitives';

interface ReportTemplatesPanelProps {
  templates: SystemReportTemplate[];
  selectedTemplate: SystemReportTemplate | null;
  onSelect: (template: SystemReportTemplate) => void;
  onDelete: (templateId: string) => void;
  onSetDefault: (templateId: string) => void;
  onCreateNew: () => void;
  locale: string;
  t: (key: string) => string;
}

export function ReportTemplatesPanel({
  templates,
  selectedTemplate,
  onSelect,
  onDelete,
  onSetDefault,
  onCreateNew,
  locale,
  t,
}: ReportTemplatesPanelProps) {
  const [contextMenu, setContextMenu] = useState<string | null>(null);

  const getPresetLabel = (name: string) => {
    const labels: Record<string, string> = {
      'Health Report': locale === 'ru' ? 'Базовый health report' : 'Health Report',
      'Full Infrastructure': locale === 'ru' ? 'Полный infra report' : 'Full Infrastructure',
      'Deploy Diagnostics': locale === 'ru' ? 'Deploy diagnostics' : 'Deploy Diagnostics',
      'Security Audit': locale === 'ru' ? 'Security / config audit' : 'Security Audit',
    };
    return labels[name] || name;
  };

  const getPresetDescription = (name: string) => {
    const descriptions: Record<string, string> = {
      'Health Report': locale === 'ru' ? 'Основные метрики здоровья системы' : 'Basic system health metrics',
      'Full Infrastructure': locale === 'ru' ? 'Полная диагностика инфраструктуры' : 'Complete infrastructure diagnostics',
      'Deploy Diagnostics': locale === 'ru' ? 'Информация о развёртывании' : 'Deployment information',
      'Security Audit': locale === 'ru' ? 'Аудит безопасности и конфигурации' : 'Security and configuration audit',
    };
    return descriptions[name] || '';
  };

  return (
    <Panel variant="elevated" className="templates-panel">
      <div className="panel-header">
        <h3>{t('templates')}</h3>
        <button className="btn btn-ghost btn-sm" onClick={onCreateNew}>
          + {locale === 'ru' ? 'Новый' : 'New'}
        </button>
      </div>

      <div className="templates-list">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`template-item ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
            onClick={() => onSelect(template)}
          >
            <div className="template-item-content" onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(contextMenu === template.id ? null : template.id);
            }}>
              <div className="template-item-header">
                <span className="template-name">{getPresetLabel(template.name)}</span>
                {template.isDefault && (
                  <span className="template-badge-default">{locale === 'ru' ? 'По умолч.' : 'Default'}</span>
                )}
              </div>
              {template.description && (
                <p className="template-description">{getPresetDescription(template.name) || template.description}</p>
              )}
            </div>

            {contextMenu === template.id && (
              <div className="template-context-menu">
                {!template.isDefault && (
                  <button
                    className="context-menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetDefault(template.id);
                      setContextMenu(null);
                    }}
                  >
                    {locale === 'ru' ? 'Сделать по умолчанию' : 'Set as default'}
                  </button>
                )}
                <button
                  className="context-menu-item danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(template.id);
                    setContextMenu(null);
                  }}
                >
                  {locale === 'ru' ? 'Удалить' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        ))}

        {templates.length === 0 && (
          <div className="templates-empty">
            <p>{locale === 'ru' ? 'Нет сохранённых шаблонов' : 'No saved templates'}</p>
            <button className="btn btn-secondary btn-sm" onClick={onCreateNew}>
              {locale === 'ru' ? 'Создать первый' : 'Create first'}
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}
