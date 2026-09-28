# Obriy Frontend

React application for [Obriy](https://obriy.me/), a history learning platform with separate workspaces for students, teachers, parents and administrators.

See the [project README](../README.md) for features, screenshots and full local setup.

## Development

Use Node.js 22 and npm 11. Create `.env` from `.env.example` and set `VITE_API_URL` to the backend URL. Start the backend before using authenticated features.

```sh
npm ci
npm run dev
```

The development server runs at [localhost:5173](http://localhost:5173).

## Structure

- `src/app`: providers and routing.
- `src/features`: role workspaces and feature-specific API, state and UI.
- `src/pages`: public and authentication pages, plus the shared student/teacher layout.
- `src/shared`: API utilities, navigation, backgrounds and reusable controls.
- `src/i18n`: Ukrainian and English interface translations.
- `test/visual`: Playwright browser tests.
- `public/maps`: built-in boundary snapshots and their attribution.

TanStack Query handles server data, Zustand holds session state, and React Hook Form with Zod validates forms. CSS Modules and shared CSS variables define day and night themes. MapLibre and Terra Draw power the map editor.

## Checks

```sh
npm run lint
npm test
npm run build
npm run test:visual
```

Playwright uses Microsoft Edge. Its configuration starts Vite when needed and reuses an existing server at `http://127.0.0.1:5173`.
