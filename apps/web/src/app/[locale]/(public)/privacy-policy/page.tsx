import { getMessages } from 'next-intl/server';
import { PublicFooter } from '@/components/layout/PublicFooter';

type PrivacySection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  subsections?: Array<{
    title: string;
    paragraphs?: string[];
    bullets?: string[];
  }>;
};

type PrivacyMessages = {
  title: string;
  effectiveDateLabel: string;
  operatorLabel: string;
  contactEmailLabel: string;
  quickNavTitle: string;
  sections: PrivacySection[];
};

type PrivacyPolicyPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export default async function PrivacyPolicyPage({ params }: PrivacyPolicyPageProps) {
  const { locale } = await params;
  const messages = await getMessages();
  const privacy = (messages as { privacy: PrivacyMessages }).privacy;

  return (
    <div className="public-page-shell route-shell route-privacy-policy">
      <main className="public-main privacy-main">
        <div className="privacy-shell">
          <aside className="privacy-rail" aria-label={privacy.quickNavTitle}>
            <div className="privacy-rail-inner">
              <h2>{privacy.quickNavTitle}</h2>
              <ol>
                {privacy.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>{section.title}</a>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          <div className="privacy-pane">
            <header className="privacy-header">
              <h1>{privacy.title}</h1>

              <dl className="privacy-meta-grid">
                <div>
                  <dt>{privacy.effectiveDateLabel}</dt>
                  <dd>19.04.2026</dd>
                </div>
                <div>
                  <dt>{privacy.operatorLabel}</dt>
                  <dd>Сергей Ежков</dd>
                </div>
                <div>
                  <dt>{privacy.contactEmailLabel}</dt>
                  <dd>Uzb@vsezapobedu.com</dd>
                </div>
              </dl>
            </header>

            <article className="privacy-content">
              {privacy.sections.map((section) => (
                <section key={section.id} id={section.id} className="privacy-section">
                  <h2>{section.title}</h2>

                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}

                  {section.bullets && section.bullets.length > 0 ? (
                    <ul>
                      {section.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}

                  {section.subsections?.map((subsection) => (
                    <div key={subsection.title} className="privacy-subsection">
                      <h3>{subsection.title}</h3>

                      {subsection.paragraphs?.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}

                      {subsection.bullets && subsection.bullets.length > 0 ? (
                        <ul>
                          {subsection.bullets.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </section>
              ))}
            </article>
          </div>
        </div>
      </main>

      <PublicFooter locale={locale} />
    </div>
  );
}
