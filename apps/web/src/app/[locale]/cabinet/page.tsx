'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';

export default function CabinetProfilePage() {
  const t = useTranslations();
  const { user, loading, updateProfile } = useAuth();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState('registration');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [birthDate, setBirthDate] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const requiredParam = searchParams.get('required') ?? '';
  const requiredFields = requiredParam.split(',').map(field => field.trim()).filter(Boolean);
  const requiredEventTitle = searchParams.get('event') ?? '';
  const isRequired = (field: string) => requiredFields.includes(field);

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setEmail(user.email ?? '');
      setBio(user.bio ?? '');
      setCity(user.city ?? '');
      setPhone(user.phone ?? '');
      setTelegram(user.telegram ?? '');
      setBirthDate(user.birthDate ? new Date(user.birthDate).toISOString().slice(0, 10) : '');
    }
  }, [user]);

  useEffect(() => {
    if (requiredFields.some(field => ['city', 'telegram', 'birthDate', 'bio'].includes(field))) {
      setActiveTab('general');
    } else if (requiredFields.length > 0) {
      setActiveTab('registration');
    }
  }, [requiredParam]);

  if (loading || !user) return null; // handled by layout

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await updateProfile({
        name,
        bio,
        city,
        phone,
        telegram,
        birthDate: birthDate ? new Date(birthDate).toISOString() : '',
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  function requiredInputStyle(field: string): React.CSSProperties {
    if (!isRequired(field)) return {};
    return {
      borderColor: 'var(--color-primary)',
      boxShadow: '0 0 0 3px var(--color-primary-glow)',
      background: 'var(--color-primary-subtle)',
    };
  }

  function requiredHint(field: string) {
    if (!isRequired(field)) return null;
    return (
      <div style={{ marginTop: 6, fontSize: '0.82rem', color: 'var(--color-primary)', fontWeight: 700 }}>
        Это поле обязательно для участия{requiredEventTitle ? ` в мероприятии "${requiredEventTitle}"` : ''}.
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
        Профиль
      </h1>

      {requiredFields.length > 0 && (
        <div className="alert" style={{ marginBottom: 20, background: 'var(--color-primary-subtle)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)', fontWeight: 700 }}>
          Чтобы участвовать{requiredEventTitle ? ` в "${requiredEventTitle}"` : ''}, заполните обязательные поля: {requiredFields.join(', ')}.
        </div>
      )}

      <div className="cabinet-tabs">
        <button onClick={() => setActiveTab('registration')} className={`cabinet-tab ${activeTab === 'registration' ? 'active' : ''}`} style={{ background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', paddingBottom: 12 }}>
          Регистрационные данные
        </button>
        <button onClick={() => setActiveTab('general')} className={`cabinet-tab ${activeTab === 'general' ? 'active' : ''}`} style={{ background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', paddingBottom: 12 }}>
          Общие данные
        </button>
        <button onClick={() => setActiveTab('documents')} className={`cabinet-tab ${activeTab === 'documents' ? 'active' : ''}`} style={{ background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', paddingBottom: 12 }}>
          Личные документы
        </button>
      </div>

      <form onSubmit={handleSave}>
        {activeTab === 'registration' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, marginBottom: 20 }}>
              <div>
                <label className="input-label" style={{ color: 'var(--color-primary)' }}>Email *</label>
                <div style={{ background: 'var(--color-bg-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-md)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                  {email} (Только для чтения)
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div>
                <label className="input-label" style={{ color: 'var(--color-primary)' }}>Имя на русском *</label>
                <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} style={requiredInputStyle('name')} />
                {requiredHint('name')}
              </div>
              <div>
                <label className="input-label" style={{ color: 'var(--color-primary)' }}>Телефон</label>
                <input type="tel" className="input-field" value={phone} onChange={e => setPhone(e.target.value)} style={requiredInputStyle('phone')} />
                {requiredHint('phone')}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'general' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, marginBottom: 20 }}>
              <div>
                <label className="input-label" style={{ color: 'var(--color-primary)' }}>О себе (Био)</label>
                <textarea className="input-field" value={bio} onChange={e => setBio(e.target.value)} rows={4} style={{ resize: 'vertical', ...requiredInputStyle('bio') }} />
                {requiredHint('bio')}
              </div>
              <div>
                <label className="input-label" style={{ color: 'var(--color-primary)' }}>Город</label>
                <input type="text" className="input-field" value={city} onChange={e => setCity(e.target.value)} style={requiredInputStyle('city')} />
                {requiredHint('city')}
              </div>
              <div>
                <label className="input-label" style={{ color: 'var(--color-primary)' }}>Telegram</label>
                <input type="text" className="input-field" value={telegram} onChange={e => setTelegram(e.target.value)} placeholder="@username" style={requiredInputStyle('telegram')} />
                {requiredHint('telegram')}
              </div>
              <div>
                <label className="input-label" style={{ color: 'var(--color-primary)' }}>Дата рождения</label>
                <input type="date" className="input-field" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={requiredInputStyle('birthDate')} />
                {requiredHint('birthDate')}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div style={{ animation: 'fadeIn 0.3s ease', padding: '40px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <p>Раздел в разработке (MVP)</p>
          </div>
        )}

        {(activeTab === 'registration' || activeTab === 'general') && (
          <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: '0 32px' }}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
            {error && <span style={{ color: 'var(--color-danger)', fontSize: '0.9rem', fontWeight: 600 }}>{error}</span>}
            {success && <span style={{ color: 'var(--color-success)', fontSize: '0.9rem', fontWeight: 600 }}>✓ Успешно сохранено</span>}
          </div>
        )}
      </form>
    </div>
  );
}
