# Event Platform MVP

Полнофункциональная платформа для управления мероприятиями с публичным сайтом, регистрацией, админ-панелью, командной механикой, волонтерами и аналитикой.

## 🏗 Архитектура

Проект построен как monorepo с использованием:
- **Frontend**: Next.js 16.2.4 + React 19 + next-intl (i18n)
- **Backend**: Express + TypeScript + Prisma ORM
- **Database**: PostgreSQL 17
- **Runtime**: Node.js 25.6+
- **Package Manager**: pnpm 10.33+
- **Monorepo**: Turbo 2.9.6

```
event-platform-mvp/
├── apps/web/              # Next.js frontend application
├── services/api/          # Express backend API
├── packages/
│   ├── ui/               # Shared UI components
│   └── shared/           # Shared types and utilities
├── infra/                # Infrastructure configs (nginx, etc)
└── docs/                 # Documentation
```

## ✨ Основные возможности

### Публичная часть
- 🏠 Главная страница с hero, features, популярными событиями
- 🎪 Каталог событий с поиском, фильтрами и пагинацией
- 📄 Детальные страницы событий
- 🌐 Поддержка русского и английского языков

### Аутентификация
- ✉️ Трехшаговая email-регистрация: email -> код подтверждения -> пароль
- � Отправка кода через Resend
- �🔐 JWT access/refresh tokens
- 🔒 Защищенные маршруты
- 👤 Управление профилем

### Пользовательский кабинет
- 📋 Мои события (участник/волонтер/админ)
- 👥 Мои команды
- ⚙️ Редактирование профиля
- 📊 Статистика участия

### Командная механика
- ➕ Создание команд для командных событий
- 🔗 Вступление в команду (открытое/по коду/по запросу)
- 👑 Роль капитана команды
- ✅ Одобрение/отклонение заявок на вступление
- 🚪 Выход из команды

### Волонтерство
- 📝 Подача заявки на волонтерство
- ⏳ Отслеживание статуса заявки
- ✔️ Одобрение/отклонение заявок админами

### Админ-панель
- 🎯 Двухуровневая ролевая модель:
  - Platform-level: USER, PLATFORM_ADMIN, SUPER_ADMIN
  - Event-level: PARTICIPANT, VOLUNTEER, EVENT_ADMIN
- 🎪 Управление событиями (CRUD)
- 👥 Управление участниками и командами
- 🙋 Обработка заявок на волонтерство
- 👨‍💼 Назначение event-admin для конкретных событий
- 📊 Аналитика и отчеты

### Аналитика
- 📈 Трекинг ключевых действий пользователей
- 📊 Агрегированные метрики
- 🔝 Топ событий по просмотрам и регистрациям
- 📉 Конверсия просмотров в регистрации
- 🔐 Статистика и аналитика по провайдерам авторизации

### Observability
- 📝 Структурированное логирование
- 🆔 Request ID для трассировки
- ❌ Безопасная обработка ошибок (без утечки stack traces)
- 🏥 Health и readiness endpoints

## 🚀 Быстрый старт

### Требования
- Node.js >= 25.6.0 (`.nvmrc` и `.node-version` зафиксированы на 25.6.0)
- pnpm >= 10.33.0
- PostgreSQL 17 (локально или через Docker)

### 1. Установка зависимостей

```bash
pnpm install
```

### 2. Настройка переменных окружения

```bash
# Скопируйте example файл
cp .env.example services/api/.env

# Отредактируйте services/api/.env и установите:
# - DATABASE_URL (строка подключения к PostgreSQL)
# - JWT_ACCESS_SECRET (минимум 32 символа)
# - JWT_REFRESH_SECRET (минимум 32 символа)
# - CORS_ORIGIN (URL фронтенда, обычно http://localhost:3000)
# - RESEND_API_KEY / RESEND_FROM_EMAIL для писем регистрации
```

Для production переменные нужно обновлять в GitHub secret `PROD_ENV_FILE`, потому что деплой перезаписывает `/opt/rdevents/.env`.

