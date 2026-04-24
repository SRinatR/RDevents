import { BaseProvider } from './base.provider';
import { ReleaseProvider } from './release.provider';
import { HealthProvider } from './health.provider';
import { DockerProvider } from './docker.provider';
import { SystemdProvider } from './systemd.provider';
import { DatabaseProvider } from './database.provider';
import { StorageProvider } from './storage.provider';
import { SecurityProvider } from './security.provider';

export { BaseProvider } from './base.provider';
export { ReleaseProvider } from './release.provider';
export { HealthProvider } from './health.provider';
export { DockerProvider } from './docker.provider';
export { SystemdProvider } from './systemd.provider';
export { DatabaseProvider } from './database.provider';
export { StorageProvider } from './storage.provider';
export { SecurityProvider } from './security.provider';

const providers: Record<string, BaseProvider> = {};

export function getProviders(): Record<string, BaseProvider> {
  if (Object.keys(providers).length === 0) {
    providers.release = new ReleaseProvider();
    providers.health = new HealthProvider();
    providers.docker = new DockerProvider();
    providers.systemd = new SystemdProvider();
    providers.database = new DatabaseProvider();
    providers.storage = new StorageProvider();
    providers.security = new SecurityProvider();
  }
  return providers;
}

export function getProvider(key: string): BaseProvider | undefined {
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
