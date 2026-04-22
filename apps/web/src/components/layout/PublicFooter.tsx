import Image from 'next/image';
import Link from 'next/link';
import { FeedbackButton } from './FeedbackButton';

export function PublicFooter({ locale }: { locale: string }) {
  return (
    <footer className="public-footer public-shell-footer">
      <div className="container public-footer-shell-inner">
        <div className="public-footer-grid">
          <div>
            <div className="public-footer-brand">
              <Image src="/site-logo.png" alt="Русский Дом" width={100} height={34} className="public-logo-mark public-logo-mark-footer" />
            </div>
            <FeedbackButton locale={locale} />
          </div>

          <div className="public-footer-links">
            <div>
              <h4>{locale === 'ru' ? 'Навигация' : 'Navigation'}</h4>
              <Link href={`/${locale}/events`}>{locale === 'ru' ? 'Мероприятия' : 'Events'}</Link>
              <Link href={`/${locale}/login`}>{locale === 'ru' ? 'Вход' : 'Login'}</Link>
              <Link href={`/${locale}/privacy-policy`}>{locale === 'ru' ? 'Политика конфиденциальности' : 'Privacy Policy'}</Link>
            </div>
          </div>
        </div>

        <div className="public-footer-bottom">
          <div>
            © 2026 Русский Дом. {locale === 'ru' ? 'Все права защищены.' : 'All rights reserved.'}
          </div>
        </div>
      </div>
    </footer>
  );
}