#### DATABASE_URL contract

Внутри Docker Compose сети production и container-smoke PostgreSQL доступен по hostname `postgres`, а не `127.0.0.1` или `localhost`. Runner-based CI jobs не используют compose-network hostname как доказательство production topology.

**Development / local:**
```env
DATABASE_URL=postgresql://event_platform_user:event_platform_password@localhost:5432/event_platform?schema=public
```

**Production / Docker Compose:**
```env
DATABASE_URL=postgresql://event_platform_user:event_platform_password@postgres:5432/event_platform?schema=public
```

**Production .env contract:**

| Переменная | Значение |
|------------|----------|
| `POSTGRES_DB` | `event_platform` |
| `POSTGRES_USER` | `event_platform_user` |
| `POSTGRES_PASSWORD` | `<secret>` |
| `DATABASE_URL` | `postgresql://event_platform_user:<password>@postgres:5432/event_platform?schema=public` |

`DATABASE_URL` используется **только** внутри compose-сети. Внешний доступ к БД не влияет на runtime URL.

**CI note:**
- `container-smoke` intentionally mirrors production docker-compose topology and uses `@postgres:5432`
- runner-based jobs (`typecheck`, `test`, `build`) do not prove compose-network reachability and may use runner-local DB wiring / placeholder DATABASE_URL values

### 3. Настройка базы данных

#### Вариант A: PostgreSQL через Docker Compose

```bash
# Поднять только PostgreSQL
docker compose up -d postgres

# Проверить что БД запустилась
docker compose ps
```

#### Вариант B: Локальный PostgreSQL

Убедитесь что PostgreSQL запущен и создайте базу данных:

```sql
CREATE DATABASE event_platform;
CREATE USER event_platform_user WITH PASSWORD 'event_platform_password';
GRANT ALL PRIVILEGES ON DATABASE event_platform TO event_platform_user;
```

### 4. Применение миграций и локальных seed данных

```bash
# Генерация Prisma Client
pnpm db:generate

# Применение схемы к БД (для разработки используйте db:push)
pnpm db:push

# Наполнение локальной БД мок-пользователями, демо-событием и справочниками
pnpm db:seed
```

Seed предназначен только для локальной разработки. В `NODE_ENV=production`
он отказывается запускаться.

Локальный seed создаст:
- **Super Admin**: admin@example.com / admin123
- **Platform Admin**: platform@example.com / platform123
- **Event Admin**: organizer@example.com / organizer123
- демо-пользователей для регистраций, статусов, social auth и аналитики
- демо-событие `dom-gde-zhivet-rossiya`

### 5. Запуск в режиме разработки

```bash
# Запустить API и Web одновременно
pnpm dev

# Или по отдельности:
pnpm dev:api   # API на http://localhost:4000
pnpm dev:web   # Web на http://localhost:3000
```

Приложение будет доступно на:
- 🌐 Frontend: http://localhost:3000
- 🔌 API: http://localhost:4000
- 🏥 Health: http://localhost:4000/health
- ✅ Ready: http://localhost:4000/ready

## 🐳 Docker Compose (полный стек)

Запуск всего стека (PostgreSQL + API + Web) в контейнерах:

```bash
# Билд и запуск
docker compose up -d

# Просмотр логов
docker compose logs -f

# Остановка
docker compose down
```

## 🧹 Очистка мок-данных в production

Production deploy после миграций запускает `pnpm db:cleanup-mock`: старые
`demo/example` аккаунты и seeded event `dom-gde-zhivet-rossiya` удаляются, а
`rinat200355@gmail.com` переводится в `SUPER_ADMIN`.

Ручной запуск для production:

```bash
NODE_ENV=production SUPER_ADMIN_EMAIL=rinat200355@gmail.com pnpm db:cleanup-mock
```

Команда не создаёт пользователя: аккаунт должен уже существовать. В локальной
среде она специально не запускается без `ALLOW_NON_PROD_MOCK_CLEANUP=true`.
Если нужно удалить дополнительные старые демо-события в production, передайте
их slug через `CLEANUP_MOCK_EVENT_SLUGS`:

