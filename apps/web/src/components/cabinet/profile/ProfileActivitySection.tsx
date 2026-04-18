import { EmptyState, MetricCard, StatusBadge } from '@/components/ui/signal-primitives';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import type { ProfileActivity, ProfileSectionStatus } from './profile.types';

type ProfileActivitySectionProps = {
  locale: string;
  status: ProfileSectionStatus;
  activity: ProfileActivity;
};

export function ProfileActivitySection({ locale, status, activity }: ProfileActivitySectionProps) {
  const events = activity.events ?? [];
  const teams = activity.teams ?? [];
  const volunteerApplications = activity.volunteerApplications ?? [];
  const hasActivity = events.length > 0 || teams.length > 0 || volunteerApplications.length > 0;

  return (
    <ProfileSectionLayout
      locale={locale}
      title={locale === 'ru' ? 'Активность' : 'Activity'}
      description={locale === 'ru' ? 'Ваши участия, команды и волонтёрские заявки' : 'Your events, teams, and volunteer applications'}
      status={status}
    >
      <div className="signal-stack">
        <div className="signal-kpi-grid">
          <MetricCard label={locale === 'ru' ? 'Мероприятия' : 'Events'} value={events.length} tone="info" />
          <MetricCard label={locale === 'ru' ? 'Команды' : 'Teams'} value={teams.length} tone="success" />
          <MetricCard label={locale === 'ru' ? 'Волонтёрство' : 'Volunteering'} value={volunteerApplications.length} tone="warning" />
        </div>

        {hasActivity ? (
          <div className="profile-activity-grid">
            <ActivityList
              locale={locale}
              title={locale === 'ru' ? 'Мои мероприятия' : 'My events'}
              items={events.map((entry) => ({
                id: entry.memberId,
                title: entry.event?.title ?? (locale === 'ru' ? 'Мероприятие' : 'Event'),
                meta: entry.role,
                status: entry.status,
              }))}
            />
            <ActivityList
              locale={locale}
              title={locale === 'ru' ? 'Мои команды' : 'My teams'}
              items={teams.map((entry) => ({
                id: entry.id,
                title: entry.team?.name ?? (locale === 'ru' ? 'Команда' : 'Team'),
                meta: entry.team?.event?.title ?? '',
                status: entry.status,
              }))}
            />
            <ActivityList
              locale={locale}
              title={locale === 'ru' ? 'Волонтёрские заявки' : 'Volunteer applications'}
              items={volunteerApplications.map((entry) => ({
                id: entry.id,
                title: entry.event?.title ?? (locale === 'ru' ? 'Заявка' : 'Application'),
                meta: entry.event?.location ?? '',
                status: entry.status,
              }))}
            />
          </div>
        ) : (
          <EmptyState
            title={locale === 'ru' ? 'Активности пока нет' : 'No activity yet'}
            description={locale === 'ru' ? 'После участия здесь появятся заявки и команды.' : 'Applications and teams will appear here after participation.'}
          />
        )}
      </div>
    </ProfileSectionLayout>
  );
}

function ActivityList({
  locale,
  title,
  items,
}: {
  locale: string;
  title: string;
  items: Array<{ id: string; title: string; meta?: string; status?: string }>;
}) {
  return (
    <div className="profile-activity-list">
      <h3>{title}</h3>
      {items.length > 0 ? items.slice(0, 4).map((item) => (
        <div key={item.id} className="profile-activity-row">
          <span>
            <strong>{item.title}</strong>
            {item.meta ? <small>{item.meta}</small> : null}
          </span>
          {item.status ? <StatusBadge tone="neutral" size="sm">{item.status}</StatusBadge> : null}
        </div>
      )) : (
        <p>{locale === 'ru' ? 'Пока пусто' : 'Empty for now'}</p>
      )}
    </div>
  );
}
