'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { systemReportApi } from '@/lib/api';
import type { ReportSection, SystemReportTemplate, SystemReportGeneration, ReportConfig, ReportSectionConfig } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Panel, LoadingLines, StatusBadge } from '@/components/ui/signal-primitives';
import { ReportTemplatesPanel } from '@/components/admin/reports/ReportTemplatesPanel';
import { ReportConfigPanel } from '@/components/admin/reports/ReportConfigPanel';
import { ReportPreviewPanel } from '@/components/admin/reports/ReportPreviewPanel';
import { GenerationHistoryPanel } from '@/components/admin/reports/GenerationHistoryPanel';

type GenerationState = 'idle' | 'queued' | 'running' | 'success' | 'failed';

export default function SystemReportsPage() {
  const t = useTranslations('admin.systemReports');
  const locale = useRouteLocale();

  const [templates, setTemplates] = useState<SystemReportTemplate[]>([]);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [generations, setGenerations] = useState<SystemReportGeneration[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SystemReportTemplate | null>(null);
  const [currentConfig, setCurrentConfig] = useState<ReportConfig | null>(null);
  const [activeGeneration, setActiveGeneration] = useState<SystemReportGeneration | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'constructor' | 'history'>('constructor');

  const loadData = useCallback(async () => {
    try {
      const [templatesData, sectionsData, generationsData] = await Promise.all([
        systemReportApi.getV2Templates(),
        systemReportApi.getSections(),
        systemReportApi.getGenerations(10),
      ]);

      setTemplates(templatesData);
      setSections(sectionsData);
      setGenerations(generationsData);

      if (templatesData.length > 0 && !selectedTemplate) {
        const defaultTemplate = templatesData.find(t => t.isDefault) || templatesData[0];
        setSelectedTemplate(defaultTemplate);
        setCurrentConfig(defaultTemplate.config);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeGeneration && (activeGeneration.status === 'queued' || activeGeneration.status === 'running')) {
      const interval = setInterval(async () => {
        try {
          const updated = await systemReportApi.getGeneration(activeGeneration.id);
          setActiveGeneration(updated);
          if (updated.status === 'success' || updated.status === 'failed') {
            clearInterval(interval);
            loadData();
          }
        } catch (error) {
          console.error('Failed to poll generation:', error);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [activeGeneration?.id, activeGeneration?.status, loadData]);

  const handleSelectTemplate = (template: SystemReportTemplate) => {
    setSelectedTemplate(template);
    setCurrentConfig(template.config);
  };

  const handleUpdateConfig = (config: ReportConfig) => {
    setCurrentConfig(config);
  };

  const handleSaveAsTemplate = async (name: string, description?: string) => {
    if (!currentConfig) return;

    try {
      const newTemplate = await systemReportApi.createV2Template({
        name,
        description,
        config: currentConfig,
        isDefault: false,
      });
      setTemplates([...templates, newTemplate]);
      setSelectedTemplate(newTemplate);
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const handleGenerate = async () => {
    if (!currentConfig) return;

    setGenerating(true);
    try {
      const result = await systemReportApi.startGeneration(currentConfig, selectedTemplate?.id);
      const newGeneration: SystemReportGeneration = {
        id: result.id,
        templateId: selectedTemplate?.id,
        templateName: selectedTemplate?.name,
        status: result.status as 'queued' | 'running' | 'success' | 'failed',
        progress: result.progress,
        format: currentConfig.format,
        createdAt: result.createdAt,
      };
      setActiveGeneration(newGeneration);
      setActiveTab('constructor');
    } catch (error) {
      console.error('Failed to start generation:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await systemReportApi.deleteV2Template(templateId);
      setTemplates(templates.filter(t => t.id !== templateId));
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
        setCurrentConfig(null);
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      await systemReportApi.updateV2Template(templateId, { isDefault: true });
      setTemplates(templates.map(t => ({
        ...t,
        isDefault: t.id === templateId,
      })));
    } catch (error) {
      console.error('Failed to set default:', error);
    }
  };

  if (loading) {
    return (
      <div className="signal-page-shell admin-dashboard-shell route-shell">
        <AdminPageHeader title={t('title')} subtitle={t('subtitle')} />
        <LoadingLines rows={8} />
      </div>
    );
  }

  return (
    <div className="signal-page-shell admin-dashboard-shell route-shell route-admin-system-reports">
      <AdminPageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <div className="report-header-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setActiveTab('history')}
            >
              {t('history')}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setActiveTab('constructor')}
            >
              {t('constructor')}
            </button>
          </div>
        }
      />

      {activeTab === 'constructor' ? (
        <div className="report-constructor">
          <div className="report-column report-column-templates">
            <ReportTemplatesPanel
              templates={templates}
              selectedTemplate={selectedTemplate}
              onSelect={handleSelectTemplate}
              onDelete={handleDeleteTemplate}
              onSetDefault={handleSetDefault}
              onCreateNew={() => {
                setSelectedTemplate(null);
                setCurrentConfig({
                  sections: sections.map(s => ({
                    key: s.key,
                    enabled: false,
                    params: s.defaultParams,
                  })),
                  format: 'txt',
                  maskSensitiveData: true,
                });
              }}
              locale={locale}
              t={t}
            />
          </div>

          <div className="report-column report-column-config">
            <ReportConfigPanel
              config={currentConfig}
              sections={sections}
              onUpdate={handleUpdateConfig}
              generating={generating}
              activeGeneration={activeGeneration}
              onGenerate={handleGenerate}
              onSaveAsTemplate={handleSaveAsTemplate}
              t={t}
              locale={locale}
            />
          </div>

          <div className="report-column report-column-preview">
            <ReportPreviewPanel
              config={currentConfig}
              sections={sections}
              activeGeneration={activeGeneration}
              t={t}
              locale={locale}
            />
          </div>
        </div>
      ) : (
        <GenerationHistoryPanel
          generations={generations}
          onRefresh={loadData}
          t={t}
          locale={locale}
        />
      )}
    </div>
  );
}
