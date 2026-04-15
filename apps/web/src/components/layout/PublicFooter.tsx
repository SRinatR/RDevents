import Link from 'next/link';

export function PublicFooter({ locale }: { locale: string }) {
  return (
    <footer className="public-footer">
      <div className="container">
        <div className="public-footer-grid">
          <div>
            <div className="public-footer-brand">
              <span className="public-logo-mark">EP</span>
              <div>
                <div className="public-footer-title">EventPlatform</div>
                <div className="public-footer-subtitle">
                  {locale === 'ru' ? 'События, команды, операционное качество' : 'Events, teams, operational quality'}
                </div>
              </div>
            </div>
            <a href="mailto:support@eventplatform.local" className="btn btn-secondary btn-sm" style={{ marginTop: 14 }}>
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
            © 2026 EventPlatform. {locale === 'ru' ? 'Все права защищены.' : 'All rights reserved.'}
          </div>
          <div className="public-cookie-note">
            {locale === 'ru' ? 'Используя платформу, вы соглашаетесь с политикой cookie и privacy.' : 'Using this platform implies consent to cookie and privacy policy.'}
          </div>
        </div>
      </div>
    </footer>
  );
}
