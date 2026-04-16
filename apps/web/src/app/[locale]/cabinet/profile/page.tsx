'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { FieldInput, FieldTextarea, Notice, PageHeader, Panel, SectionHeader, StatusBadge } from '@/components/ui/signal-primitives';

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

  // Cyrillic name fields
  const [lastNameCyrillic, setLastNameCyrillic] = useState('');
  const [firstNameCyrillic, setFirstNameCyrillic] = useState('');
  const [middleNameCyrillic, setMiddleNameCyrillic] = useState('');

  // Latin name fields
  const [lastNameLatin, setLastNameLatin] = useState('');
  const [firstNameLatin, setFirstNameLatin] = useState('');
  const [middleNameLatin, setMiddleNameLatin] = useState('');

  // Legacy name field (for backward compat)
  const [name, setName] = useState('');

  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [telegram, setTelegram] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
    if (user) {
      // Cyrillic names
      setLastNameCyrillic(user.lastNameCyrillic ?? '');
      setFirstNameCyrillic(user.firstNameCyrillic ?? '');
      setMiddleNameCyrillic(user.middleNameCyrillic ?? '');
      // Latin names
      setLastNameLatin(user.lastNameLatin ?? '');
      setFirstNameLatin(user.firstNameLatin ?? '');
      setMiddleNameLatin(user.middleNameLatin ?? '');
      // Legacy name (for display)
      setName(user.name ?? user.fullNameCyrillic ?? '');
      // Other fields
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
        // Cyrillic names
        lastNameCyrillic,
        firstNameCyrillic,
        middleNameCyrillic,
        // Latin names
        lastNameLatin,
        firstNameLatin,
        middleNameLatin,
        // Legacy name for backward compat
        name,
        // Other fields
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

      <div className="workspace-command-row">
        <Link href={`/${locale}/cabinet/applications`} className="signal-chip-link">{locale === 'ru' ? 'Открыть заявки' : 'Open applications'}</Link>
        <Link href={`/${locale}/cabinet/my-events`} className="signal-chip-link">{locale === 'ru' ? 'Перейти к участию' : 'Go to participations'}</Link>
      </div>

      {requiredFields.length > 0 ? (
        <Notice tone="warning">
          {locale === 'ru'
            ? `Чтобы завершить участие${requiredEventTitle ? ` в "${requiredEventTitle}"` : ''}, заполните обязательные поля: ${requiredFields.join(', ')}.`
            : `To complete participation${requiredEventTitle ? ` in "${requiredEventTitle}"` : ''}, fill required fields: ${requiredFields.join(', ')}.`}
        </Notice>
      ) : null}

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{locale === 'ru' ? 'Профиль обновлён.' : 'Profile updated.'}</Notice> : null}

      <Panel variant="elevated">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="cabinet-tabs-list">
            <TabsTrigger value="registration">{locale === 'ru' ? 'ФИО' : 'Name'}</TabsTrigger>
            <TabsTrigger value="general">{locale === 'ru' ? 'Общие данные' : 'General'}</TabsTrigger>
            <TabsTrigger value="documents">{locale === 'ru' ? 'Документы' : 'Documents'}</TabsTrigger>
            <TabsTrigger value="contacts">{locale === 'ru' ? 'Контакты' : 'Contacts'}</TabsTrigger>
            <TabsTrigger value="activity">{locale === 'ru' ? 'Активность' : 'Activity'}</TabsTrigger>
          </TabsList>

          <TabsContent value="registration" className="cabinet-tab-content">
            <SectionHeader 
              title={locale === 'ru' ? 'Фамилия, имя, отчество' : 'Full name'} 
              subtitle={locale === 'ru' ? 'Заполните ФИО на русском и английском языках' : 'Fill in your name in Russian and English'} 
            />
            <form onSubmit={handleSave} className="signal-stack">
              <div className="signal-section-label">{locale === 'ru' ? 'Кириллица (русский)' : 'Cyrillic (Russian)'}</div>
              <div className="signal-two-col">
                <FieldBlock label={locale === 'ru' ? 'Фамилия' : 'Last name'}>
                  <FieldInput 
                    value={lastNameCyrillic} 
                    onChange={(event) => setLastNameCyrillic(event.target.value)} 
                    placeholder={locale === 'ru' ? 'Иванов' : 'Ivanov'}
                    className={fieldToneClass('lastNameCyrillic')}
                  />
                  {requiredHint('lastNameCyrillic')}
                </FieldBlock>
                <FieldBlock label={locale === 'ru' ? 'Имя' : 'First name'} required>
                  <FieldInput 
                    value={firstNameCyrillic} 
                    onChange={(event) => setFirstNameCyrillic(event.target.value)} 
                    placeholder={locale === 'ru' ? 'Иван' : 'Ivan'}
                    className={fieldToneClass('firstNameCyrillic')}
                  />
                  {requiredHint('firstNameCyrillic')}
                </FieldBlock>
              </div>

              <div className="signal-two-col">
                <FieldBlock label={locale === 'ru' ? 'Отчество' : 'Patronymic'}>
                  <FieldInput 
                    value={middleNameCyrillic} 
                    onChange={(event) => setMiddleNameCyrillic(event.target.value)} 
                    placeholder={locale === 'ru' ? 'Иванович' : 'Ivanovich'}
                  />
                </FieldBlock>
                <FieldBlock label={locale === 'ru' ? 'Дата рождения' : 'Birth date'} required>
                  <FieldInput 
                    value={birthDate} 
                    onChange={(event) => setBirthDate(event.target.value)} 
                    placeholder={locale === 'ru' ? 'ДД.ММ.ГГГГ' : 'DD.MM.YYYY'}
                    className={fieldToneClass('birthDate')} 
                  />
                  {requiredHint('birthDate')}
                </FieldBlock>
              </div>

              <div className="signal-section-label">{locale === 'ru' ? 'Латиница (английский)' : 'Latin (English)'}</div>
              <div className="signal-two-col">
                <FieldBlock label={locale === 'ru' ? 'Фамилия (EN)' : 'Last name (EN)'}>
                  <FieldInput 
                    value={lastNameLatin} 
                    onChange={(event) => setLastNameLatin(event.target.value)} 
                    placeholder="Ivanov"
                  />
                </FieldBlock>
                <FieldBlock label={locale === 'ru' ? 'Имя (EN)' : 'First name (EN)'}>
                  <FieldInput 
                    value={firstNameLatin} 
                    onChange={(event) => setFirstNameLatin(event.target.value)} 
                    placeholder="Ivan"
                  />
                </FieldBlock>
              </div>

              <div className="signal-two-col">
                <FieldBlock label={locale === 'ru' ? 'Отчество (EN)' : 'Patronymic (EN)'}>
                  <FieldInput 
                    value={middleNameLatin} 
                    onChange={(event) => setMiddleNameLatin(event.target.value)} 
                    placeholder="Ivanovich"
                  />
                </FieldBlock>
                <FieldBlock label={locale === 'ru' ? 'Телефон' : 'Phone'} required>
                  <FieldInput 
                    value={phone} 
                    onChange={(event) => setPhone(event.target.value)} 
                    className={fieldToneClass('phone')} 
                  />
                  {requiredHint('phone')}
                </FieldBlock>
              </div>

              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving 
                  ? (locale === 'ru' ? 'Сохранение...' : 'Saving...') 
                  : (locale === 'ru' ? 'Сохранить изменения' : 'Save changes')}
              </button>
            </form>
          </TabsContent>

          <TabsContent value="general" className="cabinet-tab-content">
            <SectionHeader title={locale === 'ru' ? 'Общие данные профиля' : 'General profile data'} subtitle={locale === 'ru' ? 'Публичные и контактные атрибуты' : 'Public and contact attributes'} />
            <div className="signal-stack">
              <FieldBlock label={locale === 'ru' ? 'Город' : 'City'}>
                <FieldInput 
                  value={city} 
                  onChange={(event) => setCity(event.target.value)} 
                  className={fieldToneClass('city')} 
                />
                {requiredHint('city')}
              </FieldBlock>

              <FieldBlock label={locale === 'ru' ? 'Ссылка на фото' : 'Avatar URL'}>
                <FieldInput 
                  value={avatarUrl} 
                  onChange={(event) => setAvatarUrl(event.target.value)} 
                  className={fieldToneClass('avatarUrl')} 
                  placeholder="https://..." 
                />
                {requiredHint('avatarUrl')}
              </FieldBlock>
              <FieldBlock label={locale === 'ru' ? 'О себе' : 'About'}>
                <FieldTextarea 
                  value={bio} 
                  onChange={(event) => setBio(event.target.value)} 
                  className={fieldToneClass('bio')} 
                />
                {requiredHint('bio')}
              </FieldBlock>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
                {saving 
                  ? (locale === 'ru' ? 'Сохранение...' : 'Saving...') 
                  : (locale === 'ru' ? 'Сохранить' : 'Save')}
              </button>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="cabinet-tab-content">
            <Panel className="cabinet-module-panel">
              <SectionHeader 
                title={locale === 'ru' ? 'Модуль документов' : 'Documents module'} 
                subtitle={locale === 'ru' ? 'Секция готова к подключению верификационных файлов.' : 'Section is ready for verification file integrations.'} 
                actions={<StatusBadge tone="neutral">Coming next</StatusBadge>} 
              />
              <EmptyModule 
                locale={locale} 
                textRu="После включения document-flow здесь появятся загруженные и проверенные документы." 
                textEn="Uploaded and verified files will appear here once document-flow is enabled." 
              />
            </Panel>
          </TabsContent>

          <TabsContent value="contacts" className="cabinet-tab-content">
            <div className="signal-stack">
              <FieldBlock label="Telegram">
                <FieldInput 
                  value={telegram} 
                  onChange={(event) => setTelegram(event.target.value)} 
                  placeholder="@username" 
                  className={fieldToneClass('telegram')} 
                />
                {requiredHint('telegram')}
              </FieldBlock>
              <FieldBlock label={locale === 'ru' ? 'Телефон' : 'Phone'}>
                <FieldInput 
                  value={phone} 
                  onChange={(event) => setPhone(event.target.value)} 
                />
              </FieldBlock>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
                {saving 
                  ? (locale === 'ru' ? 'Сохранение...' : 'Saving...') 
                  : (locale === 'ru' ? 'Сохранить' : 'Save')}
              </button>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="cabinet-tab-content">
            <Panel className="cabinet-module-panel">
              <SectionHeader 
                title={locale === 'ru' ? 'Модуль активности' : 'Activity module'} 
                subtitle={locale === 'ru' ? 'История участия и персональные показатели будут отображаться здесь.' : 'Participation history and personal indicators will be displayed here.'} 
                actions={<StatusBadge tone="info">Planned</StatusBadge>} 
              />
              <EmptyModule 
                locale={locale} 
                textRu="Текущий релиз сохраняет структуру и готовит интерфейс под будущую аналитику активности." 
                textEn="Current release preserves structure and prepares UI for future activity analytics." 
              />
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
