# Event Platform MVP

Полнофункциональная платформа для управления мероприятиями с публичным сайтом, регистрацией, админ-панелью, командной механикой, волонтерами и аналитикой.

## 🏗 Архитектура

Проект построен как monorepo с использованием:
- **Frontend**: Next.js 16.2.3 + React 19 + next-intl (i18n)
- **Backend**: Express + TypeScript + Prisma ORM
- **Database**: PostgreSQL 17
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
- ✉️ Email/password регистрация и вход
- 🔐 JWT access/refresh tokens
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
- 🔐 Статистика по провайдерам авторизации

### Observability
- 📝 Структурированное логирование
- 🆔 Request ID для трассировки
- ❌ Безопасная обработка ошибок (без утечки stack traces)
- 🏥 Health и readiness endpoints

## 🚀 Быстрый старт

### Требования
- Node.js >= 22.12.0
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
```

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

### 4. Применение миграций и seed данных

```bash
# Генерация Prisma Client
pnpm db:generate

# Применение схемы к БД (для разработки используйте db:push)
pnpm db:push

# Наполнение тестовыми данными
pnpm db:seed
```

Seed создаст:
- **Super Admin**: admin@example.com / Admin123!
- **10 событий** (различные категории, solo и team-based)
- **6+ тестовых пользователей**
- Команды и memberships
- Заявки на волонтерство
- Event admin assignments
- Analytics events

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

## 🧪 Тестовые аккаунты

После выполнения `pnpm db:seed`:

| Email | Password | Role | Описание |
|-------|----------|------|----------|
| admin@example.com | Admin123! | SUPER_ADMIN | Полный доступ |
| alice@example.com | Alice123! | USER | Обычный пользователь, участник событий |
| bob@example.com | Bob123! | USER | Участник и капитан команды |
| carol@example.com | Carol123! | USER | Волонтер (одобренный) |
| dave@example.com | Dave123! | USER | Event admin (FITVIBE) |
| eve@example.com | Eve123! | USER | Волонтер (pending) |

## 📚 Основные команды

### База данных

```bash
pnpm db:generate    # Генерация Prisma Client
pnpm db:push        # Применение схемы к БД (dev)
pnpm db:migrate     # Создание и применение миграций (prod)
pnpm db:seed        # Наполнение тестовыми данными
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
- `POST /register` - Регистрация
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

### Требования для production
- PostgreSQL (managed или self-hosted)
- Node.js 22+
- Reverse proxy (nginx, caddy)

### Environment variables (production)

```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_ACCESS_SECRET=<strong-secret-min-32-chars>
JWT_REFRESH_SECRET=<different-strong-secret>
CORS_ORIGIN=https://yourdomain.com
```

### Сборка и запуск

```bash
# Установить зависимости
pnpm install --prod=false

# Собрать
pnpm build

# Применить миграции
pnpm db:migrate deploy

# Запустить (используйте process manager типа PM2)
cd apps/web && pnpm start    # Web
cd services/api && pnpm start # API
```

## 📝 Лицензия

Proprietary - Event Platform MVP

## 🤝 Поддержка

Для вопросов и проблем создавайте issue в репозитории.

---

**Event Platform MVP** • 2026
