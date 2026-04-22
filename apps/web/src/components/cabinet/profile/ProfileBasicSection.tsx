'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { FieldInput, Notice } from '@/components/ui/signal-primitives';
import type { AuthUser } from '@/hooks/useAuth';
import { ProfileSectionActions } from './ProfileSectionActions';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import type { ProfileSectionStatus } from './profile.types';

type ProfileBasicSectionProps = {
  locale: string;
  user: AuthUser;
  status: ProfileSectionStatus;
  saving: boolean;
  requiredFields: string[];
  eventTitle?: string;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function ProfileBasicSection({
  locale,
  user,
  status,
  saving,
  requiredFields,
  eventTitle,
  onSave,
}: ProfileBasicSectionProps) {
  const [lastNameCyrillic, setLastNameCyrillic] = useState(user.lastNameCyrillic ?? '');
  const [firstNameCyrillic, setFirstNameCyrillic] = useState(user.firstNameCyrillic ?? '');
  const [middleNameCyrillic, setMiddleNameCyrillic] = useState(user.middleNameCyrillic ?? '');
  const [lastNameLatin, setLastNameLatin] = useState(() => transliterateCyrillic(user.lastNameCyrillic ?? '') || user.lastNameLatin || '');
  const [firstNameLatin, setFirstNameLatin] = useState(() => transliterateCyrillic(user.firstNameCyrillic ?? '') || user.firstNameLatin || '');
  const [middleNameLatin, setMiddleNameLatin] = useState(() => transliterateCyrillic(user.middleNameCyrillic ?? '') || user.middleNameLatin || '');
  const [birthDate, setBirthDate] = useState(formatDateInput(user.birthDate));

  useEffect(() => {
    const nextLastNameCyrillic = user.lastNameCyrillic ?? '';
    const nextFirstNameCyrillic = user.firstNameCyrillic ?? '';
    const nextMiddleNameCyrillic = user.middleNameCyrillic ?? '';

    setLastNameCyrillic(nextLastNameCyrillic);
    setFirstNameCyrillic(nextFirstNameCyrillic);
    setMiddleNameCyrillic(nextMiddleNameCyrillic);
    setLastNameLatin(transliterateCyrillic(nextLastNameCyrillic) || user.lastNameLatin || '');
    setFirstNameLatin(transliterateCyrillic(nextFirstNameCyrillic) || user.firstNameLatin || '');
    setMiddleNameLatin(transliterateCyrillic(nextMiddleNameCyrillic) || user.middleNameLatin || '');
    setBirthDate(formatDateInput(user.birthDate));
  }, [user.lastNameCyrillic, user.firstNameCyrillic, user.middleNameCyrillic, user.lastNameLatin, user.firstNameLatin, user.middleNameLatin, user.birthDate]);

  const isRequired = (field: string) => requiredFields.includes(field);
  const updateLastNameCyrillic = (value: string) => {
    setLastNameCyrillic(value);
    setLastNameLatin(transliterateCyrillic(value));
  };
  const updateFirstNameCyrillic = (value: string) => {
    setFirstNameCyrillic(value);
    setFirstNameLatin(transliterateCyrillic(value));
  };
  const updateMiddleNameCyrillic = (value: string) => {
    setMiddleNameCyrillic(value);
    setMiddleNameLatin(transliterateCyrillic(value));
  };

  return (
    <ProfileSectionLayout
      locale={locale}
      title={locale === 'ru' ? 'Основное' : 'Basic'}
      description={locale === 'ru' ? 'ФИО и дата рождения для заявок' : 'Name and birth date for applications'}
      status={status}
    >
      <form
        className="signal-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({
            lastNameCyrillic,
            firstNameCyrillic,
            middleNameCyrillic,
            lastNameLatin,
            firstNameLatin,
            middleNameLatin,
            birthDate: toApiBirthDate(birthDate),
          });
        }}
      >
        <div className="signal-section-label">{locale === 'ru' ? 'Кириллица' : 'Cyrillic'}</div>
        <div className="profile-form-three-col">
          <FieldBlock
            label={locale === 'ru' ? 'Фамилия' : 'Last name'}
            required={isRequired('lastNameCyrillic')}
            hint={requiredHint(locale, 'lastNameCyrillic', requiredFields, eventTitle)}
          >
            <FieldInput value={lastNameCyrillic} onChange={(event) => updateLastNameCyrillic(event.target.value)} />
          </FieldBlock>
          <FieldBlock
            label={locale === 'ru' ? 'Имя' : 'First name'}
            required
            hint={requiredHint(locale, 'firstNameCyrillic', requiredFields, eventTitle)}
          >
            <FieldInput
              value={firstNameCyrillic}
              onChange={(event) => updateFirstNameCyrillic(event.target.value)}
              className={isRequired('firstNameCyrillic') ? 'signal-field-required' : ''}
            />
          </FieldBlock>
          <FieldBlock label={locale === 'ru' ? 'Отчество' : 'Patronymic'}>
            <FieldInput value={middleNameCyrillic} onChange={(event) => updateMiddleNameCyrillic(event.target.value)} />
          </FieldBlock>
        </div>

        <div className="profile-latin-heading">
          <div className="signal-section-label">{locale === 'ru' ? 'Латиница' : 'Latin'}</div>
        </div>
        <div className="profile-form-three-col">
          <FieldBlock label={locale === 'ru' ? 'Фамилия' : 'Last name'}>
            <FieldInput value={lastNameLatin} readOnly className="profile-auto-field" />
          </FieldBlock>
          <FieldBlock label={locale === 'ru' ? 'Имя' : 'First name'}>
            <FieldInput value={firstNameLatin} readOnly className="profile-auto-field" />
          </FieldBlock>
          <FieldBlock label={locale === 'ru' ? 'Отчество' : 'Patronymic'}>
            <FieldInput value={middleNameLatin} readOnly className="profile-auto-field" />
          </FieldBlock>
        </div>

        <div className="profile-form-narrow">
          <FieldBlock
            label={locale === 'ru' ? 'Дата рождения' : 'Birth date'}
            required
            hint={requiredHint(locale, 'birthDate', requiredFields, eventTitle)}
          >
            <ProfileDatePicker
              locale={locale}
              value={birthDate}
              onChange={setBirthDate}
              required={isRequired('birthDate')}
            />
          </FieldBlock>
        </div>

        <ProfileSectionActions locale={locale} saving={saving} />
      </form>
    </ProfileSectionLayout>
  );
}

