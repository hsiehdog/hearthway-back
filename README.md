# Hearthway Backend

Hearthway gives groups a clear, fair way to manage shared costs. Project Mode helps neighbors, families, clubs, or small teams log expenses, attach receipts, and split them by even/percent/share amounts. Trip Mode brings the same engine to travel with participation-based splits, multi-currency trips, lightweight itineraries, and a clean settlement plan.

This package is the Express + Prisma backend that powers auth, data storage, background jobs, and the APIs the frontend consumes.

## Tech stack

- Express 5 with Helmet/CORS/Morgan hardening
- TypeScript + `ts-node-dev` for hot reload
- PostgreSQL + Prisma (Better Auth tables included)
- Better Auth Prisma adapter for password auth + secure session cookies
- Vercel AI SDK (`ai` + `@ai-sdk/openai`) for LLM-backed helpers (receipt parsing, naming)
- S3-compatible storage for receipts via presigned URLs
- BullMQ + Redis worker for long-running parsing jobs

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

5) Start the background worker (needs Redis on localhost:6379):
```bash
pnpm worker
```
For production after build:
```bash
pnpm worker:prod
```

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
| `AWS_S3_BUCKET` / `AWS_S3_REGION` | S3 bucket/region for uploads; presigned PUT/GET are used. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Credentials for S3 (or compatible storage). |
| `AWS_S3_ENDPOINT` | Optional custom endpoint (e.g., MinIO). |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection for BullMQ (defaults 127.0.0.1:6379). |

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
| POST | `/expenses/:id/payments` | Add a payment toward an expense | Better Auth session |
| PUT/DELETE | `/expenses/:id/payments/:paymentId` | Update or delete a payment | Better Auth session |
| POST | `/groups/:groupId/expense-uploads/presign` | Get presigned PUT URL + create upload/expense draft | Better Auth session |
| POST | `/uploads/:uploadId/complete` | Mark upload complete and enqueue parsing job | Better Auth session |
| DELETE | `/uploads/:uploadId` | Delete an upload and associated file | Better Auth session |

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
├── queues               # BullMQ queue + worker setup
├── worker               # Worker bootstrap entrypoint
├── lib                  # Prisma singleton + Better Auth instance + storage
└── types                # Express augmentations
```

## Hearthway-focused next steps

- Model expense groups, receipts, splits, and settlements in Prisma, with versions for Project Mode and Trip Mode (multi-currency).
- Add endpoints for expense CRUD, receipt uploads/parsing, balance calculations, and settlement suggestions.
- Extend `/ai/*` to handle receipt extraction, settlement drafting, and friendly nudges for overdue balances.
- Tighten CORS to the real frontend origin(s) and configure deployment secrets for your hosting platform.
