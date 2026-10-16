# @motatto/web

Frontend de Motatto: Vite + React 18 + TypeScript + Tailwind v3. PWA instalable (manifest + service worker con shell offline). Todo el texto de la UI está en español (Colombia); el código en inglés.

## Desarrollo

```bash
npm install                       # desde la raíz del monorepo
npm run build -w packages/shared  # el contrato compartido (una vez, o tras cambiarlo)
npm run dev -w apps/api           # API en http://localhost:4000
npm run dev -w apps/web           # http://localhost:5173 (proxy /api y /uploads → :4000)
```

Scripts: `dev`, `build` (`tsc -b && vite build`), `preview`, `typecheck`, `icons` (regenera `public/icons/*.png` desde `icon.svg` con sharp).

## Variables de entorno

| Var | Descripción |
|---|---|
| `VITE_API_URL` | Base de la API sin `/api` ni barra final. Vacío = mismo origen (proxy de Vite en dev). En producción: `https://api.motattomotocicletas.com` |

## Rutas

Público (layout con nav y footer):
- `/` landing · `/como-funciona` · `/precios` · `/nosotros`
- `/login` · `/registro` · `/invitacion/:token`
- `/cc/:tenantSlug/:number` cuenta de cobro pública (PDF en el navegador, copiar texto, WhatsApp, compartir, imprimir)

App del taller `/app/*` (requiere sesión; sidebar en ≥lg, barra inferior en móvil; ítems filtrados por `can(role, perm)`):
- `/app` panel · `/app/bienvenida` onboarding (3 pasos)
- `/app/ordenes` · `/app/ordenes/nueva` · `/app/ordenes/:id` · `/app/ordenes/:id/editar`
- `/app/asistente` voz/texto (Web Speech API `es-CO`, lectura en voz alta opcional)
- `/app/clientes` · `/app/clientes/:id` · `/app/vehiculos/:id`
- `/app/inventario` · `/app/inventario/entrada` (foto de etiqueta → `read-label`) · `/app/inventario/:id`
- `/app/servicios` · `/app/caja` · `/app/reportes` · `/app/configuracion?tab=taller|usuarios|auditoria|cuenta`

Superadmin `/superadmin/*`: estadísticas, `/superadmin/talleres`, `/superadmin/talleres/:id` (plan, estado, "Entrar como soporte" → impersonación; el token original se guarda en `sessionStorage` para "Salir del modo soporte").

## Estructura

```
src/
  lib/        api.ts (fetch + token + errores), auth.tsx (contexto), queries.ts, utils.ts
  hooks/      useCan, useDebounce, useSpeech (+ speak)
  components/ ui/ (Button, Input, MoneyInput, Select, Card, Badge, Modal, ConfirmDialog, Table, Tabs, PhotoInput…)
              invoice/ (InvoiceView HTML, InvoicePdf @react-pdf, downloadPdf)
              orders/ (DeductModal, PayModal), assistant/AssistantPanel, customers/, inventory/
  layouts/    PublicLayout, AppShell, SuperadminShell
  pages/      public/, app/, superadmin/
```

## Despliegue en Vercel

- Root Directory: `apps/web`
- Build Command: `cd ../.. && npm ci && npm run build:web`
- Output Directory: `dist`
- Env: `VITE_API_URL=https://api.motattomotocicletas.com`
- `vercel.json` reescribe todas las rutas a `index.html` (SPA).

En la API, `CORS_ORIGINS` debe incluir el dominio de Vercel y `WEB_URL` debe apuntar a él (links de invitación y links públicos `/cc/...`).
