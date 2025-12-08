# Hearthway Backend

Hearthway gives groups a clear, fair way to manage shared costs. This package is the Express + Prisma backend that powers auth, data storage, uploads, and expense APIs for the frontend.

## Feature set (implemented)

- Better Auth + Prisma adapter for user accounts and secure session cookies.
- Groups:
  - Create a group and automatically add the creator as a member (user-linked).
  - List groups for the signed-in user and fetch group detail (with expenses/members).
  - Add members by user id or email (members are always linked to a user).
- Expenses:
  - Create expenses with participants, line items, and split types (even/percent/shares).
  - Add, update, and delete payments for an expense.
  - Fetch expenses with participant costs and payment data.
- Uploads:
  - Presigned URL generation for expense receipt uploads.
  - Mark uploads complete and enqueue parsing (BullMQ/Redis).
- AI helper endpoint scaffold via Vercel AI SDK.
- Health endpoint for probes.

## Tech stack

- Express 5, Helmet/CORS/Morgan hardening
- TypeScript + `ts-node-dev` for hot reload
- PostgreSQL + Prisma (Better Auth tables included)
- Better Auth for session cookies
- S3-compatible storage for receipts (presigned PUT/GET)
- BullMQ + Redis worker for long-running parsing jobs
- Vercel AI SDK (`ai`, `@ai-sdk/openai`) for LLM helpers

## Getting started

1) Install dependencies:
```bash
pnpm install
```
2) Copy env template and fill secrets:
```bash
cp .env.example .env
```
   - Set `BETTER_AUTH_SECRET` to a long random value.
   - Set `APP_BASE_URL` and `TRUSTED_ORIGINS` to include your frontend origin (credentials: include).
3) Apply database migrations (also generates Prisma Client):
```bash
pnpm prisma:migrate
```
4) Start the dev server:
```bash
pnpm dev
```
API listens on `PORT` (default `4000`) and exposes Better Auth at `/auth`.

5) Start the worker (needs Redis on localhost:6379):
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
| `AWS_S3_BUCKET` / `AWS_S3_REGION` | S3 bucket/region for uploads. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Credentials for S3 (or compatible storage). |
| `AWS_S3_ENDPOINT` | Optional custom endpoint (e.g., MinIO). |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection for BullMQ (defaults 127.0.0.1:6379). |

## API surface

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/health` | Health probe | Public |
| GET | `/users/me` | Return the authenticated user | Better Auth session |
| PATCH | `/users/me` | Update user profile | Better Auth session |
| GET | `/users/me/sessions` | List AI sessions | Better Auth session |
| POST | `/users/me/change-password` | Change password | Better Auth session |
| POST | `/users/sign-out` | Sign out | Better Auth session |
| POST | `/ai/generate` | Example AI endpoint | Better Auth session |
| POST | `/groups` | Create a group and add creator as member | Better Auth session |
| GET | `/groups` | List groups for the user | Better Auth session |
| GET | `/groups/:id` | Fetch a group (requires membership) | Better Auth session |
| POST | `/groups/:groupId/members` | Add a member by user id or email | Better Auth session |
| POST | `/expenses` | Create an expense with participants/line items | Better Auth session |
| GET | `/expenses/:id` | Fetch an expense | Better Auth session |
| POST | `/expenses/:id/payments` | Add a payment | Better Auth session |
| PUT/DELETE | `/expenses/:id/payments/:paymentId` | Update or delete a payment | Better Auth session |
| POST | `/groups/:groupId/expense-uploads/presign` | Presign upload + create draft | Better Auth session |
| POST | `/uploads/:uploadId/complete` | Mark upload complete & enqueue parsing | Better Auth session |
| DELETE | `/uploads/:uploadId` | Delete an upload | Better Auth session |

Better Auth issues HTTP-only cookies (e.g., `better-auth.session_token`) that the frontend must forward on protected routes.

## Project structure

```
src
├── app.ts               # Express app wiring (security, CORS, JSON parsing)
├── index.ts             # HTTP server bootstrap
├── config               # env parsing + runtime flags
├── controllers          # Route handlers (auth/users/ai/groups/expenses/uploads)
├── middleware           # Auth context + error handlers
├── routes               # Route registrations
├── services             # Domain logic (AI helper)
├── queues               # BullMQ queue + worker setup
├── worker               # Worker bootstrap entrypoint
├── lib                  # Prisma singleton + Better Auth instance + storage
└── types                # Express augmentations
```