```bash
NODE_ENV=production CLEANUP_MOCK_EVENT_SLUGS=old-demo-event pnpm db:cleanup-mock
```

Если seeded event нужно временно оставить в production, можно явно отключить
default event cleanup:

```bash
NODE_ENV=production CLEANUP_DEFAULT_MOCK_EVENTS=false pnpm db:cleanup-mock
```

## 📚 Основные команды

### База данных

```bash
pnpm db:generate    # Генерация Prisma Client
pnpm db:push        # Применение схемы к БД (dev)
pnpm db:migrate     # Создание и применение миграций (prod)
pnpm db:seed        # Наполнение локальной БД мок/seed данными
pnpm db:cleanup-mock # Production-only очистка старых demo/example аккаунтов
pnpm db:studio      # Открыть Prisma Studio (GUI для БД)
```

### Разработка

```bash
pnpm dev            # Запустить API + Web
pnpm dev:api        # Только API
pnpm dev:web        # Только Web
```

### Сборка

```bash
pnpm build          # Собрать все проекты
pnpm build:api      # Только API
pnpm build:web      # Только Web
```

### Качество кода

```bash
pnpm typecheck      # TypeScript проверка
pnpm lint           # Линтинг
```

### Docker

```bash
pnpm docker:up      # docker compose up -d
pnpm docker:down    # docker compose down
pnpm docker:logs    # docker compose logs -f
```

## 🗂 Структура API

### Аутентификация (`/api/auth`)
- `POST /register/start` - Отправить код подтверждения на email
- `POST /register/verify` - Подтвердить код из email
- `POST /register/complete` - Завершить регистрацию и задать пароль
- `POST /login` - Вход
- `POST /logout` - Выход
- `POST /refresh` - Обновление access token
- `GET /me` - Текущий пользователь
- `PATCH /profile` - Обновление профиля

### События (`/api/events`)
- `GET /` - Список событий
- `GET /:slug` - Детали события
- `POST /:id/register` - Регистрация на событие
- `POST /:id/volunteer/apply` - Заявка на волонтерство
- `GET /:id/teams` - Команды события
- `POST /:id/teams` - Создать команду
- `POST /:id/teams/:teamId/join` - Вступить в команду
- `PATCH /:id/teams/:teamId` - Обновить команду (капитан)
- `POST /:id/teams/:teamId/leave` - Покинуть команду
- `POST /:id/teams/:teamId/members/:userId/approve` - Одобрить участника
- `POST /:id/teams/:teamId/members/:userId/reject` - Отклонить участника
- `DELETE /:id/teams/:teamId/members/:userId` - Удалить участника

### Админка (`/api/admin`)
- `GET /events` - Управляемые события
- `POST /events` - Создать событие (SUPER_ADMIN)
- `PATCH /events/:id` - Обновить событие
- `DELETE /events/:id` - Удалить событие (SUPER_ADMIN)
- `GET /events/:id/participants` - Участники
- `GET /events/:id/teams` - Команды
- `GET /events/:id/volunteers` - Волонтеры
- `PATCH /events/:id/volunteers/:memberId` - Одобрить/отклонить волонтера
- `GET /events/:id/event-admins` - Event admins
- `POST /events/:id/event-admins` - Назначить event admin (SUPER_ADMIN)
- `DELETE /events/:id/event-admins/:userId` - Удалить event admin (SUPER_ADMIN)
- `GET /users` - Пользователи (PLATFORM_ADMIN)
- `PATCH /users/:id/role` - Изменить роль (SUPER_ADMIN)
- `GET /admins` - Платформенные админы (SUPER_ADMIN)
- `GET /volunteers` - Все волонтеры (PLATFORM_ADMIN)
- `GET /analytics` - Глобальная аналитика (PLATFORM_ADMIN)

