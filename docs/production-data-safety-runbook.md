# Production data safety runbook

## Check event state
```sql
select id, slug, title, status, "deletedAt", "protectedFromCleanup"
from events
where slug = 'dom-gde-zhivet-rossiya';
```

## Check participants/teams/analytics
```sql
select
  (select count(*) from event_members where "eventId" = $eventId and role = 'PARTICIPANT' and status <> 'REMOVED') as total_applications,
  (select count(*) from event_members where "eventId" = $eventId and role = 'PARTICIPANT' and status = 'PENDING') as pending,
  (select count(*) from event_members where "eventId" = $eventId and role = 'PARTICIPANT' and status = 'ACTIVE') as approved,
  (select count(*) from event_members where "eventId" = $eventId and role = 'PARTICIPANT' and status in ('REJECTED', 'CANCELLED', 'REMOVED')) as rejected,
  (select count(*) from event_members where "eventId" = $eventId and role = 'VOLUNTEER' and status = 'PENDING') as volunteers_pending,
  (select count(*) from event_teams where "eventId" = $eventId and coalesce("deletedAt", null) is null) as teams,
  (select count(*) from analytics_events where "eventId" = $eventId and type = 'EVENT_DETAIL_VIEW') as views;
```

## Manual backup before operations
```bash
pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > /opt/rdevents/backups/manual-before-operation-$(date +%Y%m%d-%H%M%S).sql.gz
```

## Restore strategy
Always restore into a temporary database first, validate all event counters and user states, then perform targeted replay/migration into production. Never restore directly over the production database without creating a fresh backup first.
