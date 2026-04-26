import type { EventStatus } from '@prisma/client';

export type EventTimeScope = 'past' | 'current' | 'future' | 'cancelled';

export interface EventScopeOptions {
  includePastEvents: boolean;
  includeCurrentEvents: boolean;
  includeFutureEvents: boolean;
  includeCancelledEvents: boolean;
  fullWorkspaceAccess: boolean;
  now?: Date;
}

export interface EventLikeForScope {
  id?: string;
  status: EventStatus | string;
  startsAt: Date | string;
  endsAt: Date | string;
}

export function buildEventScopeWhere(options: EventScopeOptions) {
  const now = options.now ?? new Date();

  if (options.fullWorkspaceAccess) {
    return {
      OR: [
        { status: 'COMPLETED' },
        { endsAt: { lt: now } },
        { status: { in: ['DRAFT', 'PUBLISHED'] }, startsAt: { lte: now }, endsAt: { gte: now } },
        { status: { in: ['DRAFT', 'PUBLISHED'] }, startsAt: { gt: now } },
        { status: 'CANCELLED' },
      ],
    };
  }

  const or: any[] = [];

  if (options.includePastEvents) {
    or.push({ status: 'COMPLETED' });
    or.push({ endsAt: { lt: now } });
  }

  if (options.includeCurrentEvents) {
    or.push({
      status: { in: ['DRAFT', 'PUBLISHED'] },
      startsAt: { lte: now },
      endsAt: { gte: now },
    });
  }

  if (options.includeFutureEvents) {
    or.push({
      status: { in: ['DRAFT', 'PUBLISHED'] },
      startsAt: { gt: now },
    });
  }

  if (options.includeCancelledEvents) {
    or.push({ status: 'CANCELLED' });
  }

  return or.length > 0 ? { OR: or } : { id: { in: [] } };
}

export function classifyEventTimeScope(event: EventLikeForScope, now = new Date()): EventTimeScope {
  const startsAt = event.startsAt instanceof Date ? event.startsAt : new Date(event.startsAt);
  const endsAt = event.endsAt instanceof Date ? event.endsAt : new Date(event.endsAt);

  if (event.status === 'CANCELLED') return 'cancelled';
  if (event.status === 'COMPLETED' || endsAt < now) return 'past';
  if (['DRAFT', 'PUBLISHED'].includes(String(event.status)) && startsAt <= now && endsAt >= now) return 'current';
  return 'future';
}

export function eventMatchesScopeOptions(event: EventLikeForScope, options: EventScopeOptions) {
  if (options.fullWorkspaceAccess) return true;

  const scope = classifyEventTimeScope(event, options.now);
  return (
    (scope === 'past' && options.includePastEvents) ||
    (scope === 'current' && options.includeCurrentEvents) ||
    (scope === 'future' && options.includeFutureEvents) ||
    (scope === 'cancelled' && options.includeCancelledEvents)
  );
}
