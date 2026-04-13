'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';

export default function CabinetProfilePage() {
  const t = useTranslations();
  const { user, loading, updateProfile } = useAuth();

  const [activeTab, setActiveTab] = useState('registration');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setEmail(user.email ?? '');
      setBio(user.bio ?? '');
      setCity(user.city ?? '');
      setPhone(user.phone ?? '');
    }
  }, [user]);

  if (loading || !user) return null; // handled by layout

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await updateProfile({ name, bio, city, phone });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
        Профиль
      </h1>

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
                <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div>
                <label className="input-label" style={{ color: 'var(--color-primary)' }}>Телефон</label>
                <input type="tel" className="input-field" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'general' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, marginBottom: 20 }}>
              <div>
                <label className="input-label" style={{ color: 'var(--color-primary)' }}>О себе (Био)</label>
                <textarea className="input-field" value={bio} onChange={e => setBio(e.target.value)} rows={4} style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label className="input-label" style={{ color: 'var(--color-primary)' }}>Город</label>
                <input type="text" className="input-field" value={city} onChange={e => setCity(e.target.value)} />
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
