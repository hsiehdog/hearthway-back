# Hearthway Backend

Hearthway gives groups a clear, fair way to manage shared costs. Project Mode helps neighbors, families, clubs, or small teams log expenses, attach receipts, and split them by even/percent/share amounts. Trip Mode brings the same engine to travel with participation-based splits, multi-currency trips, lightweight itineraries, and a clean settlement plan.

This package is the Express + Prisma backend that powers auth, data storage, and the APIs the frontend consumes.

## Tech stack

- Express 5 with Helmet/CORS/Morgan hardening
- TypeScript + `ts-node-dev` for hot reload
- PostgreSQL + Prisma (Better Auth tables included)
- Better Auth Prisma adapter for password auth + secure session cookies
- Vercel AI SDK (`ai` + `@ai-sdk/openai`) ready for LLM-backed helpers (e.g., settlement suggestions, receipt extraction)

## Getting started

1) Install dependencies (pnpm is required):
```bash
pnpm install
```
2) Copy the environment template and fill in secrets:
```bash
cp .env.example .env
```
   - Set `BETTER_AUTH_SECRET` to a long random value.
   - Update `APP_BASE_URL` and `TRUSTED_ORIGINS` so Better Auth can validate callback URLs and allow your frontend origin(s) to exchange cookies.
3) Apply database migrations (creates the Prisma Client as well):
```bash
pnpm prisma:migrate
```
4) Start the dev server:
```bash
pnpm dev
```
The API listens on `PORT` (default `4000`) and exposes Better Auth at `/auth`.

## Environment

| Variable | Description |
| --- | --- |
| `PORT` | Port for the HTTP server (default 4000). |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma. |
| `BETTER_AUTH_SECRET` | Long random string for Better Auth encryption/signing. |
| `APP_BASE_URL` | Public base URL of this API (used by Better Auth callbacks). |
| `TRUSTED_ORIGINS` | Comma-separated origins allowed for cross-site credentials (e.g., `http://localhost:3000`). |
| `OPENAI_API_KEY` | API key for the Vercel AI SDK provider. |
| `AI_MODEL` | Model name for LLM calls (default `gpt-4o-mini`). |

## API surface (current scaffold)

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/health` | Health probe | Public |
| GET | `/users/me` | Return the authenticated user record | Better Auth session |
| PATCH | `/users/me` | Update display name via Better Auth `updateUser` | Better Auth session |
| GET | `/users/me/sessions` | Last 20 AI sessions for the user | Better Auth session |
| POST | `/users/me/change-password` | Rotate credentials via Better Auth `changePassword` | Better Auth session |
| POST | `/users/sign-out` | Revoke the current session and clear cookies | Better Auth session |
| POST | `/ai/generate` | Example LLM endpoint using Vercel AI SDK and Prisma persistence | Better Auth session |
| POST | `/groups` | Create a group and add the creator as the first member | Better Auth session |
| GET | `/groups/:id` | Fetch a group with members and expenses (requires membership) | Better Auth session |
| POST | `/expenses` | Create an expense in a group with participants/line items | Better Auth session |

Better Auth issues HTTP-only cookies (`better-auth.session_token`, etc.) that the frontend must forward on every request to protected routes. The `/auth/*` router proxies directly to Better Auth, so you can use stock endpoints like `POST /auth/sign-up/email` and `POST /auth/sign-in/email`.

## Project structure

```
src
├── app.ts               # Express app wiring (security, CORS, JSON parsing)
├── index.ts             # HTTP server bootstrap
├── config               # env parsing + runtime flags
├── controllers          # Route handlers (auth/users/ai/groups/expenses)
├── middleware           # Auth context + error handlers
├── routes               # Auth proxy, health, users, AI, group, and expense routes
├── services             # Domain logic (LLM helper lives here)
├── lib                  # Prisma singleton + Better Auth instance
└── types                # Express augmentations
```

## Hearthway-focused next steps

- Model expense groups, receipts, splits, and settlements in Prisma, with versions for Project Mode and Trip Mode (multi-currency).
- Add endpoints for expense CRUD, receipt uploads/parsing, balance calculations, and settlement suggestions.
- Extend `/ai/*` to handle receipt extraction, settlement drafting, and friendly nudges for overdue balances.
- Tighten CORS to the real frontend origin(s) and configure deployment secrets for your hosting platform.
