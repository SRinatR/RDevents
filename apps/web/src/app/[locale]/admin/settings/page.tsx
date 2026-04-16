'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, PageHeader, Panel, StatusBadge } from '@/components/ui/signal-primitives';

export default function AdminSettingsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  if (loading || !user || !isAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="signal-page-shell admin-control-page">
        <EmptyState
          title={locale === 'ru' ? 'Доступ запрещён' : 'Access denied'}
          description={locale === 'ru' ? 'Настройки доступны только платформенным администраторам.' : 'Settings are only available to platform administrators.'}
        />
      </div>
    );
  }

  const settingsSections = [
    {
      title: locale === 'ru' ? 'Платформенные настройки' : 'Platform settings',
      description: locale === 'ru' ? 'Основная конфигурация платформы' : 'Core platform configuration',
      status: 'pending' as const,
    },
    {
      title: locale === 'ru' ? 'Email настройки' : 'Email settings',
      description: locale === 'ru' ? 'Конфигурация email провайдера' : 'Email provider configuration',
      status: 'pending' as const,
    },
    {
      title: locale === 'ru' ? 'Настройки доменов' : 'Domain settings',
      description: locale === 'ru' ? 'Управление sending доменами и DNS' : 'Sending domains and DNS management',
      status: 'pending' as const,
    },
    {
      title: locale === 'ru' ? 'Настройки уведомлений' : 'Notification settings',
      description: locale === 'ru' ? 'Конфигурация автоматических уведомлений' : 'Automated notification configuration',
      status: 'pending' as const,
    },
  ];

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={t('admin.settings') ?? 'Settings'}
        subtitle={locale === 'ru' ? 'Конфигурация платформы' : 'Platform configuration'}
      />

      <div className="signal-stack">
        {settingsSections.map((section) => (
          <Panel key={section.title} variant="elevated" className="admin-command-panel">
            <div className="signal-section-header">
              <div>
                <h2>{section.title}</h2>
                <p className="signal-muted">{section.description}</p>
              </div>
              <StatusBadge tone="warning">{locale === 'ru' ? 'В разработке' : 'In development'}</StatusBadge>
            </div>
            <p className="signal-muted">
              {locale === 'ru' 
                ? 'Эта секция будет доступна в следующих фазах разработки.' 
                : 'This section will be available in upcoming development phases.'}
            </p>
          </Panel>
        ))}
      </div>

      <Panel variant="subtle" className="admin-command-panel">
        <div className="signal-section-header">
          <div>
            <h2>{locale === 'ru' ? 'Текущая конфигурация' : 'Current configuration'}</h2>
            <p className="signal-muted">{locale === 'ru' ? 'Основные параметры платформы' : 'Core platform parameters'}</p>
          </div>
        </div>
        <div className="signal-stack">
          <div className="signal-ranked-item">
            <span>{locale === 'ru' ? 'Режим работы' : 'Operation mode'}</span>
            <StatusBadge tone="info">Production</StatusBadge>
          </div>
          <div className="signal-ranked-item">
            <span>{locale === 'ru' ? 'Версия API' : 'API version'}</span>
            <StatusBadge tone="neutral">v1</StatusBadge>
          </div>
          <div className="signal-ranked-item">
            <span>{locale === 'ru' ? 'Регион данных' : 'Data region'}</span>
            <StatusBadge tone="neutral">EU</StatusBadge>
          </div>
        </div>
      </Panel>
    </div>
  );
}