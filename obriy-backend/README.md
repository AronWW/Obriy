# Obriy Backend

NestJS API for the Obriy history learning platform.

## Local setup

1. Copy `.env.example` to `.env` and provide local secrets.
2. Start PostgreSQL from the repository root:

```powershell
docker compose up -d postgres
```

3. Install dependencies and apply migrations:

```powershell
npm.cmd install
.\node_modules\.bin\prisma.cmd migrate deploy
```

4. Start the API:

```powershell
npm.cmd run start:dev
```

Swagger is available at `http://localhost:3000/docs`.

## Auth

The API supports email/password registration, email verification, password
reset, rotating refresh tokens, logout from one or all devices, and Google
OAuth account linking by verified email.

Access tokens are returned in the response body. Refresh tokens are stored in
an HttpOnly cookie and only their SHA-256 hashes are persisted.

For cross-site production deployments configure:

```env
COOKIE_SAME_SITE=none
COOKIE_SECURE=true
COOKIE_DOMAIN=
```

Use `COOKIE_SAME_SITE=lax` and `COOKIE_SECURE=false` for localhost.

## First administrator

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_DISPLAY_NAME` in `.env`, then
run:

```powershell
npm.cmd run seed:admin
```

The command is idempotent and refuses to promote an existing non-admin user.

## Verification

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
npm.cmd audit --omit=dev
```

E2E tests use `TEST_DATABASE_URL` and never send real email.
