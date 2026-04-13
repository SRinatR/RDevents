'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../hooks/useAuth';

interface NavbarProps {
  locale: string;
}

export function Navbar({ locale }: NavbarProps) {
  const t = useTranslations();
  const { user, logout, isAdmin } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push(`/${locale}`);
  }

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      borderBottom: '1px solid var(--color-border)',
      background: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{
        width: 'min(1200px, calc(100% - 32px))',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
        gap: 16,
      }}>
        {/* Logo */}
        <Link href={`/${locale}`} style={{ fontWeight: 900, fontSize: '1.1rem', letterSpacing: 0, color: 'var(--color-primary)' }}>
          EventPlatform
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' }}>
          <NavLink href={`/${locale}/events`}>{t('nav.events')}</NavLink>
          {user && <NavLink href={`/${locale}/cabinet`}>{t('nav.cabinet')}</NavLink>}
          {isAdmin && <NavLink href={`/${locale}/admin`}>{t('nav.admin')}</NavLink>}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LocaleSwitcherInline locale={locale} />
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link
                href={`/${locale}/cabinet/profile`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}>
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link
                href={`/${locale}/login`}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  color: 'var(--color-text-primary)',
                }}
              >
                {t('nav.login')}
              </Link>
              <Link
                href={`/${locale}/register`}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {t('nav.register')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: '6px 14px',
        borderRadius: 'var(--radius-lg)',
        fontSize: '0.9rem',
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        transition: 'color var(--transition-fast)',
      }}
    >
      {children}
    </Link>
  );
}

function LocaleSwitcherInline({ locale }: { locale: string }) {
  const pathname = usePathname();
  const otherLocale = locale === 'en' ? 'ru' : 'en';
  const label = locale === 'en' ? 'RU' : 'EN';
  const nextPath = switchLocalePath(pathname, locale, otherLocale);

  return (
    <Link
      href={nextPath}
      style={{
        padding: '5px 10px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        fontSize: '0.8rem',
        fontWeight: 700,
        color: 'var(--color-text-muted)',
        letterSpacing: '0.05em',
      }}
    >
      {label}
    </Link>
  );
}

function switchLocalePath(pathname: string, currentLocale: string, nextLocale: string) {
  const parts = pathname.split('/');

  if (parts[1] === currentLocale) {
    parts[1] = nextLocale;
    return parts.join('/') || `/${nextLocale}`;
  }

  return `/${nextLocale}${pathname === '/' ? '' : pathname}`;
}
