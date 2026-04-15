const roleMap: Record<string, { cls: string; label: string }> = {
  SUPER_ADMIN:    { cls: 'role-super-admin',    label: 'Super Admin'    },
  PLATFORM_ADMIN: { cls: 'role-platform-admin', label: 'Platform Admin' },
  USER:           { cls: 'role-user',           label: 'User'           },
};

interface RoleBadgeProps { role: string }

export function RoleBadge({ role }: RoleBadgeProps) {
  const { cls, label } = roleMap[role] ?? { cls: 'role-user', label: role };
  return <span className={`role-badge ${cls}`}>{label}</span>;
}
