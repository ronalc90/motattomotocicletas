# Modelo de datos (MongoDB)

Base de datos **MongoDB** (Railway). ODM: **Mongoose**. Una sola base, colecciones compartidas, **cada documento lleva `tenantId`** y todo índice empieza por `tenantId`. Un middleware en la API inyecta el `tenantId` del usuario autenticado en cada consulta: no hay forma de pedir datos sin tenant (salvo superadmin, que lo indica explícitamente).

Montos: enteros (pesos sin decimales). Fechas: `Date` UTC; el frontend muestra en la zona del taller. Todos los documentos tienen `_id`, `createdAt`, `updatedAt`.

```
tenants ──< users
   │
   ├──< customers ──< vehicles ──< orders ──< payments ──> cashClosings
   │                                  └── items[] (embebidas)
   ├──< products ──< stockMovements
   ├──< services
   ├──< expenses ──> cashClosings
   └──< auditLog
```

## Colecciones

### tenants
```js
{ slug: "motatto", name: "Motatto Motocicletas", type: "motos" | "carros" | "ambos",
  city, phone, address, email,
  plan: "gratis" | "pro", status: "activo" | "suspendido",
  settings: {
    logoUrl, currency: "COP", invoicePrefix: "MT", invoiceNextNumber: 1, invoiceYearReset: true,
    surcharges: [{ method: "nequi", pct: 3 }],           // recargo por método de pago
    warrantyDays: 9, warrantyText: "…", footerText: "Gracias por confiar…",
    paymentInfo: "Nequi 321 422 9804", askStockOnClose: true
  },
  usage: { ordersThisMonth, usersCount, productsCount } }
```
Índices: `slug` único.

### users
```js
{ tenantId, name, email, passwordHash, role: "superadmin"|"dueno"|"admin"|"mecanico"|"cajero"|"contador",
  active, lastLoginAt, invitedBy, inviteToken, inviteExpiresAt }
```
Índices: `email` único global; `{tenantId, role}`.

### customers
```js
{ tenantId, name, phone, document, notes, vehicleIds: [] }
```
Índices: `{tenantId, phone}`, texto en `name`.

### vehicles
```js
{ tenantId, customerId, kind: "moto"|"carro", brand, model, plate, year, color, lastKm, photos: [] }
```
Índices: `{tenantId, plate}` único parcial; `{tenantId, customerId}`.

### products
```js
{ tenantId, name, reference, barcode, brand, category, compatibleWith: ["NS 200"],
  cost, price, stock, minStock, location, photos: [{ url, source: "label"|"shelf", at }],
  active, lastLabelOcr: { raw, parsed, at } }
```
Índices: `{tenantId, barcode}`, `{tenantId, reference}`, texto en `name/reference/brand/compatibleWith`.

### stockMovements
```js
{ tenantId, productId, type: "entrada"|"salida"|"ajuste"|"devolucion",
  qty,               // +entrada, -salida, ±ajuste, +devolucion
  unitCost, orderId, supplier, note, photoUrl, userId }
```
`products.stock` se recalcula en cada movimiento (transacción). Índice `{tenantId, productId, createdAt}`.

### services
```js
{ tenantId, name, category, suggestedPrice, active }
```

### orders
```js
{ tenantId, number: "MT-2026-0001", customerId, vehicleId, km, description,
  status: "recibida"|"cotizada"|"en_proceso"|"terminada"|"pagada"|"anulada",
  items: [{ type: "repuesto"|"servicio"|"otro", productId, serviceId, description,
            qty, unitPrice, unitCost, total, pos }],
  subtotal, discount, surcharge, total,
  stockDeducted: [{ productId, qty, movementId }],   // lo que se confirmó descontar
  photos: [], internalNotes,
  warrantyUntil, warrantyOfOrderId,
  paidAt, voidedAt, voidedBy, voidReason,
  source: "manual"|"voz"|"foto", voiceTranscript,
  createdBy, assignedTo }
```
Índices: `{tenantId, number}` único; `{tenantId, status, createdAt}`; `{tenantId, vehicleId}`.

### payments
```js
{ tenantId, orderId, method: "efectivo"|"nequi"|"transferencia"|"otro",
  amount, surcharge, reference, closingId, userId, voided }
```

### expenses
```js
{ tenantId, concept, category: "repuestos"|"arriendo"|"servicios"|"herramienta"|"otro",
  amount, date, movementId, receiptPhotoUrl, closingId, userId }
```

### cashClosings
```js
{ tenantId, date, totals: { efectivo, nequi, transferencia, surcharges, expenses, net },
  closedBy, reopened }
```
Índice `{tenantId, date}` único.

### auditLog
```js
{ tenantId, userId, action, entity, entityId, before, after, ip }
```
Se escribe en: pagos, anulaciones, ajustes de inventario, cambios de precio, cambios de usuarios, "entrar como soporte".

### Archivos (fotos, PDFs, audio)
No van en Mongo. Se suben a un bucket S3-compatible (Cloudflare R2 o Railway Volume en fase 1) y se guarda la URL. Ruta: `tenants/<tenantId>/<colección>/<id>/<archivo>`.

## Aislamiento multitenant — reglas
1. Toda consulta pasa por `withTenant(req)` que agrega `{ tenantId }` al filtro. Está probado con tests que intentan leer datos de otro tenant.
2. Los `_id` son ObjectId; aun así nunca se confía en que un id pertenezca al tenant: siempre `{ _id, tenantId }`.
3. Las fotos se sirven con URL firmada temporal, no pública.
4. `users.email` es único en toda la plataforma: un correo = un taller (fase 1).

## Datos semilla
- Tenant `motatto` con la configuración actual (recargo Nequi 3 %, garantía 9 días, texto de política).
- Usuario dueño.
- Servicios de moto: cambio de aceite y filtro $10.000, cambio pastillas $10.000, cambio kit arrastre $25.000, cambio cunas $100.000, purga frenos $70.000, pinta $25.000.
- Producto: Bujía central NS 200, ref `JG351209`, Bajaj, precio $32.000.
- Plantillas de catálogo para `carros`.