### Аналитика (`/api/analytics`)
- `POST /track` - Трекинг события
- `GET /summary` - Публичная статистика

## 🎨 UI/UX Features

- ✨ Современный premium-дизайн с indigo/violet акцентами
- 📱 Полностью адаптивный интерфейс
- 🎭 Loading/empty/error states
- 🎬 Плавные анимации и transitions
- ♿ Accessibility (focus states, ARIA labels)
- 🌍 Интернационализация (ru/en)
- 🍞 Toast notifications
- 🎯 Form validation с понятными сообщениями

## 🔐 Ролевая модель

### Platform-level роли (User.role)
- **USER**: Обычный зарегистрированный пользователь
- **PLATFORM_ADMIN**: Админ платформы (опционально)
- **SUPER_ADMIN**: Полный контроль платформы

### Event-scoped роли (EventMember.role)
- **PARTICIPANT**: Зарегистрирован на событие
- **VOLUNTEER**: Волонтер события
- **EVENT_ADMIN**: Администратор конкретного события

**Важно**: Один и тот же пользователь может иметь разные роли в разных событиях!

## 📊 Аналитика

Отслеживаемые события:
- `HOME_VIEW` - Просмотр главной
- `EVENTS_LIST_VIEW` - Просмотр каталога
- `EVENT_DETAIL_VIEW` - Просмотр события
- `REGISTER_CLICK` - Клик на регистрацию
- `EVENT_REGISTRATION` - Регистрация на событие
- `USER_REGISTER` - Регистрация пользователя
- `USER_LOGIN` - Вход пользователя
- `PROVIDER_USED` - Использован провайдер

## 🛠 Разработка

### Структура пакетов

- `@event-platform/web` - Next.js приложение
- `@event-platform/api` - Express API
- `@event-platform/ui` - Shared UI компоненты
- `@event-platform/shared` - Shared types, constants, contracts

### Добавление новой страницы

```typescript
// apps/web/src/app/[locale]/new-page/page.tsx
import { getTranslations } from 'next-intl/server';

export default async function NewPage() {
  const t = await getTranslations();
  return <div>{t('newPage.title')}</div>;
}
```

### Добавление нового API endpoint

```typescript
// services/api/src/modules/example/example.router.ts
import { Router } from 'express';
import { authenticate } from '../../common/middleware.js';

export const exampleRouter = Router();

exampleRouter.get('/', authenticate, async (req, res) => {
  res.json({ message: 'Example' });
});
```

## 🐛 Отладка

### Просмотр логов

```bash
# API логи
pnpm dev:api

# Посмотреть структурированные логи
tail -f services/api/logs/*.log
```

### Prisma Studio

```bash
pnpm db:studio
# Откроется GUI на http://localhost:5555
```

### Database queries

```bash
# Подключиться к PostgreSQL
docker compose exec postgres psql -U event_platform_user -d event_platform

# Или локально
psql -U event_platform_user -d event_platform
```

## 🚢 Деплой

> Подробная документация по CI/CD и процессу деплоя: [docs/deploy-workflow.md](docs/deploy-workflow.md)

### Краткая схема

```
feature/* → PR → main → PR → production → deploy
```

### Branch Strategy

| Branch | Назначение | Merge |
|--------|------------|-------|
| `feature/*`, `fix/*`, `hotfix/*` | Рабочие ветки | PR в `main` |
| `main` | Интеграция | Только PR |
| `production` | Production | PR из `main` |

### CI/CD Workflows

CI workflow (`.github/workflows/ci.yml`) включает следующие jobs:

| Job | Назначение |
|-----|------------|
| `Lint` | ESLint проверка кода |
| `Shell validation` | Валидация синтаксиса shell-скриптов (`bash -n`) |
| `Typecheck` | TypeScript проверка типов |
| `Test` | Unit тесты с PostgreSQL сервисом |
| `Build` | Сборка всех проектов (API + Web) |
| `Docker Build` | Сборка production Docker образов (api, web) |
| `Container Smoke` | Запуск контейнеров и проверка runtime contract внутри compose-сети |

