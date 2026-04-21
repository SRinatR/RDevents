'use client';

type CsvRow = Record<string, unknown>;

export function downloadCsv(filename: string, rows: CsvRow[]) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const body = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(',')),
  ].join('\r\n');
  const blob = new Blob([`\ufeff${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function formatCsvDate(value: unknown, locale: string) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US');
}

function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join('; ') : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