function ProfileDatePicker({
  locale,
  value,
  onChange,
  required,
}: {
  locale: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const selectedDate = parseDateValue(value);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selectedDate ?? new Date(2000, 0, 1));
  const monthNames = locale === 'ru'
    ? ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekDays = locale === 'ru'
    ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1939 }, (_, index) => currentYear - index);

  useEffect(() => {
    if (selectedDate) setViewDate(selectedDate);
  }, [selectedDate]);

  const days = useMemo(() => getCalendarDays(viewDate), [viewDate]);

  function moveMonth(delta: number) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function selectDate(date: Date) {
    onChange(formatDateValue(date));
    setOpen(false);
  }

  return (
    <div className="profile-date-picker">
      <button
        type="button"
        className={`profile-calendar-field ${required ? 'signal-field-required' : ''}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedDate ? formatDisplayDate(selectedDate) : (locale === 'ru' ? 'Выберите дату' : 'Choose date')}</span>
        <CalendarIcon />
      </button>

      {open ? (
        <div className="profile-calendar-popover">
          <div className="profile-calendar-header">
            <button type="button" onClick={() => moveMonth(-1)} aria-label={locale === 'ru' ? 'Предыдущий месяц' : 'Previous month'}>&lt;</button>
            <div className="profile-calendar-selectors">
              <select
                value={viewDate.getMonth()}
                onChange={(event) => setViewDate((current) => new Date(current.getFullYear(), Number(event.target.value), 1))}
                aria-label={locale === 'ru' ? 'Месяц' : 'Month'}
              >
                {monthNames.map((month, index) => <option key={month} value={index}>{month}</option>)}
              </select>
              <select
                value={viewDate.getFullYear()}
                onChange={(event) => setViewDate((current) => new Date(Number(event.target.value), current.getMonth(), 1))}
                aria-label={locale === 'ru' ? 'Год' : 'Year'}
              >
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => moveMonth(1)} aria-label={locale === 'ru' ? 'Следующий месяц' : 'Next month'}>&gt;</button>
          </div>
          <div className="profile-calendar-weekdays">
            {weekDays.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="profile-calendar-grid">
            {days.map((day) => {
              const isSelected = selectedDate ? isSameDate(day.date, selectedDate) : false;
              return (
                <button
                  key={day.key}
                  type="button"
                  className={[
                    'profile-calendar-day',
                    !day.isCurrentMonth ? 'muted' : '',
                    day.isToday ? 'today' : '',
                    isSelected ? 'selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectDate(day.date)}
                >
                  {day.date.getDate()}
                </button>
              );
            })}
          </div>
          <Notice tone="info">
            {locale === 'ru' ? 'Формат даты сохранится автоматически.' : 'Date format is saved automatically.'}
          </Notice>
        </div>
      ) : null}
    </div>
  );
}

function FieldBlock({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="signal-stack cabinet-field-block">
      <span className="cabinet-field-label">
        {label} {required ? <span className="cabinet-field-required">*</span> : null}
      </span>
      {children}
      {hint ? <span className="signal-muted signal-required-hint">{hint}</span> : null}
    </label>
  );
}

function requiredHint(locale: string, field: string, requiredFields: string[], eventTitle?: string) {
  if (!requiredFields.includes(field)) return null;
  return locale === 'ru'
    ? `Обязательно${eventTitle ? ` для "${eventTitle}"` : ''}.`
    : `Required${eventTitle ? ` for "${eventTitle}"` : ''}.`;
}

function formatDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toApiBirthDate(value: string) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function transliterateCyrillic(value: string) {
  const map: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'i',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'kh',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };

  return value
    .split('')
    .map((char) => {
      const lower = char.toLocaleLowerCase('ru');
      const next = map[lower];
      if (next === undefined) return char;
      return char === lower ? next : capitalize(next);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trimStart();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseDateValue(value: string) {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date) {
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear(),
  ].join(' / ');
}

function getCalendarDays(viewDate: Date) {
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - startOffset);
  const today = new Date();

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: formatDateValue(date),
      isCurrentMonth: date.getMonth() === viewDate.getMonth(),
      isToday: isSameDate(date, today),
    };
  });
}

function isSameDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}