**Required checks** для protected branches:

- `Lint`
- `Shell validation`
- `Typecheck`
- `Test`
- `Build`
- `Docker Build`
- `Container Smoke`
- `Required Checks` (aggregator, подтверждает успех всех перечисленных выше)

**Запуск CI:** PR в `main`/`production`, push в `main`/`feature/**`/`fix/**`/`hotfix/**`, `workflow_dispatch`

Deploy workflow (`.github/workflows/deploy-production.yml`): только production deploy, триггер — push в `production` или `workflow_dispatch` с ref `production`. Production secrets не используются в CI.

### Branch Protection

Recommended configuration — repository settings must be configured so that:

| Branch | Merge | Required checks | Bypass |
|--------|-------|-----------------|--------|
| `main` | PR only | `Lint`, `Shell validation`, `Typecheck`, `Test`, `Build`, `Docker Build`, `Container Smoke`, `Required Checks` | owner/admin bypass for emergency |
| `production` | PR from `main` | `Lint`, `Shell validation`, `Typecheck`, `Test`, `Build`, `Docker Build`, `Container Smoke`, `Required Checks` + environment approval | owner/admin bypass for emergency release |

The `Required Checks` aggregator job is included in required checks and confirms all individual jobs passed.

### Secrets для production

Secrets настраиваются в GitHub → Settings → Environments → production:
- `PROD_HOST`, `PROD_PORT`, `PROD_USER`
- `PROD_SSH_KEY`, `PROD_ENV_FILE`

### Локальная сборка (manual deploy)

```bash
pnpm install --prod=false
pnpm build
pnpm db:migrate deploy
```

## 🏭 Production Release Operations

### Расположение артефактов на сервере

| Файл | Путь | Описание |
|------|------|----------|
| `deploy-state.json` | `/opt/rdevents/runtime/deploy-state.json` | Текущий stage/state развертывания |
| `.release-commit` | `/opt/rdevents/app/.release-commit` | Задеплоенный commit SHA |
| Deploy logs | `/opt/rdevents/deploy-logs/` | Логи каждого deploy |
| Backup DB | `/opt/rdevents/backups/` | Резервные копии БД (pre-migrate) |

### Статусы в `deploy-state.json`

```json
{
  "releaseSha": "ad2459585ab33709e7b66d0bc036e2010dd4cd52",
  "status": "success",
  "stage": "success",
  "ts": "2026-04-24T11:30:00.000Z"
}
```

Возможные значения `stage`:
- `init`, `build-images`, `capture-built-image-ids`
- `migrate`, `recreate-api-web`, `wait-api-healthy`, `wait-web-healthy`
- `verify-running-image-ids`, `local-verification`, `sync-runtime-fallback`
- `reload-nginx`, `public-verification`, `finalize-success`
- `success` или `failed`

### Проверка проде после merge

Canonical smoke test:

```bash
ssh <user>@<host> "bash" < scripts/ops/prod-smoke.sh <sha>
```

Или без проверки SHA (только connectivity):

```bash
ssh <user>@<host> "bash" < scripts/ops/prod-smoke.sh
```

### Ручной force switch (аварийный recovery)

Если images уже собраны, но контейнеры старые:

```bash
ssh <user>@<host>
cd /opt/rdevents/app
bash ./scripts/ops/prod-force-switch-latest.sh <sha>
```

Это выполнит:
1. `prisma migrate deploy`
2. `docker compose up -d --force-recreate --remove-orphans api web`
3. Финальную проверку `/release.json`

### GitHub Actions post-deploy summary

После успешного deploy в GitHub Actions run видно:
- `deploy-state.json` (final stage/state)
- `.release-commit` (задеплоенный SHA)
- Running image IDs контейнеров
- Public release JSON с обоих endpoints


## 📝 Лицензия

Proprietary - Event Platform MVP

## 🤝 Поддержка

Для вопросов и проблем создавайте issue в репозитории.

---

**Event Platform MVP** • 2026
