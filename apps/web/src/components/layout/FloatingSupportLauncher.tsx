import Link from 'next/link';

type FloatingSupportLauncherProps = {
  locale: string;
};

export function FloatingSupportLauncher({ locale }: FloatingSupportLauncherProps) {
  const href = `/${locale}/cabinet/support`;
  const ariaLabel = locale === 'ru' ? 'Открыть поддержку' : 'Open support';

  return (
    <Link href={href} className="floating-support-launcher" aria-label={ariaLabel}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3.5a8.5 8.5 0 0 0-8.5 8.5v2.3c0 1.1.9 2 2 2H7V12a1 1 0 0 1 2 0v4.3h6V12a1 1 0 1 1 2 0v4.3h1.5c1.1 0 2-.9 2-2V12A8.5 8.5 0 0 0 12 3.5Zm0-2A10.5 10.5 0 0 1 22.5 12v2.3a4 4 0 0 1-4 4h-2.6a2 2 0 0 1-1.9 1.4h-4a2 2 0 0 1-1.9-1.4H5.5a4 4 0 0 1-4-4V12A10.5 10.5 0 0 1 12 1.5ZM10 20.3h4v.2h-4v-.2Z" fill="currentColor" />
      </svg>
      <span className="sr-only">{locale === 'ru' ? 'Поддержка' : 'Support'}</span>
    </Link>
  );
}
