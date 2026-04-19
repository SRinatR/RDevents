'use client';

import { useState } from 'react';
import { FieldInput, Notice } from '@/components/ui/signal-primitives';
import { ProfileSectionActions } from './ProfileSectionActions';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import type { ProfileSectionStatus } from './profile.types';

type Props = {
  locale: string;
  user: any;
  status: ProfileSectionStatus;
  saving: boolean;
  requiredFields: string[];
  eventTitle: string;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

const NETWORKS = [
  ['max', 'MAX'],
  ['vk', 'VK'],
  ['telegram', 'Telegram'],
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['x', 'X'],
] as const;

export function ProfileContactDataSection({ locale, user, status, saving, requiredFields, eventTitle, onSave }: Props) {
  const isRu = locale === 'ru';
  const links = user.socialLinks ?? {};
  const [form, setForm] = useState<Record<string, string | boolean>>(() => Object.fromEntries(
    NETWORKS.flatMap(([key]) => [
      [`${key}Url`, links[`${key}Url`] ?? ''],
      [`${key}Absent`, Boolean(links[`${key}Absent`])],
    ]),
  ));

  function setField(key: string, value: string | boolean) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function requiredClass(key: string) {
    return requiredFields.includes('contactDataComplete') || requiredFields.includes(`${key}Url`) || (key === 'telegram' && requiredFields.includes('telegram'))
      ? 'signal-field-required'
      : '';
  }

  return (
    <ProfileSectionLayout
      locale={locale}
      title={isRu ? 'Контактные данные' : 'Contact data'}
      description={isRu ? 'Для каждой сети укажите ссылку или отметьте, что аккаунта нет.' : 'For every network, provide a link or mark the account as absent.'}
      status={status}
    >
      {requiredFields.length > 0 ? <Notice tone="warning">{isRu ? `Эти контакты нужны для заявки${eventTitle ? `: ${eventTitle}` : ''}.` : 'These contacts are required for your application.'}</Notice> : null}
      <Notice tone="info">{isRu ? 'Правило XOR: ссылка или отметка «нет аккаунта», но не оба варианта сразу.' : 'XOR rule: URL or absent flag, but not both at the same time.'}</Notice>
      <form className="signal-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}>
        <div className="profile-form-three-col">
          {NETWORKS.map(([key, label]) => {
            const urlKey = `${key}Url`;
            const absentKey = `${key}Absent`;
            const absent = Boolean(form[absentKey]);
            return (
              <div key={key} className="cabinet-field-block">
                <span className="cabinet-field-label">{label}</span>
                <FieldInput
                  className={requiredClass(key)}
                  disabled={absent}
                  value={String(form[urlKey] ?? '')}
                  onChange={(event) => setField(urlKey, event.target.value)}
                  placeholder={key === 'telegram' ? 'https://t.me/username' : `https://${key}.com/username`}
                />
                <label className="profile-consent-row">
                  <input type="checkbox" checked={absent} onChange={(event) => setField(absentKey, event.target.checked)} />
                  <span>{isRu ? 'Нет аккаунта' : 'No account'}</span>
                </label>
              </div>
            );
          })}
        </div>
        <ProfileSectionActions locale={locale} saving={saving} />
      </form>
    </ProfileSectionLayout>
  );
}
