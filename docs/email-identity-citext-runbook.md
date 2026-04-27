# Email identity CITEXT runbook

## Before deploy

Check case-only duplicate users:

```sql
SELECT lower(trim(email::text)) AS normalized_email, COUNT(*)
FROM users
GROUP BY lower(trim(email::text))
HAVING COUNT(*) > 1;

If this returns rows, stop. Resolve users manually before migration.

Check uppercase/dirty emails:

SELECT id, email
FROM users
WHERE email::text <> lower(trim(email::text));
After deploy
SELECT id, email
FROM users
WHERE email::text <> lower(trim(email::text));

SELECT lower(trim(email::text)) AS normalized_email, COUNT(*)
FROM users
GROUP BY lower(trim(email::text))
HAVING COUNT(*) > 1;

Both queries must return zero rows.

Manual smoke tests
1. Login as lowercase email.
2. Login as uppercase email.
3. Request password reset as lowercase email.
4. Request password reset as uppercase email.
5. Try registration with same email but different case; must return EMAIL_TAKEN.
