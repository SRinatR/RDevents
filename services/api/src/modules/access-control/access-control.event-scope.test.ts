import { describe, expect, it } from 'vitest';
import { buildEventScopeWhere, classifyEventTimeScope } from './access-control.event-scope.js';

const now = new Date('2026-04-26T10:00:00.000Z');

describe('buildEventScopeWhere', () => {
  it('builds past event scope', () => {
    expect(buildEventScopeWhere({
      includePastEvents: true,
      includeCurrentEvents: false,
      includeFutureEvents: false,
      includeCancelledEvents: false,
      fullWorkspaceAccess: false,
      now,
    })).toEqual({
      OR: [
        { status: 'COMPLETED' },
        { endsAt: { lt: now } },
      ],
    });
  });

  it('builds current and future scopes', () => {
    expect(buildEventScopeWhere({
      includePastEvents: false,
      includeCurrentEvents: true,
      includeFutureEvents: true,
      includeCancelledEvents: false,
      fullWorkspaceAccess: false,
      now,
    })).toEqual({
      OR: [
        { status: { in: ['DRAFT', 'PUBLISHED'] }, startsAt: { lte: now }, endsAt: { gte: now } },
        { status: { in: ['DRAFT', 'PUBLISHED'] }, startsAt: { gt: now } },
      ],
    });
  });

  it('builds cancelled scope', () => {
    expect(buildEventScopeWhere({
      includePastEvents: false,
      includeCurrentEvents: false,
      includeFutureEvents: false,
      includeCancelledEvents: true,
      fullWorkspaceAccess: false,
      now,
    })).toEqual({ OR: [{ status: 'CANCELLED' }] });
  });

  it('full workspace access includes every time scope', () => {
    const where = buildEventScopeWhere({
      includePastEvents: false,
      includeCurrentEvents: false,
      includeFutureEvents: false,
      includeCancelledEvents: false,
      fullWorkspaceAccess: true,
      now,
    });

    expect(where.OR).toHaveLength(5);
  });

  it('returns an empty matcher when no checkboxes are selected', () => {
    expect(buildEventScopeWhere({
      includePastEvents: false,
      includeCurrentEvents: false,
      includeFutureEvents: false,
      includeCancelledEvents: false,
      fullWorkspaceAccess: false,
      now,
    })).toEqual({ id: { in: [] } });
  });
});

describe('classifyEventTimeScope', () => {
  it('classifies cancelled before time windows', () => {
    expect(classifyEventTimeScope({
      status: 'CANCELLED',
      startsAt: '2026-05-01T10:00:00.000Z',
      endsAt: '2026-05-01T12:00:00.000Z',
    }, now)).toBe('cancelled');
  });

  it('classifies past, current and future events', () => {
    expect(classifyEventTimeScope({
      status: 'COMPLETED',
      startsAt: '2026-04-01T10:00:00.000Z',
      endsAt: '2026-04-01T12:00:00.000Z',
    }, now)).toBe('past');

    expect(classifyEventTimeScope({
      status: 'PUBLISHED',
      startsAt: '2026-04-26T09:00:00.000Z',
      endsAt: '2026-04-26T11:00:00.000Z',
    }, now)).toBe('current');

    expect(classifyEventTimeScope({
      status: 'DRAFT',
      startsAt: '2026-04-27T09:00:00.000Z',
      endsAt: '2026-04-27T11:00:00.000Z',
    }, now)).toBe('future');
  });
});
