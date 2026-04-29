'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { ApiError, eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, PageHeader, Panel, ToolbarRow } from '@/components/ui/signal-primitives';
import {
  buildProfileRequirementUrl,
  filterEventFormMissingFields,
  filterProfileMissingFields,
  type RegistrationMissingField,
} from '@/components/cabinet/profile/profile.requirements';
import {
  getRegistrationClosedReason,
  getRegistrationClosedMessage,
} from '@/lib/registration-status';

const OPEN_STATUSES = new Set(['PENDING_ACCOUNT', 'PENDING_RESPONSE']);

export default function TeamInvitationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';
  const [invitations, setInvitations] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login?next=${encodeURIComponent(`/${locale}/cabinet/team-invitations`)}`);
  }, [loading, user, router, locale]);

  const loadInvitations = useCallback(async () => {
    setPageLoading(true);
    setError('');
    try {
      const response = await eventsApi.myTeamInvitations();
      setInvitations(response.invitations || []);
    } catch (err: any) {
      setError(err.message || (isRu ? 'Не удалось загрузить приглашения' : 'Failed to load invitations'));
    } finally {
      setPageLoading(false);
    }
  }, [isRu]);

  useEffect(() => {
    if (user) void loadInvitations();
  }, [user, loadInvitations]);

  async function handleAccept(invitation: any) {
    setActionLoading(`accept:${invitation.id}`);
    setError('');
    setSuccess('');
    try {
      await eventsApi.acceptTeamInvitation(invitation.id);
      setSuccess(isRu ? 'Приглашение принято.' : 'Invitation accepted.');
      router.push(`/${locale}/cabinet/events/${invitation.event?.slug}`);
    } catch (err: any) {
      if (err instanceof ApiError && Array.isArray((err.details as any)?.missingFields)) {
        const fields = (err.details as any).missingFields as RegistrationMissingField[];
        const profileFields = filterProfileMissingFields(fields);
        const eventFields = filterEventFormMissingFields(fields);
        if (profileFields.length > 0) {
          router.push(buildProfileRequirementUrl({
            locale,
            requiredFields: profileFields.map((field) => field.key),
            eventTitle: invitation.event?.title ?? '',
            returnTo: `/${locale}/cabinet/events/${invitation.event?.slug}`,
          }));
          return;
        }
        if (eventFields.length > 0) {
          router.push(`/${locale}/cabinet/events/${invitation.event?.slug}`);
          return;
        }
        setError(isRu ? 'Заполните недостающие поля для регистрации.' : 'Complete missing registration fields.');
        return;
      }
      setError(err.message || (isRu ? 'Не удалось принять приглашение' : 'Failed to accept invitation'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleDecline(invitation: any) {
    setActionLoading(`decline:${invitation.id}`);
    setError('');
    setSuccess('');
    try {
      await eventsApi.declineTeamInvitation(invitation.id);
      setSuccess(isRu ? 'Приглашение отклонено.' : 'Invitation declined.');
      await loadInvitations();
    } catch (err: any) {
      setError(err.message || (isRu ? 'Не удалось отклонить приглашение' : 'Failed to decline invitation'));
    } finally {
      setActionLoading('');
    }
  }

  if (loading || !user) return null;

  const openInvitations = invitations.filter((invitation) => OPEN_STATUSES.has(invitation.status));
  const history = invitations.filter((invitation) => !OPEN_STATUSES.has(invitation.status));

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader title={isRu ? 'Приглашения в команды' : 'Team invitations'} subtitle={isRu ? 'Входящие приглашения и история решений' : 'Incoming invitations and decision history'} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      <Panel variant="elevated" className="workspace-event-panel">
        {pageLoading ? <LoadingLines rows={5} /> : openInvitations.length === 0 ? (
          <EmptyState title={isRu ? 'Новых приглашений нет' : 'No new invitations'} description={isRu ? 'Когда капитан пригласит вас по email, приглашение появится здесь.' : 'When a captain invites you by email, it will appear here.'} />
        ) : (
          <div className="signal-stack">
            {openInvitations.map((invitation) => {
              const regReason = getRegistrationClosedReason(invitation.event || {});
              const regBlocked = regReason !== null;
              const regMessage = getRegistrationClosedMessage(regReason, locale);
              return (
                <div key={invitation.id} className="signal-ranked-item">
                  <div>
                    <strong>{invitation.team?.name}</strong>
                    <div className="signal-muted">{invitation.event?.title}</div>
                  </div>
                  {regBlocked ? <Notice tone="warning">{regMessage}</Notice> : null}
                  <ToolbarRow>
                    <button onClick={() => void handleAccept(invitation)} disabled={regBlocked || Boolean(actionLoading)} className="btn btn-primary btn-sm">
                      {actionLoading === `accept:${invitation.id}` ? '...' : (isRu ? 'Принять' : 'Accept')}
                    </button>
                    <button onClick={() => void handleDecline(invitation)} disabled={Boolean(actionLoading)} className="btn btn-secondary btn-sm">
                      {actionLoading === `decline:${invitation.id}` ? '...' : (isRu ? 'Отклонить' : 'Decline')}
                    </button>
                    <Link href={`/${locale}/cabinet/events/${invitation.event?.slug}`} className="btn btn-ghost btn-sm">{isRu ? 'Открыть событие' : 'Open event'}</Link>
                  </ToolbarRow>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      {history.length > 0 ? (
        <Panel variant="elevated" className="workspace-event-panel">
          <div className="signal-stack">
            {history.map((invitation) => (
              <div key={invitation.id} className="signal-ranked-item">
                <span>{invitation.team?.name} · {invitation.event?.title}</span>
                <strong>{formatInvitationStatus(invitation.status, locale)}</strong>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function formatInvitationStatus(status: string | null | undefined, locale: string) {
  const ru: Record<string, string> = {
    ACCEPTED: 'Принято',
    DECLINED: 'Отказано',
    CANCELLED: 'Отменено',
    EXPIRED: 'Истекло',
    REMOVED: 'Удалено',
  };
  const en: Record<string, string> = {
    ACCEPTED: 'Accepted',
    DECLINED: 'Declined',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
    REMOVED: 'Removed',
  };
  return (locale === 'ru' ? ru : en)[status ?? ''] ?? (status ?? '—');
}
