'use client';

import { FieldInput, FieldSelect } from '@/components/ui/signal-primitives';

interface Props {
  locale: string;
  status: string;
  onStatusChange: (v: string) => void;
  unassigned: boolean;
  onUnassignedChange: (v: boolean) => void;
  search: string;
  onSearchChange: (v: string) => void;
}

const STATUS_OPTIONS = [
  { value: '', labelEn: 'All statuses', labelRu: 'Все статусы' },
  { value: 'OPEN', labelEn: 'Open', labelRu: 'Открыто' },
  { value: 'IN_PROGRESS', labelEn: 'In progress', labelRu: 'В работе' },
  { value: 'WAITING_USER', labelEn: 'Waiting user', labelRu: 'Ожидает' },
  { value: 'CLOSED', labelEn: 'Closed', labelRu: 'Закрыто' },
];

export function AdminSupportFilters({
  locale,
  status,
  onStatusChange,
  unassigned,
  onUnassignedChange,
  search,
  onSearchChange,
}: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
      <FieldInput
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={locale === 'ru' ? 'Поиск по теме или пользователю…' : 'Search by subject or user…'}
        style={{ minWidth: '220px', flex: '1 1 220px' }}
      />
      <FieldSelect
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        style={{ minWidth: '160px' }}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {locale === 'ru' ? opt.labelRu : opt.labelEn}
          </option>
        ))}
      </FieldSelect>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={unassigned}
          onChange={(e) => onUnassignedChange(e.target.checked)}
          style={{ accentColor: 'var(--color-primary)' }}
        />
        {locale === 'ru' ? 'Без назначения' : 'Unassigned'}
      </label>
    </div>
  );
}
