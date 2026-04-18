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

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
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
      <header className={`public-navbar public-shell-header ${scrolled ? 'scrolled' : ''}`} data-scrolled={scrolled ? 'true' : 'false'}>
        <div className="container public-navbar-inner">
          <Link href={`/${locale}`} className="public-logo">
            <img src="/site-logo.png" alt="Русский Дом" className="public-logo-mark public-logo-mark-nav" />
          </Link>

          <nav className="public-nav-links" aria-label={locale === 'ru' ? 'Основная навигация' : 'Primary navigation'}>
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href} className={`public-nav-link ${isActive(href) ? 'active' : ''}`} aria-current={isActive(href) ? 'page' : undefined}>
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

            <button className="public-menu-trigger" onClick={() => setMobileOpen((value) => !value)} aria-expanded={mobileOpen} aria-label="Menu">
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <button className={`mobile-menu-backdrop ${mobileOpen ? 'open' : ''}`} aria-hidden={!mobileOpen} tabIndex={-1} onClick={() => setMobileOpen(false)} />

      <div ref={mobileRef} className={`mobile-menu ${mobileOpen ? 'open' : ''}`} role="dialog" aria-modal="true">
        {navLinks.map(({ href, label }) => (
          <Link key={href} href={href} className={`mobile-link${isActive(href) ? ' active' : ''}`} aria-current={isActive(href) ? 'page' : undefined}>{label}</Link>
        ))}
        <div className="public-mobile-actions">
          {user ? (
            <button onClick={handleLogout} className="btn btn-secondary">{t('nav.logout') || 'Logout'}</button>
          ) : (
            <Link href={`/${locale}/login`} className="btn btn-primary btn-block-center">{t('nav.login') || 'Login'}</Link>
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
