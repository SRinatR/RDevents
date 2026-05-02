# Production Change Policy (RDevents)

> Статус: **обязательная policy** для всех изменений, которые могут повлиять на production.

## 1) Цель

Эта policy фиксирует безопасный процесс поставки изменений в production: минимальный blast radius, обязательный rollback-first подход, предсказуемые go/no-go критерии и координация при параллельной работе нескольких инженеров.

С policy нужно применять вместе с текущим workflow деплоя в `docs/deploy-workflow.md`.

## 2) Область действия

Policy применяется к любому изменению, которое затрагивает хотя бы один пункт:

- API/runtime поведение (`services/api`),
- web runtime поведение (`apps/web`),
- DB schema/migrations (`services/api/prisma`),
- deployment/infra/scripts (`ops`, `scripts`, `docker-compose`, nginx),
- runtime конфиги и feature flags.

## 3) Базовые принципы

1. **Rollback-first**: до выката должен быть готов конкретный rollback сценарий.
2. **Small-batch delivery**: не смешивать рискованные категории изменений в один релиз.
3. **Compatibility over speed**: сначала backward-compatible релиз, затем cleanup.
4. **Observe before expand**: разворачивать поэтапно с наблюдением метрик.
5. **No hidden changes**: все production-impacting изменения документируются.

## 4) Категории рисков

### C0 — Config-only
Примеры: изменение значения существующего env, включение уже существующего feature flag.

Требования:
- 1 reviewer;
- rollback инструкция в PR;
- мониторинг после выката: 15 минут.

### C1 — Code-only, без schema impact
Примеры: локальный bugfix в API route, UI fix без изменения контрактов и БД.

Требования:
- 1 reviewer;
- smoke checks;
- rollback commit/revert план;
- мониторинг: 30 минут.

### C2 — Schema-compatible
Примеры: additive таблицы/поля/индексы, новые optional поля в API.

Требования:
- 2 reviewers (включая backend owner);
- expand/contract план;
- feature-flag или compatibility guard;
- canary/поэтапный rollout;
- мониторинг: 60 минут.

### C3 — High-risk / schema-breaking
Примеры: drop колонок, изменение auth/session semantics, критичные routing/infra изменения.

Требования:
- RFC/дизайн-решение до реализации;
- staged rollout минимум в 2 релиза;
- проверенный rollback на staging;
- выделенный on-call владелец релиза;
- мониторинг: 120 минут.

## 5) Обязательный PR checklist

PR, который идет в путь `main -> production`, обязан содержать:

- Категория изменения: C0/C1/C2/C3.
- Blast radius: какие пользователи/роуты/домены затронуты.
- Feature flag: имя, default state, план включения.
- Migration plan (если есть БД/контракты).
- Rollback plan: конкретные шаги и команда/commit для revert.
- Validation plan: health/ready/release markers + бизнес-проверки.
- Post-deploy owner: кто мониторит окно наблюдения.

## 6) Release gates (go/no-go)

Релиз блокируется, если хотя бы одно условие не выполнено:

- CI required checks зелёные (см. `docs/deploy-workflow.md`).
- Есть обязательные approvals согласно категории риска.
- В PR заполнен rollback plan.
- Для C2/C3 есть поэтапный rollout plan.
- Назначен ответственный за post-deploy мониторинг.

## 7) Стратегия rollout

1. **Dark launch** (если возможно): код выкатить, feature flag оставить OFF.
2. **Internal/admin enablement**: ограниченное включение для внутренней аудитории.
3. **Canary**: частичное включение для production трафика.
4. **Full rollout**: только при нормальных SLI в мониторинг-окне.

## 8) Триггеры немедленного rollback

Любой из пунктов — причина отката:

- устойчивый рост 5xx относительно baseline;
- падение auth success rate;
- падение registration success rate;
- сбой обязательных `/health`, `/ready`, `version/release` контрактов;
- риск data integrity.

## 9) Координация при 3+ разработчиках

- На каждое окно релиза назначается **Release Captain**.
- Рабочие зоны фиксируются заранее (Auth/Profile, Events/Teams, Admin, Infra).
- Запрещены кросс-доменные big-bang refactor PR в один релиз.
- Рекомендуемый порядок мержа:
  1. observability/infra,
  2. additive backend contracts,
  3. frontend consumers,
  4. cleanup/deletion.

## 10) Что запрещено

- Совмещать destructive DB migration и крупное поведенческое изменение в одном релизе.
- Включать новый рискованный флоу сразу на 100% трафика.
- Деплоить без проверяемого rollback сценария.
- Удалять legacy путь до завершения периода совместимости.

## 11) Definition of done (production-safe)

Изменение считается завершенным только когда:

- код смержен;
- деплой в production подтвержден;
- мониторинг-окно прошло без деградации;
- документация/runbook обновлены.
