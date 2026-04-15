'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FieldInput, FieldTextarea, Notice, PageHeader, Panel, SectionHeader, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';

export default function ProfilePage() {
  const { user, loading, updateProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useRouteLocale();

  const [activeTab, setActiveTab] = useState('registration');
  const requiredParam = searchParams.get('required') ?? '';
  const requiredFields = requiredParam.split(',').map((field) => field.trim()).filter(Boolean);
  const requiredEventTitle = searchParams.get('event') ?? '';

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [surnameRu, setSurnameRu] = useState('');
  const [surnameEn, setSurnameEn] = useState('');
  const [nameRu, setNameRu] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [patronymicRu, setPatronymicRu] = useState('');
  const [patronymicEn, setPatronymicEn] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');

  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [telegram, setTelegram] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
    if (user) {
      setEmail(user.email ?? '');
      setNameRu(user.name ?? '');
      setCity(user.city ?? '');
      setPhone(user.phone ?? '');
      setTelegram(user.telegram ?? '');
      setAvatarUrl(user.avatarUrl ?? '');
      setBirthDate(user.birthDate ? formatDateForProfile(user.birthDate) : '');
      setBio(user.bio ?? '');
    }
  }, [user, loading, router, locale]);

  useEffect(() => {
    if (requiredFields.some((field) => ['avatarUrl', 'bio', 'birthDate', 'city', 'telegram'].includes(field))) {
      setActiveTab('general');
    } else if (requiredFields.length > 0) {
      setActiveTab('registration');
    }
  }, [requiredParam, requiredFields.length]);

  if (loading || !user) return null;

  async function handleSave(event?: React.FormEvent | React.MouseEvent) {
    event?.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await updateProfile({
        name: nameRu,
        bio,
        city,
        phone,
        telegram,
        avatarUrl,
        birthDate: toApiBirthDate(birthDate),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  const isRequired = (field: string) => requiredFields.includes(field);
  const fieldToneClass = (field: string) => isRequired(field) ? 'signal-field-required' : '';

  const requiredHint = (field: string) => {
    if (!isRequired(field)) return null;
    return (
      <div className="signal-muted signal-required-hint">
        {locale === 'ru'
          ? `Поле обязательно${requiredEventTitle ? ` для события "${requiredEventTitle}"` : ''}.`
          : `This field is required${requiredEventTitle ? ` for "${requiredEventTitle}"` : ''}.`}
      </div>
    );
  };

  return (
    <div className="signal-page-shell">
      <PageHeader title={locale === 'ru' ? 'Профиль' : 'Profile'} subtitle={locale === 'ru' ? 'Личные данные и модули участия' : 'Personal data and participation modules'} />

      {requiredFields.length > 0 ? (
        <Notice tone="warning">
          {locale === 'ru'
            ? `Чтобы завершить участие${requiredEventTitle ? ` в "${requiredEventTitle}"` : ''}, заполните обязательные поля: ${requiredFields.join(', ')}.`
            : `To complete participation${requiredEventTitle ? ` in "${requiredEventTitle}"` : ''}, fill required fields: ${requiredFields.join(', ')}.`}
        </Notice>
      ) : null}

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{locale === 'ru' ? 'Профиль обновлён.' : 'Profile updated.'}</Notice> : null}

      <div className="workspace-status-strip">
        <div className="workspace-status-card">
          <small>{locale === 'ru' ? 'Профиль' : 'Profile'}</small>
          <strong>{requiredFields.length > 0 ? (locale === 'ru' ? 'Требует дополнения' : 'Needs completion') : (locale === 'ru' ? 'Готов к участию' : 'Participation-ready')}</strong>
        </div>
        <div className="workspace-status-card">
          <small>{locale === 'ru' ? 'Контур данных' : 'Data surface'}</small>
          <strong>{locale === 'ru' ? 'Регистрация · Контакты · Активность' : 'Registration · Contacts · Activity'}</strong>
        </div>
      </div>

      <div className="cabinet-profile-top-grid">
        <Panel variant="elevated" className="cabinet-profile-summary">
          <SectionHeader title={locale === 'ru' ? 'Профиль участника' : 'Participant profile'} subtitle={locale === 'ru' ? 'Базовая готовность к участию в событиях' : 'Core readiness for event participation'} />
          <div className="cabinet-profile-summary-metrics">
            <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Обязательные поля' : 'Required fields'}</span><strong>{requiredFields.length}</strong></div>
            <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Текущий email' : 'Current email'}</span><strong>{email || '—'}</strong></div>
          </div>
        </Panel>
      </div>

      <Panel variant="elevated">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="cabinet-tabs-list">
            <TabsTrigger value="registration">{locale === 'ru' ? 'Регистрационные данные' : 'Registration'}</TabsTrigger>
            <TabsTrigger value="general">{locale === 'ru' ? 'Общие данные' : 'General'}</TabsTrigger>
            <TabsTrigger value="documents">{locale === 'ru' ? 'Документы' : 'Documents'}</TabsTrigger>
            <TabsTrigger value="contacts">{locale === 'ru' ? 'Контакты' : 'Contacts'}</TabsTrigger>
            <TabsTrigger value="activity">{locale === 'ru' ? 'Активность' : 'Activity'}</TabsTrigger>
          </TabsList>

          <TabsContent value="registration" className="cabinet-tab-content">
            <SectionHeader title={locale === 'ru' ? 'Регистрационная карточка' : 'Registration card'} subtitle={locale === 'ru' ? 'Базовые данные для участия и верификации' : 'Base participation and verification data'} />
            <form onSubmit={handleSave} className="signal-stack">
              <div className="signal-two-col">
                <FieldBlock label="Email" required><FieldInput value={email} disabled /></FieldBlock>
                <FieldBlock label={locale === 'ru' ? 'Телефон' : 'Phone'} required><FieldInput value={phone} onChange={(event) => setPhone(event.target.value)} className={fieldToneClass('phone')} />{requiredHint('phone')}</FieldBlock>
              </div>

              <div className="signal-two-col">
                <FieldBlock label={locale === 'ru' ? 'Имя (RU)' : 'Name (RU)'} required><FieldInput value={nameRu} onChange={(event) => setNameRu(event.target.value)} className={fieldToneClass('name')} />{requiredHint('name')}</FieldBlock>
                <FieldBlock label={locale === 'ru' ? 'Имя (EN)' : 'Name (EN)'}><FieldInput value={nameEn} onChange={(event) => setNameEn(event.target.value)} /></FieldBlock>
              </div>

              <div className="signal-two-col">
                <FieldBlock label={locale === 'ru' ? 'Фамилия (RU)' : 'Surname (RU)'}><FieldInput value={surnameRu} onChange={(event) => setSurnameRu(event.target.value)} /></FieldBlock>
                <FieldBlock label={locale === 'ru' ? 'Фамилия (EN)' : 'Surname (EN)'}><FieldInput value={surnameEn} onChange={(event) => setSurnameEn(event.target.value)} /></FieldBlock>
              </div>

              <div className="signal-two-col">
                <FieldBlock label={locale === 'ru' ? 'Отчество (RU)' : 'Patronymic (RU)'}><FieldInput value={patronymicRu} onChange={(event) => setPatronymicRu(event.target.value)} /></FieldBlock>
                <FieldBlock label={locale === 'ru' ? 'Отчество (EN)' : 'Patronymic (EN)'}><FieldInput value={patronymicEn} onChange={(event) => setPatronymicEn(event.target.value)} /></FieldBlock>
              </div>

              <FieldBlock label={locale === 'ru' ? 'Дата рождения' : 'Birth date'} required>
                <FieldInput value={birthDate} onChange={(event) => setBirthDate(event.target.value)} placeholder={locale === 'ru' ? 'ДД.ММ.ГГГГ' : 'DD.MM.YYYY'} className={fieldToneClass('birthDate')} />
                {requiredHint('birthDate')}
              </FieldBlock>

              <button type="submit" disabled={saving} className="btn btn-primary">{saving ? (locale === 'ru' ? 'Сохранение...' : 'Saving...') : (locale === 'ru' ? 'Сохранить изменения' : 'Save changes')}</button>
            </form>
          </TabsContent>

          <TabsContent value="general" className="cabinet-tab-content">
            <SectionHeader title={locale === 'ru' ? 'Общие данные профиля' : 'General profile data'} subtitle={locale === 'ru' ? 'Публичные и контактные атрибуты' : 'Public and contact attributes'} />
            <div className="signal-stack">
              <div className="signal-two-col">
                <FieldBlock label={locale === 'ru' ? 'Город' : 'City'}><FieldInput value={city} onChange={(event) => setCity(event.target.value)} className={fieldToneClass('city')} />{requiredHint('city')}</FieldBlock>
                <FieldBlock label={locale === 'ru' ? 'Страна' : 'Country'}><FieldInput value={country} onChange={(event) => setCountry(event.target.value)} /></FieldBlock>
              </div>

              <FieldBlock label={locale === 'ru' ? 'Ссылка на фото' : 'Avatar URL'}><FieldInput value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} className={fieldToneClass('avatarUrl')} placeholder="https://..." />{requiredHint('avatarUrl')}</FieldBlock>
              <FieldBlock label={locale === 'ru' ? 'О себе' : 'About'}><FieldTextarea value={bio} onChange={(event) => setBio(event.target.value)} className={fieldToneClass('bio')} />{requiredHint('bio')}</FieldBlock>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">{saving ? (locale === 'ru' ? 'Сохранение...' : 'Saving...') : (locale === 'ru' ? 'Сохранить' : 'Save')}</button>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="cabinet-tab-content">
            <Panel className="cabinet-module-panel">
              <SectionHeader title={locale === 'ru' ? 'Модуль документов' : 'Documents module'} subtitle={locale === 'ru' ? 'Секция готова к подключению верификационных файлов.' : 'Section is ready for verification file integrations.'} actions={<StatusBadge tone="neutral">Coming next</StatusBadge>} />
              <EmptyModule locale={locale} textRu="После включения document-flow здесь появятся загруженные и проверенные документы." textEn="Uploaded and verified files will appear here once document-flow is enabled." />
            </Panel>
          </TabsContent>

          <TabsContent value="contacts" className="cabinet-tab-content">
            <div className="signal-stack">
              <FieldBlock label="Telegram"><FieldInput value={telegram} onChange={(event) => setTelegram(event.target.value)} placeholder="@username" className={fieldToneClass('telegram')} />{requiredHint('telegram')}</FieldBlock>
              <FieldBlock label={locale === 'ru' ? 'Телефон' : 'Phone'}><FieldInput value={phone} onChange={(event) => setPhone(event.target.value)} /></FieldBlock>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">{saving ? (locale === 'ru' ? 'Сохранение...' : 'Saving...') : (locale === 'ru' ? 'Сохранить' : 'Save')}</button>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="cabinet-tab-content">
            <Panel className="cabinet-module-panel">
              <SectionHeader title={locale === 'ru' ? 'Модуль активности' : 'Activity module'} subtitle={locale === 'ru' ? 'История участия и персональные показатели будут отображаться здесь.' : 'Participation history and personal indicators will be displayed here.'} actions={<StatusBadge tone="info">Planned</StatusBadge>} />
              <EmptyModule locale={locale} textRu="Текущий релиз сохраняет структуру и готовит интерфейс под будущую аналитику активности." textEn="Current release preserves structure and prepares UI for future activity analytics." />
            </Panel>
          </TabsContent>
        </Tabs>
      </Panel>
    </div>
  );
}

function FieldBlock({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="signal-stack cabinet-field-block">
      <span className="cabinet-field-label">
        {label} {required ? <span className="cabinet-field-required">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function EmptyModule({ locale, textRu, textEn }: { locale: string; textRu: string; textEn: string }) {
  return (
    <div className="signal-empty-state">
      <h3>{locale === 'ru' ? 'Модуль в подготовке' : 'Module in preparation'}</h3>
      <p>{locale === 'ru' ? textRu : textEn}</p>
    </div>
  );
}

function formatDateForProfile(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU');
}

function toApiBirthDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const parts = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (parts) {
    const [, day, month, year] = parts;
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString();
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
