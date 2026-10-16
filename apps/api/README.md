# @motatto/api

Express + Mongoose backend for Motatto (multitenant SaaS for motorcycle/car repair shops). Implements the contract in `packages/shared/src/api.ts`; request bodies are validated with the Zod schemas from `@motatto/shared`.

## Local run

```bash
docker compose up -d                 # Mongo 7 on 27017 (from repo root)
cp apps/api/.env.example apps/api/.env
npm install                          # from repo root
npm run build -w packages/shared
npm run seed -w apps/api             # superadmin + demo tenant "motatto"
npm run dev -w apps/api              # http://localhost:4000
```

Scripts: `dev`, `build`, `start`, `test` (vitest + supertest + mongodb-memory-server), `typecheck`, `seed`.

## Environment variables

| Var | Description |
|---|---|
| `NODE_ENV`, `PORT` | `production` on Railway; port defaults to 4000 |
| `MONGODB_URI` | Mongo connection string |
| `JWT_SECRET`, `JWT_EXPIRES` | JWT signing secret and lifetime (default `30d`) |
| `CORS_ORIGINS` | Comma list of allowed origins (requests without `Origin` are allowed) |
| `WEB_URL` | Frontend URL, used for invite links and public invoice links |
| `API_PUBLIC_URL` | Optional; prefix for local `/uploads` URLs when R2 is not configured |
| `ANTHROPIC_API_KEY` | Enables label OCR and the voice assistant via Claude. Without it both fall back (deterministic matcher / "IA no configurada") |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | Cloudflare R2 for uploads. If unset, files are stored in `apps/api/uploads/<tenantId>/` and served at `/uploads` |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | Seed superadmin (defaults `superadmin@motatto.app` / `Motatto2026!`) |
| `SEED_OWNER_PASSWORD` | Password for the demo owner `dirox7@gmail.com` |
| `SEED_TOKEN` | Enables `POST /api/superadmin/seed-demo` (header `X-Seed-Token`) |

## Endpoints (summary)

All responses: documents expose `id`, dates are ISO. Errors: `{ error: { code, message, details? } }`. Lists: `{ items, total, page, limit }`.

- `GET /health`
- **Auth** `POST /api/auth/register|login|password`, `GET /api/auth/me`, `GET /api/auth/invite/:token`, `POST /api/auth/invite/accept`
- **Public** `GET /api/public/tenants/:slug`, `GET /api/public/invoices/:tenantSlug/:number[/pdf]`
- **Tenant** `GET|PATCH /api/tenant`, `POST /api/tenant/logo`
- **Users** `GET /api/users`, `POST /api/users/invite`, `PATCH|DELETE /api/users/:id`
- **Dashboard** `GET /api/dashboard`
- **Customers / vehicles** CRUD under `/api/customers`, `/api/vehicles`, `GET /api/vehicles/plate/:plate`, `GET /api/customers/:id/orders`, `GET /api/vehicles/:id/orders`
- **Products** CRUD `/api/products` (soft delete), `POST /:id/movements` (entrada/ajuste, optional expense), `POST /:id/adjust`, `POST /:id/photos`, `POST /read-label`, `POST /import` (xlsx/csv), `GET /export`, `GET /low-stock`; `GET /api/movements`
- **Services** CRUD `/api/services`
- **Orders** `GET|POST /api/orders`, `GET|PATCH /:id`, `POST /:id/status` (transitions per `ORDER_TRANSITIONS`; `terminada` accepts `deduct[]`, `anulada` requires `voidReason` and restores stock), `GET /:id/deduct-preview`, `POST /:id/pay` (surcharge by method, creates Payment, warranty), `POST /:id/photos`, `GET /:id/invoice` (text + WhatsApp + public link), `GET /:id/pdf`
- **Cash** `GET /api/payments`, `GET|POST|DELETE /api/expenses`, `GET /api/cash/day?date=`, `POST /api/cash/close`, `POST /api/cash/reopen`, `GET /api/cash/closings`
- **Reports** `GET /api/reports/sales?from&to`, `GET /api/reports/sales/export` (xlsx)
- **Assistant** `POST /api/assistant` (text → `AssistantProposal`), `POST /api/assistant/transcribe` (501 until a provider is configured)
- **Uploads** `POST /api/uploads` → `{ url }`
- **Audit** `GET /api/audit?limit=`
- **Superadmin** `GET /api/superadmin/tenants[?q]`, `GET|PATCH /tenants/:id`, `POST /tenants/:id/impersonate`, `GET /stats`, `POST /seed-demo` (X-Seed-Token)

Auth: `Authorization: Bearer <jwt>` with `{ sub, tenantId, role }`. Every tenant query is scoped by `tenantId` from the token; superadmin may pass `X-Tenant-Id` or use an impersonation token (`imp: true`, audited). Suspended tenants get `403 TENANT_SUSPENDED` everywhere except `GET /api/tenant` and `GET /api/auth/me`.

## Deploy (Railway)

`railway.json` and `nixpacks.toml` at the repo root configure Node 22, `npm ci && npm run build:api`, start `node apps/api/dist/index.js`, healthcheck `/health`. Set the env vars above (Mongo plugin provides `MONGODB_URI`; set `CORS_ORIGINS` and `WEB_URL` to the Vercel domain). Run the seed once with `curl -X POST -H "X-Seed-Token: $SEED_TOKEN" https://api.<domain>/api/superadmin/seed-demo` or `npm run seed -w apps/api` against the production URI.
