# Flujos de trabajo

## F0. Registro de un taller nuevo (onboarding)

```
motattomotocicletas.com → "Registrar mi taller"
   │
   ▼
Nombre del taller · tipo (motos / carros / ambos) · ciudad · WhatsApp
Correo y contraseña del dueño
   │
   ▼
Se crea el tenant (slug) + usuario dueno + configuración por defecto
+ catálogo de servicios según tipo (moto: cambio aceite, pastillas, kit arrastre, cunas…
                                     carro: cambio aceite, pastillas, alineación, batería…)
   │
   ▼
Asistente de 3 pasos (opcionales, se pueden saltar):
   1. Logo y datos para la factura (dirección, Nequi, recargo %, garantía días)
   2. "Toma una foto de tu primer repuesto" → entra al inventario
   3. "Invita a tu mecánico" → link por WhatsApp
   │
   ▼
Panel del taller
```

## F1. Llega un vehículo → factura → cobro

```
[1] Buscar por placa (teclado o cámara OCR) / nombre / teléfono
        └─► no existe → crear cliente + vehículo
[2] Nueva orden: km, "qué le pasa", fotos de entrada              → recibida
[3] Agregar líneas (cualquiera de las tres formas):
        a) 🎤 voz:   "pastillas delanteras, cambio de aceite y filtro, bujía NS 200"
        b) 📷 foto:  escanear etiqueta del repuesto que se va a usar
        c) ⌨️ lista: buscar en inventario / catálogo
    El sistema propone descripción + precio; el usuario confirma.
[4] (opcional) Enviar cotización por WhatsApp                     → cotizada
[5] Trabajar                                                       → en_proceso
[6] Marcar terminada
        └─► PREGUNTA de inventario (ver F3)                        → terminada
[7] Cobrar: efectivo / Nequi (+%) / transferencia                  → pagada
        └─► se registra el pago en caja, se calcula garantía_hasta
[8] Enviar: texto WhatsApp · PDF · link público
```

Reglas:
- `pagada` no se edita; se anula (con motivo) y se crea otra.
- Anular una orden `terminada`/`pagada` devuelve al inventario lo que se descontó (movimiento `devolución` automático) y marca el pago como anulado.

## F2. Factura por voz (detalle)

```
🎤 Usuario mantiene presionado el micrófono y dice:
   "Moto de Ronal, la Gixxer. Kit de arrastre, cambio de kit, aceite, filtro,
    cambio de aceite y filtro, pastillas traseras y delanteras, purga de frenos"
   │
   ▼
Transcripción (Web Speech API en el navegador; fallback: audio al servidor)
   │
   ▼
Interpretación (LLM con el inventario y catálogo del taller como contexto):
   → cliente: "Ronal" · vehículo: "Gixxer 250"
   → líneas: [Kit arrastre ×1 $274.000 (inventario)] [Cambio kit arrastre $25.000 (servicio)] …
   → ítems no reconocidos → se listan como "otro" sin precio para que el usuario complete
   │
   ▼
Pantalla de confirmación: cada línea con ✔ / ✎ / 🗑 y el total
   │
   ▼
"Confirmar" → se crea la orden con esas líneas (estado recibida o terminada, según elija)
```

Consultas rápidas por voz (no crean nada): "¿cuánto vale la bujía de NS 200?" → "Bujía central NS 200: $32.000, hay 4 en stock". "¿Qué le hicimos a la placa ABC123?" → último servicio y fecha.

## F3. Descuento de inventario con confirmación

Al pasar una orden a `terminada` (o al confirmar una factura por voz) si tiene líneas de tipo repuesto:

```
┌──────────────────────────────────────────────┐
│ ¿Descontar del inventario?                   │
│  ☑ Kit arrastre            1 ud  (stock 3→2) │
│  ☑ Pastillas traseras      1 ud  (stock 5→4) │
│  ☐ Aceite 20W50            1 ud  ⚠ stock 0   │
│                                              │
│  [Descontar lo marcado]  [No descontar nada] │
└──────────────────────────────────────────────┘
```
- Desmarcar = "el repuesto lo trajo el cliente" o "lo compré para esta moto y no pasó por el estante".
- Lo que queda en stock 0 o negativo se marca y sugiere una entrada.
- Se guarda quién confirmó y qué se descontó (`stockDescontado: [...]`) para no repetir.

## F4. Entrada de mercancía con fotos

```
Inventario → "Entrada" → 📷 foto de la etiqueta (una o varias seguidas)
   │
   ▼
OCR + IA extraen: código / referencia (JG351209), nombre (Bujía…), marca (Bajaj),
precio impreso, fecha de fabricación. Se busca si ya existe por código o referencia.
   │
   ├─► existe → "¿Cuántas entraron? costo unitario?" → movimiento entrada
   └─► nuevo  → formulario prellenado (nombre, ref, marca, categoría sugerida,
                compatible con, costo, precio de venta sugerido) → crear + entrada
   │
   ▼
Foto queda guardada en el producto · opción "ya pagué: registrar como gasto"
```

Sin cámara o sin conexión: el formulario manual es el mismo.

## F5. Conteo y ajuste
Inventario → producto → "Ajustar" → cantidad real → diferencia como movimiento `ajuste` con motivo y usuario. Fase 2: foto del estante para contar varios a la vez.

## F6. Caja y cierre del día
Caja → pagos del día por método · gastos (con foto del recibo opcional) → "Cerrar día" → totales guardados. Solo dueno/admin reabren.

## F7. Garantía
Vehículo vuelve dentro del plazo → el historial muestra "garantía vigente hasta…" → nueva orden marcada "garantía de MT-2026-00XX".

## F8. Cliente final ve su factura
Link público `…/cc/<numero>` → factura de solo lectura con datos del taller, líneas, total, métodos de pago, garantía. Sin costos, sin stock, sin login. Botón "Guardar PDF".

## F9. Superadmin
Lista de talleres → uso (facturas/mes, usuarios, productos) → suspender · activar · "entrar como soporte" (queda registrado) · cambiar plan.

## Mapa de pantallas

| Ruta | Pantalla | Roles |
|---|---|---|
| `/` | Landing + registro de taller | público |
| `/registro` · `/login` · `/invitacion/:token` | Alta, ingreso, aceptar invitación | público |
| `/app` | Panel del taller | todos |
| `/app/ordenes` · `/nueva` · `/:id` | Órdenes y facturas | todos |
| `/app/asistente` | Voz / chat | todos menos contador |
| `/app/clientes` · `/:id` | Clientes y vehículos | todos |
| `/app/inventario` · `/:id` · `/entrada` | Productos, movimientos, entrada por foto | según rol |
| `/app/servicios` | Catálogo | dueno/admin |
| `/app/caja` | Pagos, gastos, cierre | dueno/admin/cajero/contador |
| `/app/reportes` | Reportes | dueno/admin/contador |
| `/app/configuracion` · `/usuarios` | Taller y equipo | dueno/admin |
| `/cc/:numero` | Factura pública | público |
| `/superadmin` | Talleres de la plataforma | superadmin |
