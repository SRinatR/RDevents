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

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Close mobile menu on outside click
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
    { href: `/${locale}/events`, label: t('nav.events') },
    ...(user ? [{ href: `/${locale}/cabinet`, label: t('nav.cabinet') }] : []),
    ...(isAdmin ? [{ href: `/${locale}/admin`, label: t('nav.admin') }] : []),
  ];

  const otherLocale = locale === 'en' ? 'ru' : 'en';
  const nextPath = switchLocalePath(pathname, locale, otherLocale);

  return (
    <>
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="navbar-inner">
          {/* Logo */}
          <Link href={`/${locale}`} className="navbar-logo">
            <span className="navbar-logo-icon">✦</span>
            <span>EventPlatform</span>
          </Link>

          {/* Desktop nav */}
          <div className="navbar-nav">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`navbar-link${isActive(href) ? ' active' : ''}`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="navbar-actions">
            <Link href={nextPath} className="locale-switcher">
              {otherLocale.toUpperCase()}
            </Link>

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link href={`/${locale}/cabinet/profile`} className="user-chip">
                  <span className="avatar">
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt="" />
                      : user.name.charAt(0).toUpperCase()}
                  </span>
                  <span style={{ maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name}
                  </span>
                </Link>
                <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href={`/${locale}/login`} className="btn btn-ghost btn-sm">
                  {t('nav.login')}
                </Link>
                <Link href={`/${locale}/register`} className="btn btn-primary btn-sm">
                  {t('nav.register')}
                </Link>
              </div>
            )}

            {/* Burger */}
            <button
              className="burger"
              onClick={() => setMobileOpen(v => !v)}
              aria-label="Menu"
            >
              <span className="burger-line" style={mobileOpen ? { transform: 'rotate(45deg) translate(5px, 5px)' } : {}} />
              <span className="burger-line" style={mobileOpen ? { opacity: 0 } : {}} />
              <span className="burger-line" style={mobileOpen ? { transform: 'rotate(-45deg) translate(5px, -5px)' } : {}} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
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
            <Link href={`/${locale}/cabinet/profile`} className="mobile-link">
              👤 {user.name}
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
            <Link href={`/${locale}/login`} className="btn btn-secondary" style={{ justifyContent: 'center' }}>
              {t('nav.login')}
            </Link>
            <Link href={`/${locale}/register`} className="btn btn-primary" style={{ justifyContent: 'center' }}>
              {t('nav.register')}
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
