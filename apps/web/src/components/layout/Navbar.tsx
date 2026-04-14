'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../hooks/useAuth';
import { useEffect, useState, useRef } from 'react';

interface NavbarProps {
  locale: string;
}

export function Navbar({ locale }: NavbarProps) {
  const t = useTranslations();
  const { user, logout, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileOpen]);

  async function handleLogout() {
    await logout();
    router.push(`/${locale}`);
    setMobileOpen(false);
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  const navLinks = [
    { href: `/${locale}/events`, label: t('nav.events') || 'Мероприятия' },
    ...(user ? [{ href: `/${locale}/cabinet`, label: t('nav.cabinet') || 'Кабинет' }] : []),
    ...(isAdmin ? [{ href: `/${locale}/admin`, label: t('nav.admin') || 'Админка' }] : []),
  ];

  const otherLocale = locale === 'en' ? 'ru' : 'en';
  const nextPath = switchLocalePath(pathname, locale, otherLocale);
  const displayName = user?.name || user?.email || '';

  return (
    <>
      <header className={`bg-white border-b border-gray-100 ${scrolled ? 'shadow-sm' : ''}`}>
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href={`/${locale}`} className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E55C94] text-lg font-black text-white">
                E
              </span>
              <span className="hidden text-base font-black text-[#1a1a1a] sm:block">
                EventPlatform
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-8 text-sm font-medium">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`hover:text-primary transition-colors${isActive(href) ? ' text-primary' : ''}`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {user ? (
                  <Link href={`/${locale}/cabinet`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div className="w-10 h-10 bg-[#5CEBAA] rounded-full flex items-center justify-center text-white font-semibold text-sm border-2 border-white shadow-sm">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden md:block text-sm font-medium">{displayName}</span>
                  </Link>
                ) : null}

                <div className="hidden md:flex items-center gap-3">
                  <Link
                    href={nextPath}
                    className="rounded-full px-4 py-1 h-8 text-xs border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors font-medium"
                  >
                    {otherLocale.toUpperCase()}
                  </Link>
                  {user ? (
                    <button
                      onClick={handleLogout}
                      className="rounded-full px-6 py-1 h-9 text-sm bg-[#E55C94] hover:bg-[#D04A82] text-white font-medium transition-colors"
                    >
                      {t('nav.logout') || 'Выйти'}
                    </button>
                  ) : (
                    <Link
                      href={`/${locale}/login`}
                      className="rounded-full px-6 py-1 h-9 text-sm bg-[#E55C94] hover:bg-[#D04A82] text-white font-medium transition-colors"
                    >
                      {t('nav.login') || 'Войти'}
                    </Link>
                  )}
                </div>
              </div>

              <button
                className="lg:hidden burger"
                onClick={() => setMobileOpen(v => !v)}
                aria-label="Menu"
              >
                <span className="burger-line" style={mobileOpen ? { transform: 'rotate(45deg) translate(5px, 5px)' } : {}} />
                <span className="burger-line" style={mobileOpen ? { opacity: 0 } : {}} />
                <span className="burger-line" style={mobileOpen ? { transform: 'rotate(-45deg) translate(5px, -5px)' } : {}} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div ref={mobileRef} className={`mobile-menu${mobileOpen ? ' open' : ''}`}>
        {navLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`mobile-link${isActive(href) ? ' active' : ''}`}
          >
            {label}
          </Link>
        ))}

        <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />

        {user ? (
          <>
            <Link href={`/${locale}/cabinet`} className="mobile-link">
              👤 {displayName}
            </Link>
            <button
              onClick={handleLogout}
              style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '13px 16px', borderRadius: 'var(--radius-lg)', fontSize: '1rem', fontWeight: 600, color: 'var(--color-danger)', width: '100%' }}
            >
              {t('nav.logout')}
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <Link href={`/${locale}/login`} className="btn btn-primary" style={{ justifyContent: 'center' }}>
              {t('nav.login')}
            </Link>
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <Link href={nextPath} className="locale-switcher">
            {otherLocale.toUpperCase()}
          </Link>
        </div>
      </div>
    </>
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
