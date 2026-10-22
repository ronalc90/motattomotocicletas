# Motatto

**Plataforma web para talleres de motos y carros en Colombia: cuentas de cobro, inventario con fotos, clientes y caja desde el celular, incluso dictando por voz.**

[![Sitio en vivo](https://img.shields.io/badge/sitio-motattomotocicletas.com-f06418?style=flat-square)](https://motattomotocicletas.com)
![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_8-47A248?style=flat-square&logo=mongodb&logoColor=white)

[![Página de inicio de Motatto](docs/capturas/sitio-inicio-escritorio.png)](https://motattomotocicletas.com)

> En producción en **[motattomotocicletas.com](https://motattomotocicletas.com)**. Cualquier taller se registra solo y empieza a facturar.

---

## Contenido

- [Qué es y para quién](#qué-es-y-para-quién)
- [Qué resuelve](#qué-resuelve)
- [Funcionalidades](#funcionalidades)
- [Capturas](#capturas)
- [Cómo funciona](#cómo-funciona)
- [Stack](#stack)
- [Correr en local](#correr-en-local)
- [Pruebas](#pruebas)
- [Despliegue](#despliegue)
- [Estado del proyecto](#estado-del-proyecto)
- [Autor](#autor)

---

## Qué es y para quién

Motatto es una aplicación web **multitenant**: un solo despliegue atiende a muchos talleres y cada uno tiene su espacio aislado, con sus clientes, su inventario, su caja y su numeración de cuentas de cobro.

Nació en un taller de motos de Bogotá (Motatto Motocicletas) que hacía las cuentas de cobro con un generador de texto: un archivo por cliente, sin historial, sin inventario y sin saber cuánto se vendía en el mes. Hoy cualquier taller puede usarla.

| Quién | Qué hace en Motatto |
|---|---|
| **Dueño del taller** | Registra el taller, configura recargos y garantía, invita a su equipo y ve ventas, caja y reportes. |
| **Equipo** (administrador, mecánico, cajero, contador) | Cada rol ve y hace solo lo que le corresponde. Un mecánico, por ejemplo, no ve costos ni dinero. |
| **Cliente del taller** | No necesita cuenta: recibe su cuenta de cobro por WhatsApp o por un link público, con PDF y garantía. |
| **Operador de la plataforma** (superadmin) | Ve todos los talleres, su plan y su uso de IA, los suspende o entra como soporte. |

Talleres de **motos**, de **carros** o de **ambos**: el tipo de taller define el catálogo inicial de servicios de mano de obra.

## Qué resuelve

| Problema en el taller | Cómo lo resuelve Motatto |
|---|---|
| Las cuentas de cobro se hacen en un bloc de notas y no queda historial. | Cada orden lleva consecutivo propio del taller (`PREFIJO-AÑO-0001`) y queda en el historial del cliente y del vehículo. |
| Nadie sabe qué hay en el estante. | El stock se lleva como movimientos (entrada, salida, ajuste, devolución), con alertas de stock bajo. |
| Los repuestos salen sin registrar. | Al terminar o cobrar una orden, el sistema pregunta qué descontar del inventario. Solo descuenta lo que se confirma. Si la orden se anula, el stock vuelve. |
| El recargo por Nequi o transferencia se calcula a mano. | Recargo porcentual por método de pago, configurable por taller; el total se recalcula solo. |
| Al final del día no se sabe cuánta plata entró. | Caja del día con pagos por método, gastos y neto; cierre del día y reapertura con permiso. |
| Escribir en el celular con las manos llenas de grasa. | Asistente por voz o texto: se dicta la cuenta y el sistema propone las líneas con precios del catálogo. |
| El cliente pierde el papel de la garantía. | La cuenta de cobro tiene link público con PDF y fecha de garantía. |

## Funcionalidades

Todo lo que sigue está implementado en este repositorio (API en `apps/api`, web en `apps/web`).

### Órdenes y cuentas de cobro
- Estados `recibida → cotizada → en_proceso → terminada → pagada`, más `anulada` (exige motivo y deja rastro). Las transiciones permitidas están definidas en `packages/shared/src/enums.ts`.
- Líneas de tipo repuesto (del inventario), servicio (del catálogo) u "otro"; descuento; kilometraje; descripción de "qué le pasa"; fotos del estado de entrada.
- Cobro en efectivo, Nequi, transferencia u otro, con recargo por método y fecha de garantía calculada (pago + días configurados).
- Salidas de la cuenta de cobro: **texto listo para WhatsApp**, **PDF** (generado en el navegador con `@react-pdf/renderer`, con respaldo en la API con `pdfkit`) y **link público** `/cc/<taller>/<número>` que no muestra costos internos.
- Órdenes de garantía enlazadas a la orden original.

### Inventario
- Productos con referencia, código de barras, marca, categoría, modelos compatibles, costo, precio, stock mínimo, ubicación y fotos.
- **Entrada por foto de etiqueta**: la IA lee referencia, nombre, marca, categoría y precio impreso; la persona confirma o corrige antes de guardar.
- Entradas (con opción de registrar el gasto en caja), ajustes por conteo, historial de movimientos y filtro de stock bajo.
- Importar desde Excel o CSV y exportar a Excel.

### Clientes y vehículos
- Clientes con teléfono de WhatsApp, documento y notas; varios vehículos por cliente (moto o carro, marca, modelo, placa, año, color, kilometraje).
- Búsqueda por placa, nombre o teléfono; historial de órdenes y garantías vigentes por vehículo.

### Caja y reportes
- Caja del día: ventas por método de pago, recargos, gastos (con foto del recibo) y neto. Cierre del día (lo puede hacer el cajero) y reapertura (solo dueño o administrador).
- Reportes por periodo: ventas, costo de repuestos, utilidad y margen, ventas por día y por método de pago, repuestos y servicios más vendidos, clientes frecuentes. Exportación a Excel.
- Panel de inicio con ventas de hoy y del mes, órdenes abiertas, stock bajo y garantías vigentes.

### Asistente por voz y texto
- Dictado con la Web Speech API del navegador en español de Colombia (`es-CO`) y lectura en voz alta opcional.
- Entiende cuentas dictadas ("cambio de aceite, pastillas delanteras NS 200, purga de frenos"), preguntas de precio o stock, consultas de inventario bajo y búsqueda de vehículos por placa.
- **Funciona sin IA**: un buscador local (similitud de texto + números escritos en palabras, como "veintiséis mil") resuelve las consultas sencillas sin gastar créditos. Con `OPENAI_API_KEY` configurada, las frases más complejas pasan a `gpt-4o-mini`.
- Con IA, además propone acciones que la persona confirma antes de ejecutarlas: crear producto, crear cliente con vehículo, registrar entrada de inventario o abrir una cuenta de cobro por número.
- En consultas de precio y stock, la respuesta se arma con los datos del catálogo del taller, nunca con lo que diga el modelo. En una cuenta dictada, si no se dice el precio se usa el del catálogo, y los productos, servicios y clientes que propone el modelo se validan contra los del taller.
- Límite mensual de llamadas de IA por taller (300 por defecto, ajustable por el superadmin) con registro de tokens y costo estimado.

### Equipo, roles y auditoría
- Roles `dueno`, `admin`, `mecanico`, `cajero` y `contador`, con una matriz de permisos única (`packages/shared/src/permissions.ts`) que aplican tanto la API como la interfaz.
- Invitaciones por link con vencimiento de 48 horas, compartibles por WhatsApp.
- Registro de auditoría (quién, qué y cuándo) de cobros, anulaciones, cierres de caja, cambios de precio, ajustes de stock, gestión de usuarios y acciones del superadmin.

### Plataforma y superadmin
- Registro público del taller: crea el taller con un identificador único, el usuario dueño y el catálogo de servicios según el tipo de taller; luego un asistente de bienvenida de 3 pasos.
- Panel de superadmin: talleres con plan y estado (suspender o activar), "entrar como soporte" (impersonación auditada), uso de IA por taller y por mes, usuarios, métricas de los últimos 6 meses y purga irreversible de un taller (exige escribir su identificador exacto).
- Aplicación web instalable (PWA) con interfaz pensada primero para el celular.

## Capturas

### Sitio público

Capturas tomadas de [motattomotocicletas.com](https://motattomotocicletas.com).

| Inicio | Cómo funciona |
|---|---|
| ![Inicio](docs/capturas/sitio-inicio-escritorio.png) | ![Cómo funciona](docs/capturas/sitio-como-funciona-escritorio.png) |
| **Precios** | **Nosotros** |
| ![Precios](docs/capturas/sitio-precios-escritorio.png) | ![Nosotros](docs/capturas/sitio-nosotros-escritorio.png) |
| **Registro del taller** | **Lo que hace por el taller** |
| ![Registro](docs/capturas/sitio-registro-escritorio.png) | ![Funciones](docs/capturas/sitio-funciones-escritorio.png) |

En el celular (390 × 844):

<p>
  <img src="docs/capturas/sitio-inicio-movil.png" width="19%" alt="Inicio en el celular" />
  <img src="docs/capturas/sitio-como-funciona-movil.png" width="19%" alt="Cómo funciona en el celular" />
  <img src="docs/capturas/sitio-precios-movil.png" width="19%" alt="Precios en el celular" />
  <img src="docs/capturas/sitio-nosotros-movil.png" width="19%" alt="Nosotros en el celular" />
  <img src="docs/capturas/sitio-registro-movil.png" width="19%" alt="Registro en el celular" />
</p>

### App del taller

> Estas capturas se tomaron con el proyecto corriendo en local y **datos ficticios**: el taller "Taller Demo Moteros" y clientes marcados "(demo)". No contienen información de clientes reales.

**Panel de inicio**: ventas de hoy y del mes, órdenes abiertas, stock bajo y garantías vigentes.

![Panel del taller](docs/capturas/app-panel-escritorio.png)

**Cuenta de cobro**: detalle de la orden con envío por WhatsApp, texto, PDF y link público; las líneas de repuesto muestran lo que se descontó del inventario.

![Detalle de una cuenta de cobro](docs/capturas/app-cuenta-de-cobro-escritorio.png)

| Lista de órdenes por estado | Link público que recibe el cliente |
|---|---|
| ![Órdenes](docs/capturas/app-ordenes-escritorio.png) | ![Cuenta de cobro pública](docs/capturas/app-cuenta-publica-escritorio.png) |

**Asistente**: a la izquierda, una cuenta dictada convertida en líneas con precios del catálogo; a la derecha, consultas de precio y de stock bajo.

| Dictar la cuenta | Preguntar precio y stock |
|---|---|
| ![Asistente: dictado](docs/capturas/app-asistente-dictado-escritorio.png) | ![Asistente: consultas](docs/capturas/app-asistente-consultas-escritorio.png) |

| Inventario | Movimientos de un producto |
|---|---|
| ![Inventario](docs/capturas/app-inventario-escritorio.png) | ![Producto con movimientos](docs/capturas/app-producto-movimientos-escritorio.png) |
| **Clientes** | **Historial y garantía de un vehículo** |
| ![Clientes](docs/capturas/app-clientes-escritorio.png) | ![Historial del vehículo](docs/capturas/app-vehiculo-historial-escritorio.png) |
| **Caja del día** | **Reportes** |
| ![Caja](docs/capturas/app-caja-escritorio.png) | ![Reportes](docs/capturas/app-reportes-escritorio.png) |

En el celular, que es donde se usa en el taller:

<p>
  <img src="docs/capturas/app-panel-movil.png" width="19%" alt="Panel en el celular" />
  <img src="docs/capturas/app-cuenta-de-cobro-movil.png" width="19%" alt="Cuenta de cobro en el celular" />
  <img src="docs/capturas/app-asistente-movil.png" width="19%" alt="Asistente en el celular" />
  <img src="docs/capturas/app-inventario-movil.png" width="19%" alt="Inventario en el celular" />
  <img src="docs/capturas/app-cuenta-publica-movil.png" width="19%" alt="Cuenta de cobro pública en el celular" />
</p>

## Cómo funciona

```mermaid
flowchart LR
  subgraph Navegador["Navegador · PWA"]
    WEB["apps/web<br/>React + Vite + Tailwind"]
  end
  CLIENTE["Cliente del taller<br/>link público de la cuenta"] --> WEB
  WEB -- "HTTPS + JWT" --> API["apps/api<br/>Express + Mongoose + Zod"]
  API --> DB[("MongoDB<br/>datos de cada taller con tenantId")]
  API --> R2[("Cloudflare R2<br/>fotos privadas")]
  API -. "opcional" .-> IA["OpenAI<br/>gpt-4o-mini y whisper-1"]
  SHARED["packages/shared<br/>tipos, esquemas Zod y permisos"] -.- WEB
  SHARED -.- API
```

**Monorepo con npm workspaces**

```
apps/web         Frontend React + Vite + TypeScript + Tailwind (PWA). Se despliega en Vercel.
apps/api         API Node + Express + Mongoose. Se despliega en Railway con el Dockerfile de la raíz.
packages/shared  Tipos, esquemas Zod, catálogos iniciales, matriz de permisos y formato de la cuenta de cobro.
docs/            Documentación del producto (alcance, roles, flujos, modelo de datos, arquitectura).
```

`packages/shared` es el contrato entre las dos aplicaciones: la API valida las peticiones con esquemas Zod compartidos, que también usan los formularios de la web, y la interfaz oculta botones con la misma función `can(rol, permiso)` que la API usa para rechazar la petición.

**Multitenancy.** Hay una sola base de datos y cada documento que pertenece a un taller lleva `tenantId`. El middleware de autenticación verifica el JWT, carga al usuario y toma el `tenantId` de su cuenta (nunca del cuerpo de la petición); todas las consultas de las rutas del taller se filtran con él. El superadmin puede actuar sobre un taller con la cabecera `X-Tenant-Id` o con un token de impersonación que queda en la auditoría. Un taller suspendido recibe `403 TENANT_SUSPENDED`. Las pruebas de `tenancy.test.ts` y `files.test.ts` verifican que un taller no pueda leer, cambiar ni listar datos ni fotos de otro.

**Archivos.** Las fotos (etiquetas y fotos de productos, estado de entrada de las órdenes, recibos de gastos y logo del taller) se guardan en un bucket **privado** de Cloudflare R2 bajo `tenants/<tenantId>/...` y la API las entrega en `/api/files/...` solo si pertenecen al taller de la sesión. Sin R2 configurado, se guardan en disco local (`apps/api/uploads`).

**Asistente.** El texto dictado pasa primero por un intérprete local que busca en el catálogo e inventario del taller. Si la consulta se resolvió ahí, o no hay `OPENAI_API_KEY`, o el taller llegó a su límite mensual, no se llama al modelo. Si se llama, el modelo recibe solo los candidatos relevantes del catálogo y su respuesta se valida y se "aterriza" de nuevo contra el catálogo antes de mostrarla.

**Ciclo de una orden**

```mermaid
flowchart LR
  R[recibida] --> C[cotizada] --> P[en_proceso] --> T[terminada] -- "cobro" --> G[pagada]
  R & C & P & T & G -.-> A["anulada<br/>(exige motivo)"]
```

Al pasar a `terminada` (o al cobrar), el sistema pregunta qué repuestos descontar del inventario. Se puede cobrar desde cualquier estado abierto. Al anular, el stock descontado se devuelve y los pagos quedan marcados como anulados.

**Datos (MongoDB).** Colecciones: `tenants`, `users`, `customers`, `vehicles`, `products`, `stockmovements`, `services`, `orders`, `payments`, `expenses`, `cashclosings`, `counters` (consecutivos por taller y año), `auditlogs` y `aiusages`. Más detalle en [`docs/Modelo-de-datos.md`](docs/Modelo-de-datos.md).

**Seguridad.** Contraseñas con bcrypt, JWT, Helmet, CORS limitado a los orígenes configurados, límite de peticiones en `/api/auth` y validación Zod en los endpoints.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS 3, TanStack Query, React Router, React Hook Form, `@react-pdf/renderer`, `vite-plugin-pwa` |
| API | Node.js (20 o superior; la imagen de Docker usa 22), Express 4, Mongoose 8, Zod, JWT, bcryptjs, Helmet, express-rate-limit, pino |
| Documentos | `pdfkit` (PDF en la API), `exceljs` (importar y exportar Excel), `multer` (subida de archivos) |
| Base de datos | MongoDB 7 |
| Archivos | Cloudflare R2 (API compatible con S3, `@aws-sdk/client-s3`) |
| IA (opcional) | OpenAI `gpt-4o-mini` (visión y texto) y `whisper-1` (transcripción) |
| Pruebas | Vitest, Supertest, mongodb-memory-server |
| Infraestructura | Vercel (web), Railway con Docker (API y MongoDB), DNS en Namecheap |

## Correr en local

**Requisitos:** Node.js 20 o superior, npm y una base MongoDB. El repositorio trae un `docker-compose.yml` que levanta MongoDB 7 en el puerto 27017; si no usas Docker, cualquier MongoDB sirve apuntando `MONGODB_URI` a ella.

```bash
git clone https://github.com/ronalc90/motattomotocicletas.git
cd motattomotocicletas

npm ci                                   # instala todos los workspaces
cp apps/api/.env.example apps/api/.env   # los valores de ejemplo apuntan a localhost
docker compose up -d                     # MongoDB 7 en localhost:27017 (opcional)

npm run build -w packages/shared         # compila el contrato compartido (una vez, o al cambiarlo)
npm run dev -w apps/api                  # API en http://localhost:4000
npm run dev -w apps/web                  # web en http://localhost:5173 (en otra terminal)
```

La web de desarrollo redirige `/api` y `/uploads` a `localhost:4000`, así que no hace falta configurar nada más. Abre `http://localhost:5173/registro` y registra un taller para empezar.

Datos de ejemplo, si los quieres:

```bash
npm run seed -w apps/api                                    # superadmin y un taller de ejemplo con una orden pagada
npm run accounts -w apps/api -- create-test-accounts        # un taller de prueba con un usuario por rol (contraseñas al azar, se muestran una vez)
```

**Variables de entorno de la API** (`apps/api/.env.example`):

| Variable | Para qué sirve |
|---|---|
| `NODE_ENV`, `PORT` | Entorno y puerto (4000 por defecto). |
| `MONGODB_URI` | Conexión a MongoDB. |
| `JWT_SECRET`, `JWT_EXPIRES` | Firma y duración de las sesiones. |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma. |
| `WEB_URL` | URL del frontend, usada en links de invitación y de cuentas públicas. |
| `API_PUBLIC_URL` | Opcional. Prefijo de las URLs de `/uploads` cuando no hay R2. |
| `OPENAI_API_KEY` | Opcional. Activa la lectura de etiquetas, el asistente con IA y la transcripción. Sin ella, todo funciona con el intérprete local. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | Opcional. Cloudflare R2 para las fotos; sin ellas se usa el disco local. |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SEED_OWNER_PASSWORD` | Cuentas que crea el script `seed`. Defínelas antes de sembrar. |
| `SEED_TOKEN` | Habilita el endpoint de siembra remota del superadmin. |

**Variable de la web** (`apps/web/.env.example`): `VITE_API_URL`, la URL base de la API. Vacía en local, para usar el proxy de Vite.

Otros comandos de la raíz: `npm run build` (compila shared, API y web), `npm run typecheck` y `npm test`.

## Pruebas

```bash
npm test
```

Son **65 pruebas** en 12 archivos (`apps/api/test`), escritas con Vitest y Supertest contra una MongoDB en memoria (`mongodb-memory-server`, que descarga el binario de MongoDB la primera vez). No necesitan base de datos ni claves externas: la IA se prueba en su modo sin clave.

| Archivo | Qué verifica |
|---|---|
| `tenancy.test.ts` | Aislamiento entre talleres: un taller no puede leer, editar ni listar datos de otro. |
| `roles.test.ts`, `permissions.test.ts` | Matriz de permisos por rol, invitaciones, impersonación y talleres suspendidos. |
| `orders.test.ts`, `edge.test.ts` | Flujo completo de una orden, descuento de stock, cobro con recargo, anulación y casos borde de caja e inventario. |
| `products.test.ts` | Movimientos, ajustes, stock bajo, búsqueda, importación y exportación. |
| `public.test.ts` | Cuenta de cobro pública en JSON y PDF sin sesión y sin costos internos. |
| `files.test.ts` | Fotos privadas: un taller no puede pedir las fotos de otro. |
| `assistant.test.ts` | Números en palabras, intérprete local y acciones del asistente sin gastar IA. |
| `aiUsage.test.ts` | Registro de uso de IA por taller y mes, y límite mensual. |
| `superadminControl.test.ts` | Gestión de usuarios, métricas y purga de talleres por el superadmin. |
| `seed.test.ts` | El seed es idempotente y el endpoint de siembra exige `SEED_TOKEN`. |

## Despliegue

Lo que define este repositorio:

- **API en Railway.** `railway.json` construye con el `Dockerfile` de la raíz (Node 22 Alpine, en dos etapas: compila `packages/shared` y `apps/api` y deja solo `dist` y dependencias). Arranca con `node apps/api/dist/index.js` y usa `/health` como chequeo de salud.
- **Web en Vercel.** Directorio raíz `apps/web`, comando de build `cd ../.. && npm ci && npm run build:web`, salida `dist` y `VITE_API_URL` apuntando a la API. `apps/web/vercel.json` reescribe todas las rutas a `index.html` (SPA).
- **Dominio.** `motattomotocicletas.com` (web) y `api.motattomotocicletas.com` (API), con DNS en Namecheap. En la API, `CORS_ORIGINS` y `WEB_URL` deben apuntar al dominio de la web.

Los pasos completos están en [`docs/Arquitectura-y-despliegue.md`](docs/Arquitectura-y-despliegue.md) y en los README de [`apps/api`](apps/api/README.md) y [`apps/web`](apps/web/README.md).

## Estado del proyecto

- **En producción** en [motattomotocicletas.com](https://motattomotocicletas.com) (web) y `api.motattomotocicletas.com` (API). El primer taller de la plataforma es Motatto Motocicletas.
- **Implementado:** registro y onboarding de talleres, clientes y vehículos, catálogo de servicios, inventario con fotos y entrada por etiqueta, órdenes con estados y descuento confirmado de stock, cuenta de cobro en texto, PDF y link público, caja con cierre del día, reportes con Excel, asistente por voz y texto, roles con auditoría y panel de superadmin.
- **Planes:** la página de precios publica un plan **Gratis** ($0) y un plan **Pro** ($49.900 COP al mes). Hoy el plan lo asigna el superadmin desde su panel; el cobro de la suscripción y los límites por plan todavía no están implementados en el código.
- **Pendiente** ([`docs/Roadmap.md`](docs/Roadmap.md)): cobro de suscripciones, portal del cliente final, envío por la API oficial de WhatsApp, conteo de estante por foto, facturación electrónica DIAN y lectura automática de la placa por foto (hoy la placa se escribe).
- Sin integración continua configurada en el repositorio: las pruebas y el chequeo de tipos se corren con `npm test` y `npm run typecheck`.

Documentación del producto en [`docs/`](docs/Home.md): alcance y módulos, usuarios y roles, flujos de trabajo, modelo de datos, formato de la cuenta de cobro y manual de usuario.

## Autor

**Ronald Cipagauta**

- Sitio: [koptup.com](https://www.koptup.com)
- GitHub: [@ronalc90](https://github.com/ronalc90)
