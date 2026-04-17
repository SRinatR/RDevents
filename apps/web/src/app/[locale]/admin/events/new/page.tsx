'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../../hooks/useAuth';
import { adminApi } from '../../../../../lib/api';
import { useRouteLocale } from '../../../../../hooks/useRouteParams';

const PROFILE_REQUIREMENT_OPTIONS = [
  { key: 'name', label: 'Full name' },
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'birthDate', label: 'Date of birth' },
];

const EVENT_REQUIREMENT_HINT = 'motivation, experience, teamPreference, tshirtSize, emergencyContact, preferredSlot';

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
    category: 'Tech',
    status: 'DRAFT',
    coverImageUrl: '',
    location: '',
    startsAt: '',
    endsAt: '',
    capacity: 100,
    registrationOpensAt: '',
    registrationDeadline: '',
    conditions: '',
    contactEmail: '',
    contactPhone: '',
    tags: '',
    isTeamBased: false,
    minTeamSize: 1,
    maxTeamSize: 1,
    allowSoloParticipation: true,
    teamJoinMode: 'OPEN',
    requireAdminApprovalForTeams: false,
    requiredProfileFields: [] as string[],
    requiredEventFields: '',
    // Participation config
    requireParticipantApproval: false,
    participantLimitMode: 'UNLIMITED',
    participantTarget: undefined as number | undefined,
    participantCountVisibility: 'PUBLIC',
  });

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const nextValue = e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
      ? e.target.checked
      : value;
    setForm(prev => {
      const next = { ...prev, [name]: nextValue };
      if (name === 'title') {
        next.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
      return next;
    });
  };

  const toggleRequiredProfileField = (field: string) => {
    setForm(prev => ({
      ...prev,
      requiredProfileFields: prev.requiredProfileFields.includes(field)
        ? prev.requiredProfileFields.filter(item => item !== field)
        : [...prev.requiredProfileFields, field],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const payload = {
      ...form,
      capacity: parseInt(String(form.capacity)) || 100,
      minTeamSize: parseInt(String(form.minTeamSize)) || 1,
      maxTeamSize: parseInt(String(form.maxTeamSize)) || 1,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      registrationOpensAt: form.registrationOpensAt ? new Date(form.registrationOpensAt).toISOString() : undefined,
      registrationDeadline: form.registrationDeadline ? new Date(form.registrationDeadline).toISOString() : undefined,
      requiredProfileFields: form.requiredProfileFields,
      requiredEventFields: form.requiredEventFields.split(',').map(field => field.trim()).filter(Boolean),
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
                {['Tech', 'Business', 'Design', 'Arts & Culture', 'Sports', 'Community', 'Education', 'Other'].map(c => (
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Starts at *</label>
              <input name="startsAt" value={form.startsAt} onChange={handleChange} required type="datetime-local" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Ends at</label>
              <input name="endsAt" value={form.endsAt} onChange={handleChange} type="datetime-local" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Registration opens</label>
              <input name="registrationOpensAt" value={form.registrationOpensAt} onChange={handleChange} type="datetime-local" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
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

          {/* Participation settings */}
          <div style={{ padding: 18, borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 900 }}>Participation Settings</h2>
            <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Configure how users join this event. Different modes control approval flow and capacity limits.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Limit mode</label>
                <select name="participantLimitMode" value={form.participantLimitMode} onChange={handleChange} className="input-field">
                  <option value="UNLIMITED">Unlimited</option>
                  <option value="GOAL_LIMIT">Goal (soft limit)</option>
                  <option value="STRICT_LIMIT">Strict limit</option>
                </select>
              </div>
              {(form.participantLimitMode === 'GOAL_LIMIT' || form.participantLimitMode === 'STRICT_LIMIT') && (
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>
                    {form.participantLimitMode === 'GOAL_LIMIT' ? 'Target participants' : 'Max participants'}
                  </label>
                  <input name="participantTarget" value={form.participantTarget || ''} onChange={handleChange} type="number" min="1" placeholder={String(form.capacity)} className="input-field" />
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Count visibility</label>
                <select name="participantCountVisibility" value={form.participantCountVisibility} onChange={handleChange} className="input-field">
                  <option value="PUBLIC">Public (show count)</option>
                  <option value="HIDDEN">Hidden (admin only)</option>
                </select>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
              <input name="requireParticipantApproval" checked={form.requireParticipantApproval} onChange={handleChange} type="checkbox" />
              Require admin approval for participation
            </label>
            <div style={{ marginTop: 10, padding: 10, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-subtle)', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              {form.requireParticipantApproval ? (
                <>Users submit an application (PENDING) and you approve/reject from admin panel.</>
              ) : form.participantLimitMode === 'STRICT_LIMIT' ? (
                <>Users register instantly until the limit is reached. No admin action needed.</>
              ) : form.participantLimitMode === 'GOAL_LIMIT' ? (
                <>Users register instantly. Admin decides when to close registration after goal is reached.</>
              ) : (
                <>Users register instantly. Registration is only limited by deadline or manual closing.</>
              )}
            </div>
          </div>

          {/* Team settings */}
          <div style={{ padding: 18, borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, marginBottom: 14 }}>
              <input name="isTeamBased" checked={form.isTeamBased} onChange={handleChange} type="checkbox" />
              Team-based event
            </label>
            {form.isTeamBased && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Min team size</label>
                  <input name="minTeamSize" value={form.minTeamSize} onChange={handleChange} type="number" min="1" className="input-field" />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Max team size</label>
                  <input name="maxTeamSize" value={form.maxTeamSize} onChange={handleChange} type="number" min="1" className="input-field" />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Join mode</label>
                  <select name="teamJoinMode" value={form.teamJoinMode} onChange={handleChange} className="input-field">
                    <option value="OPEN">Open</option>
                    <option value="BY_CODE">By code</option>
                    <option value="BY_REQUEST">By request</option>
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                  <input name="allowSoloParticipation" checked={form.allowSoloParticipation} onChange={handleChange} type="checkbox" />
                  Allow solo participation
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                  <input name="requireAdminApprovalForTeams" checked={form.requireAdminApprovalForTeams} onChange={handleChange} type="checkbox" />
                  Require admin approval
                </label>
              </div>
            )}
          </div>

          {/* Registration requirements */}
          <div style={{ padding: 18, borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 900 }}>Registration Requirements</h2>
            <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
              These fields gate participation in this event only. Platform account creation stays email and password.
            </p>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 10 }}>Required profile fields</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {PROFILE_REQUIREMENT_OPTIONS.map(option => (
                  <label key={option.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: form.requiredProfileFields.includes(option.key) ? 'var(--color-primary-subtle)' : 'var(--color-bg-subtle)', fontWeight: 700, fontSize: '0.86rem' }}>
                    <input type="checkbox" checked={form.requiredProfileFields.includes(option.key)} onChange={() => toggleRequiredProfileField(option.key)} />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.9rem', marginBottom: 6 }}>Event-specific required fields</label>
              <input name="requiredEventFields" value={form.requiredEventFields} onChange={handleChange} placeholder={EVENT_REQUIREMENT_HINT} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              <div style={{ marginTop: 6, color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>Comma-separated field keys. Answers are stored per event.</div>
            </div>
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
