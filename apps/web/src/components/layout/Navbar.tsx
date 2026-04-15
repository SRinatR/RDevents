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
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (event: MouseEvent) => {
      if (mobileRef.current && !mobileRef.current.contains(event.target as Node)) {
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
    { href: `/${locale}/events`, label: t('nav.events') || 'Events' },
    ...(user ? [{ href: `/${locale}/cabinet`, label: t('nav.cabinet') || 'Cabinet' }] : []),
    ...(isAdmin ? [{ href: `/${locale}/admin`, label: t('nav.admin') || 'Admin' }] : []),
  ];

  const otherLocale = locale === 'en' ? 'ru' : 'en';
  const nextPath = switchLocalePath(pathname, locale, otherLocale);
  const displayName = user?.name || user?.email || '';

  return (
    <>
      <header className={`public-navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="container public-navbar-inner">
          <Link href={`/${locale}`} className="public-logo">
            <span className="public-logo-mark">EP</span>
            <span className="public-logo-text">EventPlatform</span>
          </Link>

          <nav className="public-nav-links">
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href} className={`public-nav-link ${isActive(href) ? 'active' : ''}`}>
                {label}
              </Link>
            ))}
          </nav>

          <div className="public-nav-actions">
            {user ? (
              <Link href={`/${locale}/cabinet`} className="public-user-chip">
                <span className="signal-avatar">{displayName.charAt(0).toUpperCase()}</span>
                <span className="public-user-name">{displayName}</span>
              </Link>
            ) : null}

            <Link href={nextPath} className="locale-switcher">{otherLocale.toUpperCase()}</Link>

            {user ? (
              <button onClick={handleLogout} className="btn btn-secondary btn-sm">{t('nav.logout') || 'Logout'}</button>
            ) : (
              <Link href={`/${locale}/login`} className="btn btn-primary btn-sm">{t('nav.login') || 'Login'}</Link>
            )}

            <button className="public-menu-trigger" onClick={() => setMobileOpen((value) => !value)} aria-label="Menu">
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <div ref={mobileRef} className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
        {navLinks.map(({ href, label }) => (
          <Link key={href} href={href} className={`mobile-link${isActive(href) ? ' active' : ''}`}>{label}</Link>
        ))}
        <div className="public-mobile-actions">
          {user ? (
            <button onClick={handleLogout} className="btn btn-secondary">{t('nav.logout') || 'Logout'}</button>
          ) : (
            <Link href={`/${locale}/login`} className="btn btn-primary" style={{ justifyContent: 'center' }}>{t('nav.login') || 'Login'}</Link>
          )}
          <Link href={nextPath} className="locale-switcher">{otherLocale.toUpperCase()}</Link>
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
