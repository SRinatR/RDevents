'use client';

import { useParams } from 'next/navigation';

type RouteParamValue = string | string[] | undefined;

function readParam(value: RouteParamValue, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export function useRouteLocale(defaultLocale = 'en') {
  const params = useParams<Record<string, RouteParamValue>>();
  return readParam(params.locale, defaultLocale);
}

export function useRouteParam(name: string, fallback = '') {
  const params = useParams<Record<string, RouteParamValue>>();
  return readParam(params[name], fallback);
}

export function useRouteParams(defaultLocale = 'en') {
  const params = useParams<Record<string, RouteParamValue>>();

  return {
    locale: readParam(params.locale, defaultLocale),
    get: (name: string, fallback = '') => readParam(params[name], fallback),
  };
}
