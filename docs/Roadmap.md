# Roadmap

Cada fase termina desplegada en producción y usable. Motatto empieza a usar el sistema desde la fase 1.

## Fase 0 — Base (esta semana)
- Monorepo, API con login multitenant, Mongo en Railway, web en Vercel, dominio apuntando.
- Registro de taller + onboarding mínimo.
- **Listo cuando**: `motattomotocicletas.com` carga, se puede registrar un taller e iniciar sesión, la API responde en `api.motattomotocicletas.com/health`.

## Fase 1 — Reemplaza el generador actual
- Clientes y vehículos.
- Catálogo de servicios con semilla por tipo de taller.
- Inventario manual (crear producto, entrada, salida, ajuste) + alerta de stock bajo.
- Órdenes con líneas, estados, descuento de stock **con confirmación**, cobro con recargo, garantía.
- Cuenta de cobro: texto WhatsApp, PDF, link público.
- Panel básico.
- **Listo cuando**: Motatto hace una semana completa de facturas solo con el sistema y no necesita el generador viejo.

## Fase 2 — Cámara y voz
- Entrada de inventario por foto de etiqueta (OCR + IA) con confirmación.
- Lectura de placa por cámara.
- Asistente por voz: crear factura dictando, consultar precios y stock.
- **Listo cuando**: se puede meter un repuesto nuevo al inventario solo con una foto y hacer una factura de 5 líneas dictando, con ≥ 90 % de líneas correctas sin corregir.

## Fase 3 — Operación completa
- Caja: pagos, gastos con foto de recibo, cierre del día.
- Reportes y exportación Excel.
- Usuarios e invitaciones con roles completos; auditoría.
- Superadmin.
- **Listo cuando**: el dueño cierra el día desde el celular y el contador saca el mes a Excel.

## Fase 4 — Plataforma
- Planes y cobro de suscripción.
- Portal del cliente final (historial de su vehículo).
- WhatsApp API oficial para envío automático.
- Conteo de estante por foto.
- Facturación electrónica (si algún taller lo requiere).

## Convenciones
- Ramas `feat/<módulo>`, PR a `main`, CI verde antes de merge.
- Cada módulo: endpoint(s) + pantalla + test de aislamiento multitenant + página en `docs/`.
- Idioma de la UI y de la documentación: español. Código: inglés.
