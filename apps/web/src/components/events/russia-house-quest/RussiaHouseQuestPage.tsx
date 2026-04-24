'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { analyticsApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { PublicFooter } from '@/components/layout/PublicFooter';
import {
  QUEST_NAV_ITEMS,
  QUEST_HIGHLIGHTS,
  QUEST_STATS,
  QUEST_STATIONS,
  QUEST_TIMELINE,
  QUEST_GALLERY_ITEMS,
  QUEST_FAQ_ITEMS,
} from './russiaHouseQuest.config';

interface RussiaHouseQuestPageProps {
  event: {
    id: string;
    slug: string;
    title: string;
    shortDescription: string;
    fullDescription: string | null;
    location: string;
    startsAt: string;
    endsAt: string;
    coverImageUrl: string | null;
    capacity: number;
    registrationsCount: number;
    registrationEnabled?: boolean;
    registrationOpensAt?: string | null;
    registrationDeadline?: string | null;
    requireParticipantApproval?: boolean;
    contactEmail?: string | null;
    memberships?: Array<{ role: string; status: string }>;
  };
  locale: string;
  user: { id: string; name?: string | null; email?: string | null } | null;
  onApply: () => void;
  onCopyLink: () => void;
  copied: boolean;
}

function QuestBadge({ children, inverted = false }: { children: ReactNode; inverted?: boolean }) {
  return (
    <span className={`rhq-badge${inverted ? ' rhq-badge-inverted' : ''}`}>
      <span aria-hidden="true">+</span>
      {children}
    </span>
  );
}

function QuestSectionHeader({
  eyebrow,
  title,
  copy,
  inverted = false,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  inverted?: boolean;
}) {
  return (
    <div className={`rhq-section-heading${inverted ? ' rhq-section-heading-inverted' : ''}`}>
      <QuestBadge inverted={inverted}>{eyebrow}</QuestBadge>
      <h2>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </div>
  );
}

