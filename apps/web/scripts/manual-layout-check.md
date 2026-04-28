# Manual layout QA

Run app locally:

```bash
pnpm dev
```

Open Chrome DevTools responsive mode and test widths:

- 390px
- 768px
- 1024px
- 1366px
- 1440px

Pages:

Cabinet

- /ru/cabinet
- /ru/cabinet/profile
- /ru/cabinet/events
- /ru/cabinet/applications
- /ru/cabinet/volunteer
- /ru/cabinet/team-invitations

Admin

- /ru/admin
- /ru/admin/participants
- /ru/admin/teams
- /ru/admin/users
- /ru/admin/events
- /ru/admin/volunteers
- /ru/admin/email
- /ru/admin/email/messages
- /ru/admin/email/templates
- /ru/admin/email/broadcasts
- /ru/admin/email/broadcasts/[id]/recipients
- /ru/admin/system-reports

For each page run in console:

```js
document.documentElement.scrollWidth <= window.innerWidth + 1
```

Expected: `true`.

If false, run:

```js
[...document.querySelectorAll('body *')]
  .map((el) => ({ el, rect: el.getBoundingClientRect() }))
  .filter((x) => x.rect.right > window.innerWidth + 1 || x.rect.left < -1)
  .slice(0, 20);
```

Attach screenshots/video to PR.
