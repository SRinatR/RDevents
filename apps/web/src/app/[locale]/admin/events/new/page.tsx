'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../../hooks/useAuth';
import { adminApi } from '../../../../../lib/api';
import { useRouteLocale } from '../../../../../hooks/useRouteParams';

export default function NewEventPage() {
  const t = useTranslations();
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    slug: '',
    shortDescription: '',
    description: '',
    category: 'TECH',
    status: 'DRAFT',
    coverImageUrl: '',
    location: '',
    startsAt: '',
    endsAt: '',
    capacity: 100,
    registrationDeadline: '',
    conditions: '',
    contactEmail: '',
    contactPhone: '',
    tags: '',
  });

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'title') {
        next.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const payload = {
      ...form,
      capacity: parseInt(String(form.capacity)) || 100,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };

    try {
      const result = await adminApi.createEvent(payload);
      router.push(`/${locale}/admin/events/${result.event.id}/edit?created=1`);
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user || !isAdmin) return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
    </div>
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 0 60px' }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 32 }}>
          <a href={`/${locale}/admin/events`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.9rem', marginBottom: 12 }}>
            ← {t('common.back')}
          </a>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900, letterSpacing: 0 }}>
            {t('admin.createEvent')}
          </h1>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-lg)', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          {/* Title & Slug */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Title *</label>
              <input name="title" value={form.title} onChange={handleChange} required style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Slug</label>
              <input name="slug" value={form.slug} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-bg-subtle)', fontSize: '0.95rem', boxSizing: 'border-box', color: 'var(--color-text-muted)' }} />
            </div>
          </div>

          {/* Short description */}
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Short description</label>
            <input name="shortDescription" value={form.shortDescription} onChange={handleChange} placeholder="Brief summary for cards and listings" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Description *</label>
            <textarea name="description" value={form.description} onChange={handleChange} required rows={5} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>

          {/* Category & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Category</label>
              <select name="category" value={form.category} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }}>
                {['TECH', 'BUSINESS', 'ART', 'MUSIC', 'SPORT', 'EDUCATION', 'SOCIAL', 'OTHER'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Status</label>
              <select name="status" value={form.status} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
          </div>

          {/* Cover image */}
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Cover image URL</label>
            <input name="coverImageUrl" value={form.coverImageUrl} onChange={handleChange} placeholder="https://..." type="url" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>

          {/* Location */}
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Location</label>
            <input name="location" value={form.location} onChange={handleChange} placeholder="Venue name or address" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Starts at *</label>
              <input name="startsAt" value={form.startsAt} onChange={handleChange} required type="datetime-local" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Ends at</label>
              <input name="endsAt" value={form.endsAt} onChange={handleChange} type="datetime-local" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Registration deadline</label>
              <input name="registrationDeadline" value={form.registrationDeadline} onChange={handleChange} type="datetime-local" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Capacity */}
          <div style={{ maxWidth: 200 }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Capacity</label>
            <input name="capacity" value={form.capacity} onChange={handleChange} type="number" min="1" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>

          {/* Conditions */}
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Participation conditions</label>
            <textarea name="conditions" value={form.conditions} onChange={handleChange} rows={3} placeholder="Any requirements or rules for participants" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>

          {/* Contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Contact email</label>
              <input name="contactEmail" value={form.contactEmail} onChange={handleChange} type="email" placeholder="event@example.com" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Contact phone</label>
              <input name="contactPhone" value={form.contactPhone} onChange={handleChange} type="tel" placeholder="+998..." style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Tags (comma-separated)</label>
            <input name="tags" value={form.tags} onChange={handleChange} placeholder="react, typescript, web" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
            <button type="submit" disabled={submitting} style={{ padding: '12px 28px', borderRadius: 'var(--radius-lg)', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Creating...' : t('admin.createEvent')}
            </button>
            <a href={`/${locale}/admin/events`} style={{ padding: '12px 28px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontWeight: 700, textDecoration: 'none' }}>
              {t('common.cancel')}
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
