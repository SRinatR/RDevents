'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';

export default function AdminProfileFieldsPage() {
  const { user, loading, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';
  const [fields, setFields] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [visibility, setVisibility] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !isPlatformAdmin) router.push(`/${locale}/admin`);
  }, [loading, isPlatformAdmin, locale, router]);

  useEffect(() => {
    adminApi.getProfileFields().then((res) => setFields(res.fields)).catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => fields.filter((item) => {
    if (section !== 'all' && item.sectionKey !== section) return false;
    if (visibility === 'visible' && !item.isVisibleInCabinet) return false;
    if (visibility === 'hidden' && item.isVisibleInCabinet) return false;
    if (visibility === 'in_use' && item.usedInEventsCount === 0) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return item.key.toLowerCase().includes(q) || String(item.label?.ru ?? '').toLowerCase().includes(q) || String(item.label?.en ?? '').toLowerCase().includes(q);
  }), [fields, query, section, visibility]);

  async function toggle(item: any) {
    const next = !item.isVisibleInCabinet;
    if (!next && !window.confirm(isRu ? `Скрыть поле ${item.key}?` : `Hide ${item.key}?`)) return;
    setError('');
    try {
      await adminApi.patchProfileFieldVisibility(item.key, next);
      setFields((prev) => prev.map((current) => current.key === item.key ? { ...current, isVisibleInCabinet: next } : current));
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.code ? ` (${err.code})` : ''}`);
      } else {
        setError(err.message ?? 'Failed');
      }
    }
  }

  if (loading || !user || !isPlatformAdmin) return null;

  return (
    <div className="container" style={{ padding: '24px 0' }}>
      <h1>{isRu ? 'Видимость полей профиля' : 'Profile field visibility'}</h1>
      {error ? <p style={{ color: '#dc2626' }}>{error}</p> : null}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isRu ? 'Поиск по ключу или названию' : 'Search by key or label'} />
        <select value={section} onChange={(event) => setSection(event.target.value)}>
          <option value="all">{isRu ? 'Все разделы' : 'All sections'}</option>
          {[...new Set(fields.map((item) => item.sectionKey))].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
          <option value="all">{isRu ? 'Все статусы' : 'All statuses'}</option>
          <option value="visible">{isRu ? 'Видимые' : 'Visible'}</option>
          <option value="hidden">{isRu ? 'Скрытые' : 'Hidden'}</option>
          <option value="in_use">{isRu ? 'Используются в событиях' : 'In use'}</option>
        </select>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.map((item) => (
          <div key={item.key} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{item.key}</strong> <span style={{ opacity: .7 }}>({item.sectionKey})</span>
              <div>{isRu ? item.label?.ru : item.label?.en}</div>
              <small>{isRu ? `Используется в событиях: ${item.usedInEventsCount}` : `Used in events: ${item.usedInEventsCount}`}</small>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => void toggle(item)}>{item.isVisibleInCabinet ? (isRu ? 'Скрыть' : 'Hide') : (isRu ? 'Показать' : 'Show')}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
