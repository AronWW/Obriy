# <img src="docs/images/compass.svg" width="40" height="40" alt="" align="top"> Obriy

A history learning platform for students, teachers and parents. Teachers create lessons and interactive tests, students work through them and earn XP, and parents follow their children's progress.

[Live application](https://obriy.me/)

![Obriy homepage in night and day themes](docs/images/homepage-themes.png)

*Homepage in night and day themes. The interface is available in Ukrainian and English.*

## What You Can Do

| Role | Workspace |
| --- | --- |
| Student | Read lessons, complete tests, track results, earn badges and compare progress within a class. |
| Teacher | Manage classes, write lessons, build assignments and tests, review submissions and view class analytics. |
| Parent | Connect to children through invitation links and view their lessons, results and achievements. |
| Administrator | Manage users and classes, moderate reported lessons, handle suspension appeals and inspect the audit log. |

Teachers can combine **11 assignment formats** into a test: written responses, single and multiple choice, matching, ordering, categorization, fill-in-the-blanks, image hotspots, map points, single map regions and multiple map regions. Tests support scheduled releases, deadlines, attempt limits and teacher review for written answers.

The **Map Sandbox** includes world countries and Ukrainian regions, custom GeoJSON imports and a drawing editor. Students can locate a point or select regions directly on a map. The server checks their answers, including the distance from a submitted point to its target.

Students earn **XP, levels and badges** from completed tests. An achievements page tracks badge progress, and a class leaderboard shows public profiles. Teachers and students can exchange messages and attachments; notifications arrive through Socket.io.

Each role has its own navigation and dashboard. Profiles support avatars, and the application includes responsive layouts, Ukrainian and English UI, and day and night themes.

## Technical Decisions

- **Access depends on role and ownership.** Backend services check class membership, teacher ownership and parent-child links. Public profile responses exclude email and private account fields.
- **Published tests use revisions.** Test items reference published assignment revisions, keeping released content separate from drafts being edited.
- **Grading stays on the server.** Answer keys are stored separately from assignment content and omitted from student responses before submission. Written responses use a teacher review workflow.
- **XP has a ledger.** Rewards are recorded against their source, and test finalization updates scores and rewards within a database transaction.
- **Sessions use rotating refresh tokens.** Access tokens stay in frontend memory; refresh tokens use an HttpOnly cookie and are stored as hashes. Google accounts link to existing accounts by verified email.
- **Realtime updates share a gateway.** Socket authentication and server-controlled rooms support chat and notifications. Application events feed notification producers.

## Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router |
| State and forms | TanStack Query, Zustand, React Hook Form, Zod |
| Interface | CSS Modules, CSS variables, Motion, Lucide, canvas-confetti |
| Maps | MapLibre GL JS, Terra Draw; mapshaper for GeoJSON processing |
| Backend | NestJS 11, Prisma 7, PostgreSQL 17 |
| Auth and services | JWT, Passport, Google OAuth, Socket.io, Resend, Cloudinary |
| Localization | react-i18next, nestjs-i18n |
| Testing | Jest, Supertest, Vitest, Testing Library, MSW, Playwright |

## Repository

```text
obriy-backend/          NestJS modules, Prisma schema, migrations and API tests
obriy-frontend/         React features, shared UI and browser tests
docs/images/           README screenshots
docker-compose.yml     Local PostgreSQL and optional pgAdmin
```

Backend modules cover authentication, profiles, classes, parent links, lessons, assignments, tests, maps, gamification, leaderboards, chat, notifications, analytics and administration. Frontend code is organized by feature, with shared API, navigation and UI components.

## Run Locally

Requirements: **Node.js 22**, **npm 11** and **Docker Compose**. Run commands from the repository root unless a directory change is shown.

### 1. Start the database

```sh
git clone https://github.com/AronWW/Obriy.git
cd Obriy
docker compose up -d postgres
```

PostgreSQL is exposed on port `5433`. To also start pgAdmin, run `docker compose up -d`; its local configuration is in the compose file.

### 2. Configure the environment

```sh
cp obriy-backend/.env.example obriy-backend/.env
cp obriy-frontend/.env.example obriy-frontend/.env
```

Set `JWT_ACCESS_SECRET` to a random secret. The example database URL matches the local compose configuration. Keep `FRONTEND_URL` and `VITE_API_URL` on the same hostname, such as `localhost`, for the cookie-based session flow.

Google sign-in requires the Google OAuth variables. Real email delivery requires `RESEND_API_KEY` and `MAIL_FROM`. In local development, leaving Resend unconfigured prints verification and password-reset links in the API console. Cloudinary credentials are needed for media uploads.

### 3. Start the backend

```sh
cd obriy-backend
npm ci
npx prisma generate
npm run db:migrate:deploy
npm run seed:maps
npm run seed:badges
npm run start:dev
```

The API runs at [localhost:3000](http://localhost:3000). Swagger is available locally at [localhost:3000/docs](http://localhost:3000/docs).

To create an administrator, set `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_DISPLAY_NAME` in the backend `.env`, then run `npm run seed:admin`.

### 4. Start the frontend

In another terminal, from the repository root:

```sh
cd obriy-frontend
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). Register as a teacher to create a class and content, or as a student to join a class through its invitation code.

On Windows, `Copy-Item` can replace `cp`. Use `npm.cmd` and `npx.cmd` if PowerShell blocks the npm scripts.

## Tests

Run these commands in their respective project directories:

| Project | Commands |
| --- | --- |
| Backend | `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build` |
| Frontend | `npm run lint`, `npm test`, `npm run test:visual`, `npm run build` |

Backend tests cover access rules, authentication, assignment validation and grading, test lifecycles, rewards, notifications and other module behavior. Frontend tests cover API-backed flows and UI interactions; Playwright exercises browser layouts and workflows.

Backend E2E tests need a separate PostgreSQL database with the current migrations. Set `TEST_DATABASE_URL` before running them. Email delivery and storage integrations are replaced with test services. Playwright uses Microsoft Edge and starts a local Vite server when one is not already running.

<details>
<summary>Prepare the local E2E database in PowerShell</summary>

Run from the repository root in a separate terminal. Create the database once:

```powershell
docker compose exec postgres psql -U obriy -d postgres -c "CREATE DATABASE obriy_test;"
cd obriy-backend
$env:TEST_DATABASE_URL = "postgresql://obriy:obriy_password@localhost:5433/obriy_test?schema=public"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm.cmd run db:migrate:deploy
npm.cmd run test:e2e
```

</details>

## Map Data

Built-in boundary datasets come from geoBoundaries and its upstream sources. Dataset credits and licenses are listed in [map attribution](obriy-frontend/public/maps/ATTRIBUTION.md).
