'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import {
  EmptyState,
  FieldInput,
  FieldSelect,
  LoadingLines,
  MetricCard,
  PageHeader,
  Panel,
  SectionHeader,
  StatusBadge,
  TableShell,
  ToolbarRow,
} from '@/components/ui/signal-primitives';

type OrganizationNode = {
  id: string;
  type: 'workspace' | 'user' | 'event' | 'policy';
  label: string;
  kind?: string;
  status?: string;
  meta?: Record<string, unknown>;
};

type OrganizationEdge = {
  id: string;
  from: string;
  to: string;
  type: string;
  label?: string;
  meta?: Record<string, unknown>;
};

export default function OrganizationMapPage() {
  const locale = useRouteLocale();
  const isRu = locale === 'ru';
  const [map, setMap] = useState<{ nodes: OrganizationNode[]; edges: OrganizationEdge[]; summary: any } | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    adminApi.getOrganizationMap()
      .then(setMap)
      .catch((err) => setError(err?.message || (isRu ? 'Не удалось загрузить карту.' : 'Failed to load organization map.')));
  }, [isRu]);

  const filteredNodes = useMemo(() => {
    const nodes = map?.nodes ?? [];
    const normalizedSearch = search.trim().toLowerCase();

    return nodes.filter((node) => {
      if (typeFilter !== 'all' && node.type !== typeFilter) return false;
      if (!normalizedSearch) return true;
      return [node.label, node.status, node.kind, node.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [map, search, typeFilter]);

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes]);
  const visibleEdges = useMemo(() => {
    return (map?.edges ?? []).filter((edge) => visibleNodeIds.has(edge.from) || visibleNodeIds.has(edge.to)).slice(0, 200);
  }, [map, visibleNodeIds]);

  return (
    <div className="signal-page-shell admin-control-page organization-map-page">
      <PageHeader
        title={isRu ? 'Организация' : 'Organization'}
        subtitle={isRu ? 'Отделы, сотрудники, мероприятия и источники доступа в единой структуре.' : 'Workspaces, staff, events and access sources in one structure.'}
        actions={<Link href={`/${locale}/admin/workspaces`} className="btn btn-secondary">{isRu ? 'Отделы' : 'Workspaces'}</Link>}
      />

      {error ? <EmptyState title={error} description={isRu ? 'Проверьте права доступа или повторите попытку.' : 'Check access rights or try again.'} /> : null}
      {!map && !error ? <LoadingLines rows={6} /> : null}

      {map ? (
        <>
          <div className="signal-metrics-grid organization-summary-grid">
            <MetricCard label={isRu ? 'Отделы' : 'Workspaces'} value={map.summary?.workspaces ?? 0} />
            <MetricCard label={isRu ? 'Люди' : 'People'} value={map.summary?.users ?? 0} />
            <MetricCard label={isRu ? 'Мероприятия' : 'Events'} value={map.summary?.events ?? 0} />
            <MetricCard label={isRu ? 'Политики доступа' : 'Policies'} value={map.summary?.policies ?? 0} />
          </div>

          <Panel variant="elevated">
            <ToolbarRow>
              <FieldInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={isRu ? 'Поиск по названию, статусу или ID' : 'Search label, status or ID'}
                className="admin-filter-search"
              />
              <FieldSelect value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="admin-filter-select">
                <option value="all">{isRu ? 'Все типы' : 'All types'}</option>
                <option value="workspace">{isRu ? 'Отделы' : 'Workspaces'}</option>
                <option value="user">{isRu ? 'Люди' : 'People'}</option>
                <option value="event">{isRu ? 'Мероприятия' : 'Events'}</option>
                <option value="policy">{isRu ? 'Политики' : 'Policies'}</option>
              </FieldSelect>
            </ToolbarRow>
          </Panel>

          <Panel variant="elevated">
            <SectionHeader
              title={isRu ? 'Объекты организации' : 'Organization objects'}
              subtitle={`${filteredNodes.length} / ${map.nodes?.length ?? 0}`}
            />
            <TableShell>
              <table className="signal-table organization-map-table">
                <thead>
                  <tr>
                    <th>{isRu ? 'Тип' : 'Type'}</th>
                    <th>{isRu ? 'Название' : 'Label'}</th>
                    <th>{isRu ? 'Статус' : 'Status'}</th>
                    <th>{isRu ? 'Параметры' : 'Details'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNodes.slice(0, 300).map((node) => (
                    <tr key={node.id}>
                      <td><StatusBadge tone={toneByType(node.type)}>{formatNodeType(node.type, locale)}</StatusBadge></td>
                      <td>
                        <strong>{node.label}</strong>
                        <div className="signal-muted">{node.id}</div>
                      </td>
                      <td>{node.status || node.kind || '—'}</td>
                      <td>{formatNodeMeta(node, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </Panel>

          <Panel variant="elevated">
            <SectionHeader
              title={isRu ? 'Связи доступа' : 'Access links'}
              subtitle={`${visibleEdges.length} / ${map.edges?.length ?? 0}`}
            />
            {visibleEdges.length === 0 ? (
              <span className="signal-muted">{isRu ? 'Нет связей для текущего фильтра' : 'No links for current filter'}</span>
            ) : (
              <TableShell>
                <table className="signal-table organization-map-table">
                  <thead>
                    <tr>
                      <th>{isRu ? 'Тип связи' : 'Link type'}</th>
                      <th>{isRu ? 'От' : 'From'}</th>
                      <th>{isRu ? 'К' : 'To'}</th>
                      <th>{isRu ? 'Роль' : 'Role'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEdges.map((edge) => (
                      <tr key={edge.id}>
                        <td><StatusBadge tone="neutral">{formatEdgeType(edge.type, locale)}</StatusBadge></td>
                        <td>{labelForNode(map.nodes, edge.from)}</td>
                        <td>{labelForNode(map.nodes, edge.to)}</td>
                        <td>{edge.label || edge.meta?.source ? String(edge.label ?? edge.meta?.source) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function toneByType(type: OrganizationNode['type']): 'neutral' | 'info' | 'success' | 'warning' {
  if (type === 'workspace') return 'info';
  if (type === 'user') return 'success';
  if (type === 'event') return 'warning';
  return 'neutral';
}

function formatNodeType(type: string, locale: string) {
  const ru: Record<string, string> = {
    workspace: 'Отдел',
    user: 'Человек',
    event: 'Мероприятие',
    policy: 'Политика',
  };
  const en: Record<string, string> = {
    workspace: 'Workspace',
    user: 'Person',
    event: 'Event',
    policy: 'Policy',
  };
  return (locale === 'ru' ? ru : en)[type] ?? type;
}

function formatEdgeType(type: string, locale: string) {
  const ru: Record<string, string> = {
    parent_child: 'Иерархия',
    workspace_member: 'Сотрудник отдела',
    workspace_event: 'Мероприятие отдела',
    event_staff: 'Доступ к событию',
    policy_grant: 'Политика',
  };
  const en: Record<string, string> = {
    parent_child: 'Hierarchy',
    workspace_member: 'Workspace member',
    workspace_event: 'Workspace event',
    event_staff: 'Event access',
    policy_grant: 'Policy',
  };
  return (locale === 'ru' ? ru : en)[type] ?? type;
}

function formatNodeMeta(node: OrganizationNode, locale: string) {
  const meta = node.meta ?? {};
  if (node.type === 'workspace') {
    const members = Number(meta.membersCount ?? 0);
    const events = Number(meta.eventsCount ?? 0);
    return locale === 'ru' ? `${members} сотрудников, ${events} мероприятий` : `${members} members, ${events} events`;
  }
  if (node.type === 'event') {
    const startsAt = meta.startsAt ? new Date(String(meta.startsAt)).toLocaleDateString(locale) : null;
    return startsAt ? (locale === 'ru' ? `Старт: ${startsAt}` : `Starts: ${startsAt}`) : '—';
  }
  if (node.type === 'policy') {
    const full = meta.fullWorkspaceAccess ? (locale === 'ru' ? 'полный доступ' : 'full access') : null;
    const auto = meta.autoApplyToNewEvents ? (locale === 'ru' ? 'авто для новых событий' : 'auto for new events') : null;
    return [full, auto].filter(Boolean).join(', ') || '—';
  }
  if (node.type === 'user' && meta.externalCollaborator) {
    return locale === 'ru' ? 'Внешний участник доступа' : 'External access collaborator';
  }
  return '—';
}

function labelForNode(nodes: OrganizationNode[], id: string) {
  return nodes.find((node) => node.id === id)?.label ?? id;
}
