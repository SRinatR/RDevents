'use client';

import Link from 'next/link';
import { StatusBadge, RoleBadge } from './status-badge';

interface ParticipantStatusProps {
  roles: Array<{ role: string; status: string }>;
  eventSlug: string;
  locale: string;
}

const STATUS_STEPS = {
  DRAFT: { step: 1, label: 'Черновик' },
  SUBMITTED: { step: 2, label: 'Подана' },
  UNDER_REVIEW: { step: 3, label: 'На рассмотрении' },
  CONFIRMED: { step: 4, label: 'Подтверждена' },
  REJECTED: { step: -1, label: 'Отклонена' },
  RESERVE: { step: 3, label: 'В резерве' },
} as const;

type RegistrationStatus = keyof typeof STATUS_STEPS;

function isRegistrationStatus(value: string): value is RegistrationStatus {
  return value in STATUS_STEPS;
}

function RegistrationProgress({ status }: { status: string }) {
  const safeStatus: RegistrationStatus = isRegistrationStatus(status) ? status : 'DRAFT';
  const currentStep = STATUS_STEPS[safeStatus].step;
  const isRejected = currentStep === -1;

  if (isRejected) {
    return (
      <div className="progress-rejected">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <span>{STATUS_STEPS[safeStatus].label}</span>
      </div>
    );
  }

  const steps = [
    { num: 1, label: 'Подана' },
    { num: 2, label: 'Рассмотрение' },
    { num: 3, label: 'Подтверждение' },
  ];

  return (
    <div className="registration-progress">
      {steps.map((step, idx) => (
        <div key={step.num} className="progress-step-wrapper">
          <div
            className={`progress-step ${
              currentStep >= step.num ? 'active' : ''
            }`}
          >
            {currentStep > step.num ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              step.num
            )}
          </div>

          <span className={`progress-label ${currentStep >= step.num ? 'active' : ''}`}>
            {step.label}
          </span>

          {idx < steps.length - 1 && (
            <div className={`progress-line ${currentStep > step.num ? 'active' : ''}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export function ParticipantStatus({ roles, eventSlug, locale }: ParticipantStatusProps) {
  const participantRole = roles.find((r) => r.role === 'PARTICIPANT' || r.role === 'CAPTAIN');
  const status = participantRole?.status ?? 'DRAFT';

  return (
    <div className="participant-status-card">
      <h3 className="card-section-title">
        {locale === 'ru' ? 'Мой статус' : 'My status'}
      </h3>

      <div className="status-roles">
        {roles.map((role, idx) => (
          <RoleBadge key={`${role.role}-${idx}`} role={role.role} size="md" />
        ))}
      </div>

      <div className="status-progress">
        <RegistrationProgress status={status} />
      </div>

      <div className="status-detail">
        <StatusBadge status={status} type="registration" size="md" />
      </div>

      <div className="card-actions">
        <Link href={`/${locale}/cabinet/events/${eventSlug}/application`} className="btn btn-secondary btn-sm">
          {locale === 'ru' ? 'Моя заявка' : 'My application'}
        </Link>
      </div>
    </div>
  );
}