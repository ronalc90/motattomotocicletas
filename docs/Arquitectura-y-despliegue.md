# Arquitectura y despliegue

## Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend | **React + Vite + TypeScript**, Tailwind, PWA (instalable, cámara, micrófono) | Rápido en celular, desplegable estático en Vercel |
| Voz (cliente) | Web Speech API (es-CO) con fallback a grabar audio y enviarlo | Gratis y sin latencia en Chrome/Android |
| API | **Node 20 + Express + TypeScript**, Mongoose, Zod, JWT | Sencillo de desplegar en Railway |
| Base de datos | **MongoDB** (Railway plugin o MongoDB Atlas M0 gratis) | Decisión del proyecto |
| Archivos | Cloudflare R2 (S3-compatible) | Fotos de etiquetas, PDFs, audio |
| IA | API de Claude: OCR de etiquetas (visión), interpretación de voz → líneas de factura, respuestas del asistente | Un solo proveedor para visión y texto |
| PDF | `@react-pdf/renderer` en el frontend (sin servidor) | Cero carga en la API |
| WhatsApp | Link `wa.me/<tel>?text=…` con el texto de la factura (fase 1); API oficial (fase 3) | Igual que hoy, sin costo |

Monorepo:
```
/
├── apps/web      → Vercel  (Vite)
├── apps/api      → Railway (Express)
├── packages/shared → tipos y validaciones Zod compartidas
├── docs/          → copia de este wiki en el repo
└── package.json   (npm workspaces)
```

## Entornos

| | URL | Rama |
|---|---|---|
| Producción web | `https://motattomotocicletas.com` (+ `www`) | `main` |
| Producción API | `https://api.motattomotocicletas.com` | `main` |
| Preview | Vercel preview por PR · Railway PR environments | ramas `feat/*` |

## Railway (API + Mongo)

Proyecto `motattomotocicletas` (ID `5727b468-f3b3-4acf-bd87-1460a45d044c`).

Servicios:
1. **api** — Root `apps/api`, build `npm ci && npm run build -w apps/api`, start `node apps/api/dist/index.js`, puerto `$PORT`, healthcheck `/health`.
2. **mongo** — plugin MongoDB de Railway (o `MONGODB_URI` de Atlas).

Variables de entorno `api`:
```
NODE_ENV=production
PORT=                     (lo pone Railway)
MONGODB_URI=              (del plugin)
JWT_SECRET=
JWT_EXPIRES=30d
CORS_ORIGINS=https://motattomotocicletas.com,https://www.motattomotocicletas.com
ANTHROPIC_API_KEY=
R2_ACCOUNT_ID= R2_ACCESS_KEY_ID= R2_SECRET_ACCESS_KEY= R2_BUCKET= R2_PUBLIC_URL=
SUPERADMIN_EMAIL=
```
Dominio custom en Railway: `api.motattomotocicletas.com` → CNAME que entrega Railway.

## Vercel (web)

Proyecto `motattomotocicletas` (Koptup's projects), repo `ronalc90/motattomotocicletas`, rama `main`.
- Root Directory: `apps/web` · Framework: Vite · Build: `npm run build` · Output: `dist`.
- Rewrites en `vercel.json`: SPA (`/* → /index.html`).
- Variables: `VITE_API_URL=https://api.motattomotocicletas.com`.
- Dominios: `motattomotocicletas.com` y `www.motattomotocicletas.com`.

> Nota: el primer deploy de Vercel se lanzó con el repo vacío; va a fallar. Se vuelve a desplegar solo cuando hagamos el primer push a `main`.

## Namecheap (DNS)

En **Advanced DNS** de `motattomotocicletas.com`:

| Tipo | Host | Valor | TTL |
|---|---|---|---|
| A | `@` | `76.76.21.21` (Vercel) | automático |
| CNAME | `www` | `cname.vercel-dns.com` | automático |
| CNAME | `api` | `<lo que entregue Railway>.up.railway.app` | automático |

Verificar en Vercel ("Domains") y Railway ("Settings → Networking"). Propagación: minutos a algunas horas. HTTPS lo emiten ambos automáticamente.

## Seguridad
- Contraseñas con bcrypt; JWT firmado; refresh por reinicio de sesión.
- Rate limit en login y registro. Helmet. CORS cerrado al dominio.
- Validación Zod en cada endpoint. `tenantId` inyectado desde el token, nunca desde el body.
- Fotos con URL firmada. Backups diarios de Mongo (Railway/Atlas).

## CI
GitHub Actions en cada PR: lint, typecheck, tests de API (incluye tests de aislamiento multitenant). Deploy automático a producción al merge en `main` (Vercel y Railway lo hacen por integración con GitHub).

## Documentación que vive en el repo
- `README.md` — cómo correr local (`docker compose up` levanta Mongo; `npm run dev`).
- `docs/` — copia de estas páginas.
- `apps/api/openapi.yaml` — contrato de la API (se genera desde Zod).
- `CHANGELOG.md`.
