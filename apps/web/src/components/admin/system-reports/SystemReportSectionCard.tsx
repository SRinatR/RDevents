'use client';

import type { SystemReportSectionDefinition, SystemReportSectionOption } from '@/lib/api';

interface SystemReportSectionCardProps {
  section: SystemReportSectionDefinition;
  enabled: boolean;
  options: Record<string, unknown>;
  onToggle: (enabled: boolean) => void;
  onOptionsChange: (key: string, value: unknown) => void;
}

function SectionOptionField({
  option,
  value,
  onChange,
}: {
  option: SystemReportSectionOption;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (option.type) {
    case 'boolean':
      return (
        <label className="sr-option sr-option-boolean">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{option.label}</span>
        </label>
      );

    case 'number':
      return (
        <label className="sr-option">
          <span className="option-label">{option.label}</span>
          <input
            type="number"
            className="option-input"
            value={typeof value === 'number' ? value : Number(option.default ?? 0)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </label>
      );

    case 'select':
      return (
        <label className="sr-option">
          <span className="option-label">{option.label}</span>
          <select
            className="option-select"
            value={String(value ?? option.default ?? '')}
            onChange={(e) => onChange(e.target.value)}
          >
            {(option.options ?? []).map((item) => (
              <option key={String(item)} value={String(item)}>
                {String(item)}
              </option>
            ))}
          </select>
        </label>
      );

    case 'text':
    default:
      return (
        <label className="sr-option">
          <span className="option-label">{option.label}</span>
          <input
            type="text"
            className="option-input"
            value={String(value ?? option.default ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      );
  }
}

export function SystemReportSectionCard({
  section,
  enabled,
  options,
  onToggle,
  onOptionsChange,
}: SystemReportSectionCardProps) {
  return (
    <div className={`sr-section-card ${enabled ? 'enabled' : 'disabled'}`}>
      <div className="section-header">
        <label className="section-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="section-title">{section.label}</span>
        </label>
      </div>

      <p className="section-description">{section.description}</p>

      {enabled && section.options.length > 0 && (
        <div className="section-options">
          {section.options.map((option) => (
            <SectionOptionField
              key={option.key}
              option={option}
              value={options[option.key] ?? option.default}
              onChange={(value) => onOptionsChange(option.key, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
