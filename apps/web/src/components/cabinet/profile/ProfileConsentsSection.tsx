'use client';

import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { AuthUser } from '@/hooks/useAuth';
import { ProfileSectionActions } from './ProfileSectionActions';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import type { ProfileSectionStatus } from './profile.types';

type ProfileConsentsSectionProps = {
  locale: string;
  user: AuthUser;
  status: ProfileSectionStatus;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function ProfileConsentsSection({
  locale,
  user,
  status,
  saving,
  onSave,
}: ProfileConsentsSectionProps) {
  const [consentPersonalData, setConsentPersonalData] = useState(false);
  const [consentClientRules, setConsentClientRules] = useState(false);

  useEffect(() => {
    setConsentPersonalData(Boolean(user.consentPersonalData));
    setConsentClientRules(Boolean(user.consentClientRules));
  }, [user]);

  return (
    <ProfileSectionLayout
      locale={locale}
      title={locale === 'ru' ? 'Согласия' : 'Consents'}
      description={locale === 'ru' ? 'Подтверждения для участия в мероприятиях' : 'Confirmations for event participation'}
      status={status}
    >
      <form
        className="signal-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ consentPersonalData, consentClientRules });
        }}
      >
        <label className="profile-consent-row">
          <Checkbox checked={consentPersonalData} onChange={(event) => setConsentPersonalData(event.target.checked)} />
          <span>
            <strong>{locale === 'ru' ? 'Персональные данные' : 'Personal data'}</strong>
            <small>
              {locale === 'ru'
                ? 'Разрешаю использовать мои данные для обработки заявок.'
                : 'I allow my data to be used for application processing.'}
            </small>
          </span>
        </label>

        <label className="profile-consent-row">
          <Checkbox checked={consentClientRules} onChange={(event) => setConsentClientRules(event.target.checked)} />
          <span>
            <strong>{locale === 'ru' ? 'Правила клиента' : 'Client rules'}</strong>
            <small>
              {locale === 'ru'
                ? 'Согласен соблюдать требования организаторов.'
                : 'I agree to follow organizer requirements.'}
            </small>
          </span>
        </label>

        <ProfileSectionActions locale={locale} saving={saving} />
      </form>
    </ProfileSectionLayout>
  );
}
