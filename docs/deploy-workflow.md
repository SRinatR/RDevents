# Deployment Workflow

## Branch Strategy

### Branch Types

| Branch | Purpose | Direct Push | Merge |
|--------|---------|-------------|-------|
| `feature/*` | Разработка нового функционала | ✅ Разработчики | PR в `main` |
| `fix/*` | Исправление багов | ✅ Разработчики | PR в `main` |
| `hotfix/*` | Срочные исправления | ✅ Разработчики | PR в `main` |
| `main` | Интеграционная ветка | ❌ Запрещён | PR only |
| `production` | Production/Release | ❌ Запрещён | PR from `main` |

## CI/CD Flow

```
┌─────────────────┐     PR      ┌─────────────────┐
│  feature/*      │───────────▶│     main        │
│  fix/*          │             │   (CI only)     │
│  hotfix/*       │             │                 │
└─────────────────┘             └────────┬────────┘
                                         │ PR
                                         ▼
                                ┌─────────────────┐
                                │   production    │
                                │ (deploy only)   │
                                └─────────────────┘
```

## Workflows

### CI (`ci.yml`)

**Триггеры:**
- `push` в `main`
- `push` в `feature/*`, `fix/*`, `hotfix/*`
- `pull_request` в `main`

**Что делает:**
- TypeScript type checking (`pnpm typecheck`)
- Build всех пакетов (`pnpm build`)

**Что НЕ делает:**
- ❌ Не деплоит
- ❌ Не использует production secrets
- ❌ Не подключается к production серверу

### Production Deploy (`deploy-production.yml`)

**Триггеры:**
- `push` в `production`

**Что делает:**
1. Checkout кода
2. Build проекта
3. Pack в архив
4. Upload на production сервер
5. Deploy через Docker Compose
6. Smoke tests (API, Web, Health, Ready)

**Что НЕ делает:**
- ❌ Не запускается на PR
- ❌ Не запускается из `main` или feature-веток

## Release Process

### Шаг 1: Разработка

```bash
# Создаём feature-ветку
git checkout -b feature/my-feature

# Работаем, коммитим
git commit -m "Add my feature"

# Пушим
git push origin feature/my-feature
```

### Шаг 2: Pull Request в main

```bash
# Открываем PR через GitHub UI
# или gh CLI:
gh pr create --base main --head feature/my-feature
```

**На PR автоматически запускается CI:**
- Type check
- Build

### Шаг 3: Review и Merge в main

- PR требует минимум 1 approve
- Все CI checks должны быть зелёными
- После merge CI запускается на `main`

### Шаг 4: Pull Request в production

Когда код готов к релизу:

```bash
# Создаём PR main -> production
gh pr create --base production --head main
```

**Требования к PR в production:**
- Минимум 2 approves (строже чем в main)
- Может требовать approval через GitHub Environment

### Шаг 5: Deploy

После merge в `production`:
1. Автоматически запускается `deploy-production.yml`
2. Код деплоится на production сервер
3. Smoke tests проверяют работоспособность
4. При падении smoke tests — деплой считается неуспешным

## Branch Protection

### main

```
✅ Require pull request before merging
✅ Require 1 approval
✅ Require status checks to pass before merging:
   - Type check
   - Build
✅ Do not allow bypassing the above settings
✅ Do not allow force pushes
✅ Do not allow branch deletion
```

### production

```
✅ Require pull request before merging
✅ Require 2 approvals
✅ Require status checks to pass before merging: (none)
✅ Do not allow bypassing the above settings
✅ Do not allow force pushes
✅ Do not allow branch deletion
✅ Restrict who can push to matching branches (admins only)
```

## GitHub Environment

### production Environment

**Настройки:**
- Environment name: `production`
- Deployment branch policy: `production` only
- Required reviewers: 1 (опционально)
- Wait timer: 0 seconds

**Secrets для environment:**
- `PROD_HOST` — IP или домен production сервера
- `PROD_PORT` — SSH порт
- `PROD_USER` — SSH пользователь
- `PROD_SSH_KEY` — приватный SSH ключ
- `PROD_ENV_FILE` — содержимое .env файла

## Troubleshooting

### CI упал

1. Проверьте логи в GitHub Actions
2. Убедитесь что typecheck проходит локально: `pnpm typecheck`
3. Убедитесь что build проходит локально: `pnpm build`

### Deploy упал

1. Проверьте логи deploy workflow
2. Проверьте что production сервер доступен по SSH
3. Проверьте что secrets настроены в GitHub Environment
4. Посмотрите docker compose logs: `docker compose -f docker-compose.prod.yml logs`

### Smoke tests failed

Это означает что контейнеры не запустились корректно:
1. Проверьте логи контейнеров
2. Проверьте что .env файл корректный
3. Проверьте что DATABASE_URL указывает на существующую БД

## Быстрые команды

```bash
# Локальная проверка CI
pnpm typecheck && pnpm build

# Создание PR в main
gh pr create -B main

# Создание PR в production
gh pr create -B production
```

## Контакты

При проблемах с CI/CD обращаться к администраторам репозитория.
