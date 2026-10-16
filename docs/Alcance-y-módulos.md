# Alcance y módulos

## Objetivo

Que el dueño de cualquier taller pueda, desde el celular:

1. Registrar su taller en 2 minutos y empezar a usarlo sin que nadie lo configure.
2. Registrar el vehículo que llega y su dueño.
3. Armar la factura **hablando** ("cambio de aceite, pastillas delanteras, bujía NS 200") o escogiendo de listas.
4. Enviarla por WhatsApp y cobrar (efectivo / Nequi con recargo configurable).
5. Que el inventario se actualice solo: con **fotos** de las etiquetas al entrar mercancía y con **descuento confirmado** al usar repuestos.
6. Ver la plata del día y qué le falta en el estante.

## Principios

- **Multitenant real**: un solo despliegue, muchos talleres. Cada dato lleva `tenantId`; nadie ve datos de otro taller.
- **Motos y carros**: el tipo de taller define vocabulario (moto/carro, placa, cilindraje vs. motor) y catálogos iniciales.
- **Celular primero**, instalable como PWA, cámara y micrófono del teléfono.
- **Nada se borra de verdad**: anular deja rastro.
- **Voz y foto son atajos, no requisitos**: todo se puede hacer también con el teclado.

## Módulos

### 1. Plataforma / tenants
- Registro público de taller: nombre, tipo (`motos` · `carros` · `ambos`), ciudad, teléfono, correo del dueño, contraseña. Genera el `slug` del taller.
- Plan: `gratis` (1 usuario, 200 facturas/mes) · `pro` (ilimitado). La lógica de cobro se deja preparada, no se implementa en fase 1.
- Panel de **superadmin** (nosotros): lista de talleres, estado, uso, suspender/activar, entrar como soporte.
- Configuración del taller: datos, logo, moneda, % recargo Nequi/transferencia, días de garantía, texto de garantía, numeración de facturas (`MT-2026-0001`), catálogos por defecto según tipo de taller.

### 2. Usuarios y roles
Ver [[Usuarios y roles]]. Cada taller tiene su dueño, puede invitar mecánicos, cajero y un contador de solo lectura.

### 3. Clientes y vehículos
- Cliente: nombre, teléfono WhatsApp, documento, notas.
- Vehículo: tipo (moto/carro), marca, modelo, placa, año, color, kilometraje. Un cliente puede tener varios.
- Historial completo por vehículo: órdenes, facturas, garantías, fotos.
- Búsqueda por placa, nombre, teléfono; la placa se puede leer con la cámara (OCR).

### 4. Inventario
- Producto: nombre, referencia, código de barras/QR, marca, categoría, compatible con (modelos), costo, precio de venta, stock, stock mínimo, ubicación, **fotos**.
- **Entrada por foto**: se toma foto de la etiqueta del repuesto → el sistema lee código, referencia, descripción y precio sugerido (OCR + IA) → el usuario confirma/corrige → se crea o actualiza el producto y se registra la entrada. Se guarda la foto como evidencia.
- **Conteo por foto**: foto del estante → lista de productos detectados para ajustar cantidades (fase 2).
- Movimientos: `entrada`, `salida`, `ajuste`, `devolución`. El stock siempre es la suma de movimientos.
- **Descuento con confirmación**: al cerrar una orden que tiene repuestos, el sistema pregunta: "¿Descontar del inventario: 1 bujía NS 200, 1 kit arrastre? [Sí] [No, fue repuesto del cliente] [Elegir]". Solo se descuenta lo confirmado.
- Alertas de stock bajo, lista de compras sugerida.
- Importar/exportar Excel.

### 5. Catálogo de servicios
- Mano de obra con precio sugerido, agrupada por categoría. Catálogo inicial distinto para motos y para carros.
- Precio editable por factura.

### 6. Órdenes y facturas (cuentas de cobro)
Estados: `recibida` → `cotizada` → `en_proceso` → `terminada` → `pagada` · `anulada`.
- Cliente, vehículo, kilometraje, "qué le pasa", fotos del estado de entrada.
- Líneas: repuestos del inventario, servicios del catálogo, o "otro".
- **Captura por voz**: botón de micrófono → el usuario dicta ("dos pastillas delanteras a veintiséis mil, cambio de aceite, purga de frenos") → el sistema transcribe, busca cada ítem en inventario/catálogo, propone las líneas con precios y el usuario confirma. También sirve para preguntar precios: "¿cuánto vale la bujía de NS 200?" → responde con voz/texto.
- Descuento, recargo por método de pago, total automático, consecutivo por taller.
- Garantía: fecha = pago + días configurados.
- Salidas: texto WhatsApp (formato actual), PDF, link público `…/cc/MT-2026-0001`.

### 7. Caja
- Pagos por orden (método, monto, recargo, referencia).
- Gastos del taller.
- Cierre del día con totales por método, recargos, gastos y neto.

### 8. Panel y reportes
- Panel: órdenes abiertas, dinero de hoy, stock bajo, garantías vigentes.
- Reportes: ventas por periodo, utilidad (venta − costo), más vendidos, mecánicos con más órdenes, clientes frecuentes. Exportar Excel.

### 9. Asistente (voz + texto)
Un solo punto de entrada "Habla con tu taller": crear factura, consultar precio, consultar stock, buscar cliente. Fase 1: voz → texto del navegador (Web Speech API) + interpretación con un LLM. Fase 2: voz en el servidor para mejor precisión con ruido de taller.

## Fuera de alcance (por ahora)
- Facturación electrónica DIAN (se deja el modelo listo).
- Agenda/citas.
- Pagos en línea del cliente final.
- Apps nativas en tiendas (PWA cubre).
