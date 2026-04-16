import Link from 'next/link';

export function PublicFooter({ locale }: { locale: string }) {
  return (
    <footer className="public-footer public-shell-footer">
      <div className="container public-footer-shell-inner">
        <div className="public-footer-grid">
          <div>
            <div className="public-footer-brand">
              <img src="/logo.svg" alt="Русский Дом" width="32" height="32" className="public-logo-mark" />
              <div>
                <div className="public-footer-title">Русский Дом</div>
                <div className="public-footer-subtitle">
                  {locale === 'ru' ? 'Культура, образование, мероприятия' : 'Culture, education, events'}
                </div>
              </div>
            </div>
            <p className="public-footer-lead">
              {locale === 'ru'
                ? 'Единая продуктовая система для каталога событий, личного кабинета и админ-контроля.'
                : 'One product system for event discovery, participant workspace, and admin control.'}
            </p>
            <a href="mailto:support@russkiydom.local" className="btn btn-secondary btn-sm public-footer-feedback">
              {locale === 'ru' ? 'Обратная связь' : 'Feedback'}
            </a>
          </div>

          <div className="public-footer-links">
            <div>
              <h4>{locale === 'ru' ? 'Платформа' : 'Platform'}</h4>
              <Link href={`/${locale}/events`}>{locale === 'ru' ? 'Мероприятия' : 'Events'}</Link>
              <Link href={`/${locale}/register`}>{locale === 'ru' ? 'Регистрация' : 'Register'}</Link>
              <Link href={`/${locale}/login`}>{locale === 'ru' ? 'Вход' : 'Login'}</Link>
            </div>
            <div>
              <h4>{locale === 'ru' ? 'Кабинеты' : 'Workspaces'}</h4>
              <Link href={`/${locale}/cabinet`}>{locale === 'ru' ? 'Кабинет' : 'Cabinet'}</Link>
              <Link href={`/${locale}/admin`}>{locale === 'ru' ? 'Администрирование' : 'Admin'}</Link>
              <Link href="/doc/privacy-policy-ru.pdf" target="_blank">{locale === 'ru' ? 'Политика конфиденциальности' : 'Privacy Policy'}</Link>
            </div>
          </div>
        </div>

        <div className="public-footer-bottom">
          <div>
            © 2026 Русский Дом. {locale === 'ru' ? 'Все права защищены.' : 'All rights reserved.'}
          </div>
          <div className="public-cookie-note">
            {locale === 'ru' ? 'Используя платформу, вы соглашаетесь с политикой cookie и privacy.' : 'Using this platform implies consent to cookie and privacy policy.'}
          </div>
        </div>
      </div>
    </footer>
  );
}
