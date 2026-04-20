'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type AdminDateTimePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locale: string;
  required?: boolean;
};

const MONTHS = {
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const WEEKDAYS = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

export function AdminDateTimePicker({ label, value, onChange, locale, required }: AdminDateTimePickerProps) {
  const isRu = locale === 'ru';
  const selectedDate = parseDateTimeValue(value);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selectedDate ?? new Date());
  const monthKey = isRu ? 'ru' : 'en';
  const days = useMemo(() => buildMonthDays(viewDate), [viewDate]);
  const timeValue = value?.split('T')[1] || '09:00';
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, index) => currentYear - 2 + index);
  }, []);

  function updateDate(day: Date) {
    onChange(formatDateTime(day, timeValue));
    setViewDate(day);
  }

  function updateTime(nextTime: string) {
    const baseDate = selectedDate ?? viewDate ?? new Date();
    onChange(formatDateTime(baseDate, nextTime || '09:00'));
  }

  return (
    <div className="admin-datetime-picker">
      <label className="admin-datetime-label">{label}</label>
      <button
        type="button"
        className={cn('admin-datetime-field', required && !value && 'signal-field-required')}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span>{value ? formatReadableDateTime(value, locale) : (isRu ? 'Выберите дату и время' : 'Choose date and time')}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open ? (
        <div className="admin-datetime-popover">
          <div className="admin-calendar-header">
            <button type="button" onClick={() => setViewDate(shiftMonth(viewDate, -1))} aria-label={isRu ? 'Предыдущий месяц' : 'Previous month'}>‹</button>
            <div className="admin-calendar-selectors">
              <select
                value={viewDate.getMonth()}
                onChange={(event) => setViewDate(new Date(viewDate.getFullYear(), Number(event.target.value), 1))}
              >
                {MONTHS[monthKey].map((month, index) => (
                  <option key={month} value={index}>{month}</option>
                ))}
              </select>
              <select
                value={viewDate.getFullYear()}
                onChange={(event) => setViewDate(new Date(Number(event.target.value), viewDate.getMonth(), 1))}
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => setViewDate(shiftMonth(viewDate, 1))} aria-label={isRu ? 'Следующий месяц' : 'Next month'}>›</button>
          </div>

          <div className="admin-calendar-weekdays">
            {WEEKDAYS[monthKey].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="admin-calendar-grid">
            {days.map((day) => {
              const selected = selectedDate ? isSameDay(day.date, selectedDate) : false;
              const today = isSameDay(day.date, new Date());
              return (
                <button
                  key={day.date.toISOString()}
                  type="button"
                  className={cn('admin-calendar-day', !day.currentMonth && 'muted', today && 'today', selected && 'selected')}
                  onClick={() => updateDate(day.date)}
                >
                  {day.date.getDate()}
                </button>
              );
            })}
          </div>

          <label className="admin-datetime-time">
            <span>{isRu ? 'Время' : 'Time'}</span>
            <input type="time" value={timeValue} onChange={(event) => updateTime(event.target.value)} />
          </label>

          <div className="admin-datetime-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>{isRu ? 'Очистить' : 'Clear'}</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>{isRu ? 'Готово' : 'Done'}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseDateTimeValue(value: string) {
  if (!value) return null;
  const [datePart, timePart = '09:00'] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
}

function formatDateTime(date: Date, time: string) {
  const [hours = '09', minutes = '00'] = time.split(':');
  const next = new Date(date);
  next.setHours(Number(hours), Number(minutes), 0, 0);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

function formatReadableDateTime(value: string, locale: string) {
  const date = parseDateTimeValue(value);
  if (!date) return value;
  return date.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildMonthDays(viewDate: Date) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      currentMonth: date.getMonth() === viewDate.getMonth(),
    };
  });
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}
