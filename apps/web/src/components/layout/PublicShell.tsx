import type { ReactNode } from 'react';
import { Navbar } from './Navbar';

type PublicShellProps = {
  locale: string;
  children: ReactNode;
};

export function PublicShell({ locale, children }: PublicShellProps) {
  return (
    <div className="app-shell app-shell-public public-shell" data-shell="public">
      <Navbar locale={locale} />
      <main className="app-shell-main app-shell-main-public public-shell-main">{children}</main>
    </div>
  );
}