export function RussiaHouseQuestPage({
  event,
  locale,
  user,
  onApply,
  onCopyLink,
  copied,
}: RussiaHouseQuestPageProps) {
  const heroImage = event.coverImageUrl || '/dom-gde-zhivet-rossiya.jpg';
  const descriptionParts = String(event.fullDescription ?? '').split(/\n{2,}/).filter(Boolean);

  const isFull = event.registrationsCount >= event.capacity;
  const registrationEnabled = event.registrationEnabled !== false;
  const registrationNotOpen = event.registrationOpensAt
    ? new Date(event.registrationOpensAt).getTime() > Date.now()
    : false;
  const registrationExpired = event.registrationDeadline
    ? new Date(event.registrationDeadline).getTime() < Date.now()
    : false;
  const registrationBlocked =
    !registrationEnabled || registrationNotOpen || registrationExpired || isFull;

  const eventDateRange =
    locale === 'ru' ? 'воскресенье, 3 мая 2026 г. · 10:30 – 15:30' : 'Sunday, May 3, 2026 · 10:30 – 15:30';

  return (
    <div className="public-page-shell route-shell route-event-detail route-russia-house-quest">
      <main className="rhq-page">
        <section className="rhq-hero" id="top">
          <Image
            className="rhq-hero-image"
            src={heroImage}
            alt={event.title}
            fill
            sizes="100vw"
            style={{ objectFit: 'cover' }}
            priority
          />
          <div className="rhq-hero-overlay" />
          <div className="rhq-container rhq-hero-inner">
            <div className="rhq-hero-copy">
              <QuestBadge inverted>25 лет Русскому дому в Ташкенте</QuestBadge>
              <h1>{event.title}</h1>
              <p>{event.shortDescription}</p>
              <div className="rhq-hero-actions">
                <button onClick={onApply} className="rhq-button rhq-button-primary">
                  {locale === 'ru' ? 'Перейти в личный кабинет' : 'Open cabinet'}
                </button>
                <a href="#program" className="rhq-button rhq-button-secondary">
                  {locale === 'ru' ? 'Смотреть программу' : 'View program'}
                </a>
              </div>
            </div>

            <div className="rhq-hero-facts" aria-label="Ключевая информация">
              <article>
                <span>Дата и время</span>
                <strong>{eventDateRange}</strong>
              </article>
              <article>
                <span>Локация</span>
                <strong>{event.location}</strong>
              </article>
              <article>
                <span>Формат</span>
                <strong>Командный маршрут</strong>
              </article>
              <article>
                <span>Регистрация</span>
                <strong>{registrationBlocked ? 'Закрыта' : 'Открыта'}</strong>
              </article>
            </div>
          </div>
        </section>

        <nav className="rhq-subnav" aria-label="Навигация по событию">
          <div className="rhq-container rhq-subnav-inner">
            {QUEST_NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <section className="rhq-section rhq-intro" id="about">
          <div className="rhq-container rhq-intro-grid">
            <div>
              <QuestSectionHeader
                eyebrow="О событии"
                title="Путешествие по дому, языку и традициям"
                copy="Юбилейный квест собирает участников в общий маршрут по пространствам Русского дома. Каждая станция раскрывает отдельную грань культуры, а финал превращает прохождение в общий праздник."
              />
              <div className="rhq-copy">
                {descriptionParts.map((part) => (
                  <p key={part}>{part}</p>
                ))}
              </div>
            </div>
            <div className="rhq-highlight-list">
              {QUEST_HIGHLIGHTS.map((item) => (
                <article key={item}>
                  <span aria-hidden="true">✓</span>
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rhq-stats-band" aria-label="Цифры мероприятия">
          <div className="rhq-container rhq-stats-grid">
            {QUEST_STATS.map((item) => (
              <article key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="rhq-section" id="stations">
          <div className="rhq-container">
            <QuestSectionHeader
              eyebrow="Станции квеста"
              title="Шесть пространств одного маршрута"
              copy="Команды проходят путь от живого слова до русского характера, собирая отметки в «Паспорт гостя Русского дома»."
            />
            <div className="rhq-stations-grid">
              {QUEST_STATIONS.map((station) => (
                <article className="rhq-station-card" key={station.title}>
                  <span className="rhq-station-mark">{station.mark}</span>
                  <h3>{station.title}</h3>
                  <p>{station.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rhq-section rhq-program-section" id="program">
          <div className="rhq-container rhq-program-panel">
            <div className="rhq-program-heading">
              <QuestSectionHeader
                eyebrow="Программа дня"
                title="От регистрации до праздничного финала"
                copy="Маршрут рассчитан на живое участие команд, торжественное открытие, прохождение станций и общую церемонию награждения."
                inverted
              />
            </div>
            <div className="rhq-timeline">
              {QUEST_TIMELINE.map((item) => (
                <article key={`${item.time}-${item.title}`}>
                  <time>{item.time}</time>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.place}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rhq-section rhq-venue-section" id="venue">
          <div className="rhq-container rhq-venue-grid">
            <article>
              <QuestSectionHeader eyebrow="Дата и место" title="Центральный Парк имени Мирзо Улугбека" />
              <dl>
                <div>
                  <dt>Когда</dt>
                  <dd>{eventDateRange}</dd>
                </div>
                <div>
                  <dt>Где</dt>
                  <dd>{event.location}</dd>
                </div>
                <div>
                  <dt>Карта для участников</dt>
                  <dd>
                    <a href="https://yandex.ru/maps/-/CPCiyWNG" target="_blank" rel="noreferrer">
                      Открыть маршрут в Яндекс Картах
                    </a>
                  </dd>
                </div>
              </dl>
            </article>
            <article>
              <QuestSectionHeader eyebrow="Формат участия" title="Командная игра с финальным маршрутом" />
              <p>Участники проходят станции в командах, выполняют задания, получают отметки и приходят к общему финалу.</p>
              <p>
                <strong>Важное правило: команда ровно из 5 человек</strong>
              </p>
            </article>
          </div>
        </section>

        <section className="rhq-section rhq-registration-section" id="registration">
          <div className="rhq-container rhq-registration-grid">
            <div>
              <QuestSectionHeader
                eyebrow="Участие"
                title="Участие в мероприятии"
                copy="Подайте заявку в личном кабинете. После входа система откроет страницу этого мероприятия и сохранит ваш прогресс."
              />
              <div className="rhq-registration-notes">
                <article>
                  <strong>60+</strong>
                  <span>участников</span>
                </article>
              </div>
            </div>
            <div className="rhq-registration-card">
              <button onClick={onApply} className="rhq-button rhq-button-primary">
                {locale === 'ru' ? 'Перейти в личный кабинет' : 'Open cabinet'}
              </button>
              <button onClick={onCopyLink} className="rhq-button rhq-button-secondary rhq-share-button">
                {copied
                  ? locale === 'ru'
                    ? 'Ссылка скопирована'
                    : 'Link copied'
                  : locale === 'ru'
                    ? 'Поделиться событием'
                    : 'Share event'}
              </button>
            </div>
          </div>
        </section>

        <section className="rhq-section" id="gallery">
          <div className="rhq-container">
            <QuestSectionHeader
              eyebrow="Галерея"
              title="Юбилейный образ проекта"
              copy="Здесь собраны визуальные акценты мероприятия: афиша, тематические станции и праздничный финал."
            />
            <div className="rhq-gallery-grid">
              {QUEST_GALLERY_ITEMS.map((item, index) => (
                <article className="rhq-gallery-card" key={item.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{item.title}</h3>
                  <p>{item.subtitle}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rhq-section rhq-contacts-section" id="contacts">
          <div className="rhq-container rhq-contacts-grid">
            <article className="rhq-contact-card">
              <QuestSectionHeader eyebrow="Контакты" title="Связаться с оргкомитетом" inverted />
              <p>
                По вопросам участия, регистрации, команд и партнёрского взаимодействия напишите
                организаторам мероприятия.
              </p>
              <a href={`mailto:${event.contactEmail ?? 'Uzb@vsezapobedu.com'}`}>
                {event.contactEmail ?? 'Uzb@vsezapobedu.com'}
              </a>
              <a href="https://t.me/SergeyEzhkov" target="_blank" rel="noopener noreferrer">
                @SergeyEzhkov
              </a>
            </article>
            <div className="rhq-faq-list">
              <QuestSectionHeader eyebrow="FAQ" title="Часто задаваемые вопросы" />
              {QUEST_FAQ_ITEMS.map((item, index) => (
                <details key={item.question} open={index === 0}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter locale={locale} />
    </div>
  );
}
