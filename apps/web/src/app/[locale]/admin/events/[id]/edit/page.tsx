'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../../../hooks/useAuth';
import { adminApi } from '../../../../../../lib/api';
import { useRouteParams } from '../../../../../../hooks/useRouteParams';

const PROFILE_REQUIREMENT_OPTIONS = [
  { key: 'name', label: 'Full name' },
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'birthDate', label: 'Date of birth' },
];

const EVENT_REQUIREMENT_HINT = 'motivation, experience, teamPreference, tshirtSize, emergencyContact, preferredSlot';

export default function EditEventPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
  });

  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventAdmins, setEventAdmins] = useState<any[]>([]);
  const [adminEmail, setAdminEmail] = useState('');
  const [assigningAdmin, setAssigningAdmin] = useState(false);
  const [assignAdminError, setAssignAdminError] = useState('');
  const [assignAdminSuccess, setAssignAdminSuccess] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin || !eventId) return;
    adminApi.listEvents({ id: eventId, limit: 1 })
      .then(r => {
        if (r.data[0]) {
          const e = r.data[0];
          const toLocal = (iso?: string) => iso ? new Date(iso).toISOString().slice(0, 16) : '';
          setForm({
            title: e.title ?? '',
            slug: e.slug ?? '',
            shortDescription: e.shortDescription ?? '',
            description: e.fullDescription ?? e.description ?? '',
            category: e.category ?? 'Tech',
            status: e.status ?? 'DRAFT',
            coverImageUrl: e.coverImageUrl ?? '',
            location: e.location ?? '',
            startsAt: toLocal(e.startsAt),
            endsAt: toLocal(e.endsAt),
            capacity: e.capacity ?? 100,
            registrationOpensAt: toLocal(e.registrationOpensAt),
            registrationDeadline: toLocal(e.registrationDeadline),
            conditions: e.conditions ?? '',
            contactEmail: e.contactEmail ?? '',
            contactPhone: e.contactPhone ?? '',
            tags: Array.isArray(e.tags) ? e.tags.join(', ') : '',
            isTeamBased: Boolean(e.isTeamBased),
            minTeamSize: e.minTeamSize ?? 1,
            maxTeamSize: e.maxTeamSize ?? 1,
            allowSoloParticipation: e.allowSoloParticipation ?? true,
            teamJoinMode: e.teamJoinMode ?? 'OPEN',
            requireAdminApprovalForTeams: Boolean(e.requireAdminApprovalForTeams),
            requiredProfileFields: Array.isArray(e.requiredProfileFields) ? e.requiredProfileFields : [],
            requiredEventFields: Array.isArray(e.requiredEventFields) ? e.requiredEventFields.join(', ') : '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingEvent(false));

    adminApi.listEventAdmins(eventId)
      .then(r => setEventAdmins(r.eventAdmins))
      .catch(() => setEventAdmins([]));
  }, [user, isAdmin, eventId]);

  useEffect(() => {
    if (searchParams.get('created')) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  }, [searchParams]);

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
    setSuccess(false);
    setSubmitting(true);

    const payload = {
      ...form,
      capacity: parseInt(String(form.capacity)) || 100,
      minTeamSize: parseInt(String(form.minTeamSize)) || 1,
      maxTeamSize: parseInt(String(form.maxTeamSize)) || 1,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      registrationOpensAt: form.registrationOpensAt ? new Date(form.registrationOpensAt).toISOString() : '',
      registrationDeadline: form.registrationDeadline ? new Date(form.registrationDeadline).toISOString() : '',
      requiredProfileFields: form.requiredProfileFields,
      requiredEventFields: form.requiredEventFields.split(',').map(field => field.trim()).filter(Boolean),
    };

    try {
      await adminApi.updateEvent(eventId, payload);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update event');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignEventAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !adminEmail.trim()) return;
    setAssigningAdmin(true);
    setAssignAdminError('');
    setAssignAdminSuccess('');

    try {
      const { membership } = await adminApi.assignEventAdmin(eventId, { email: adminEmail.trim() });
      setEventAdmins(prev => [membership, ...prev.filter(item => item.id !== membership.id)]);
      setAdminEmail('');
      setAssignAdminSuccess('Event admin assigned');
    } catch (err: any) {
      setAssignAdminError(err.message || 'Failed to assign event admin');
    } finally {
      setAssigningAdmin(false);
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
            {t('admin.editEvent')}
          </h1>
        </div>

        {success && (
          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-lg)', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '0.9rem', marginBottom: 20 }}>
            ✅ Event updated successfully!
          </div>
        )}

        {loadingEvent ? (
          <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
        ) : (
          <>
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
              <input name="shortDescription" value={form.shortDescription} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
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
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Cover image */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Cover image URL</label>
              <input name="coverImageUrl" value={form.coverImageUrl} onChange={handleChange} type="url" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>

            {/* Location */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Location</label>
              <input name="location" value={form.location} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
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
              <textarea name="conditions" value={form.conditions} onChange={handleChange} rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>

            {/* Contact */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Contact email</label>
                <input name="contactEmail" value={form.contactEmail} onChange={handleChange} type="email" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Contact phone</label>
                <input name="contactPhone" value={form.contactPhone} onChange={handleChange} type="tel" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Tags (comma-separated)</label>
              <input name="tags" value={form.tags} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
              <button type="submit" disabled={submitting} style={{ padding: '12px 28px', borderRadius: 'var(--radius-lg)', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Saving...' : t('common.save')}
              </button>
              <a href={`/${locale}/admin/events`} style={{ padding: '12px 28px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontWeight: 700, textDecoration: 'none' }}>
                {t('common.cancel')}
              </a>
            </div>
          </form>

          <section style={{ marginTop: 40, paddingTop: 28, borderTop: '1px solid var(--color-border)' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 800 }}>Event admins</h2>
            {eventAdmins.length === 0 ? (
              <p style={{ margin: '0 0 18px', color: 'var(--color-text-muted)' }}>No event admins assigned yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {eventAdmins.map(admin => (
                  <div key={admin.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{admin.user?.name ?? 'Unnamed user'}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{admin.user?.email}</div>
                    </div>
                    <span style={{ alignSelf: 'center', fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>{admin.status}</span>
                  </div>
                ))}
              </div>
            )}

            {isPlatformAdmin && (
              <form onSubmit={handleAssignEventAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem' }}>Assign event admin by email</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    value={adminEmail}
                    onChange={event => setAdminEmail(event.target.value)}
                    type="email"
                    placeholder="organizer@example.com"
                    style={{ flex: '1 1 260px', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }}
                  />
                  <button type="submit" disabled={assigningAdmin || !adminEmail.trim()} style={{ padding: '10px 20px', borderRadius: 'var(--radius-lg)', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: assigningAdmin || !adminEmail.trim() ? 0.6 : 1 }}>
                    {assigningAdmin ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
                {assignAdminError && <div style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>{assignAdminError}</div>}
                {assignAdminSuccess && <div style={{ color: 'var(--color-success)', fontSize: '0.9rem' }}>{assignAdminSuccess}</div>}
              </form>
            )}
          </section>
          </>
        )}
      </div>
    </div>
  );
}
