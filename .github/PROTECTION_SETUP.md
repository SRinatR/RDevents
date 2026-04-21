# Branch Protection / Ruleset настройки для ветки `production`

## Вариант A: GitHub Rulesets (рекомендуется, если доступно в вашем плане)

Перейдите в **Settings → Rulesets → New ruleset** (или **Rules → Rulesets**).

### Основные настройки

| Параметр | Значение |
|----------|----------|
| **Name** | `Production Branch Protection` |
| **Target** | `production` |
| **Enforcement status** | `Active` |

### Rules → Branch rules

- [x] **Require pull request before merging**
  - Required number of approvals: `1`
  - Dismiss stale reviews: `true`
  - Require review from Code Owners: `true`

- [x] **Require status checks to pass before merging**
  - Required checks: добавить `Required Checks` (имя job из ci.yml)
  - Require branches to be up to date before merging: `true`

- [x] **Block force pushes**

- [x] **Restrict who can push to matching branches**
  - Search and add: `SRinatR`
  - **Bypass list** (или "Delivery and deployment permissions"):
    - Actor: `SRinatR` — роль/тип: `Actor` — Mode: `bypass`

### Rules → Ruleset rules (дополнительно)

- [x] **Commit message pattern** (опционально, для commit messages conventions)

---

## Вариант B: Branch protection (классический, если Rulesets недоступны)

Перейдите в **Settings → Branches → Add rule**.

### Branch name pattern

```
production
```

### Protection settings

- [x] **Require pull request reviews before merging**
  - Required number of reviewers: `1`
  - Dismiss stale reviews: `true`
  - Require review from Code Owners: `true`

- [x] **Require status checks to pass before merging**
  - Search for status checks: добавить `Required Checks`
  - Require branches to be up to date before merging: `true`

- [x] **Require linear history** (опционально)

- [x] **Do not allow bypassing the above settings**
  - Важно: снимите галку "Allow force pushes" и НЕ ставьте галочку "Bypass required reviewers"

### Кто может обходить правила

В разделе **Allow specified actors to bypass required checks**:

- Добавить `SRinatR`

---

## Проверка bypass для SRinatR

После настройки убедитесь, что:

1. Вы (SRinatR) можете пушить напрямую в `production` без PR
2. После вашего push запускается CI → Deploy production
3. Остальные пользователи при попытке push получают ошибку `denied`
4. Остальные могут создать PR, но без вашего approval и без зелёного CI merge невозможен

---

## Итоговый чеклист

- [ ] Ruleset / Branch protection rule создан для `production`
- [ ] Require pull request: включено
- [ ] Required approvals: минимум 1
- [ ] Review from Code Owners: требуется
- [ ] Dismiss stale approvals: включено
- [ ] Required status check `Required Checks`: добавлен
- [ ] Require branches up to date: включено
- [ ] Force push: заблокирован
- [ ] Bypass actor: только `SRinatR` с bypass rights
- [ ] CODEOWNERS файл: `.github/CODEOWNERS` создан и содержит `* @SRinatR`
