import { BaseReportProvider } from './base.provider.js';
import { ReleaseProvider } from './release.provider.js';
import { HealthProvider } from './health.provider.js';
import { DockerProvider } from './docker.provider.js';
import { SystemdProvider } from './systemd.provider.js';
import { DatabaseProvider } from './database.provider.js';
import { StorageProvider } from './storage.provider.js';
import { SecurityProvider } from './security.provider.js';
import { PerformanceProvider } from './performance.provider.js';
import { AuditProvider } from './audit.provider.js';

export { BaseReportProvider } from './base.provider.js';
export { ReleaseProvider } from './release.provider.js';
export { HealthProvider } from './health.provider.js';
export { DockerProvider } from './docker.provider.js';
export { SystemdProvider } from './systemd.provider.js';
export { DatabaseProvider } from './database.provider.js';
export { StorageProvider } from './storage.provider.js';
export { SecurityProvider } from './security.provider.js';
export { PerformanceProvider } from './performance.provider.js';
export { AuditProvider } from './audit.provider.js';

const providers: Record<string, BaseReportProvider> = {};

export function getProviders(): Record<string, BaseReportProvider> {
  if (Object.keys(providers).length === 0) {
    providers.release = new ReleaseProvider();
    providers.health = new HealthProvider();
    providers.docker = new DockerProvider();
    providers.systemd = new SystemdProvider();
    providers.database = new DatabaseProvider();
    providers.storage = new StorageProvider();
    providers.security = new SecurityProvider();
    providers.performance = new PerformanceProvider();
    providers.audit = new AuditProvider();
  }
  return providers;
}

export function getProvider(key: string): BaseReportProvider | undefined {
  return getProviders()[key];
}

export function listProviders(): Array<{ key: string; label: string; description: string; category: string }> {
  const all = getProviders();
  return Object.values(all).map(p => ({
    key: p.key,
    label: p.label,
    description: p.description,
    category: p.category,
  }));
}
