# Manual de usuario

Guía rápida por tipo de usuario. Todo funciona desde el celular (Chrome en Android es el recomendado por el dictado por voz) y se puede instalar como app desde el menú del navegador ("Agregar a pantalla de inicio").

## 1. Dueño del taller (y administrador)

### Registrar tu taller
1. Entra a `motattomotocicletas.com` → **Registrar mi taller**.
2. Nombre del taller, tipo (motos / carros / ambos), ciudad, WhatsApp, tu nombre, correo y contraseña.
3. Te lleva a **Bienvenida** (3 pasos, todos se pueden saltar): logo y datos de la factura, primer repuesto por foto, invitar a tu mecánico.

### Configurar la factura (Configuración → Taller)
- Logo, slogan, dirección, teléfono.
- **Info de pago** (ej. "Nequi 321 422 9804") y **recargos** por método (Nequi 3 %).
- **Garantía**: días y texto de la política.
- Prefijo de numeración (MT → MT-2026-0001).
- "Preguntar antes de descontar stock" (recomendado: encendido).

### Invitar a tu equipo (Configuración → Usuarios)
- **Invitar** → nombre, correo y rol → copia el link o **compártelo por WhatsApp**. Vence en 48 h.
- Roles: Administrador (todo menos borrar el taller), Mecánico (órdenes e inventario, no ve dinero), Cajero (cobra y cierra caja), Contador (solo lectura y Excel).

### Día a día
Ver sección 2; el dueño puede hacer todo lo que hacen los demás.

### Reportes
Reportes → rango de fechas → ventas, costo, utilidad, más vendidos, mejores clientes → **Exportar Excel**.

## 2. Equipo del taller (mecánico, cajero)

### Llega un vehículo
1. **Órdenes → Nueva** → busca por placa, nombre o teléfono. Si no existe, créalo ahí mismo con su vehículo.
2. Kilometraje y "qué le pasa". Fotos del estado de entrada si quieres.
3. Agrega líneas: **Repuesto** (busca en inventario), **Servicio** (del catálogo) u **Otro**. Ajusta cantidad y precio.
4. Guarda como **Recibida** (o **Cotizada** si vas a enviar cotización).

### Factura por voz
Botón del **micrófono** (en Nueva orden o en Asistente) → mantén presionado y di por ejemplo:
> "Moto de Ronal, cambio de aceite y filtro, pastillas delanteras y bujía NS 200"

El sistema propone las líneas con precios. Revisa, corrige y **Crear orden con esto**.
También puedes preguntar: "¿cuánto vale la bujía de NS 200?", "¿hay kit de arrastre?", "placa ABC123".

### Terminar el trabajo
Orden → **Terminada** → aparece la pregunta **¿Descontar del inventario?** con cada repuesto y el stock antes → después. Desmarca lo que trajo el cliente. **Descontar lo marcado**.

### Cobrar
Orden → **Cobrar** → método (efectivo / Nequi +3 % / transferencia) → confirmar. La orden queda **Pagada** y la garantía empieza a contar.

### Enviar la cuenta de cobro
En la orden: **WhatsApp** (abre el chat del cliente con el texto), **Copiar texto**, **Descargar PDF** o **Ver pública** (link para compartir).

### Entrada de repuestos por foto
**Inventario → Entrada por foto** → toma foto de la etiqueta → el sistema lee referencia, nombre, marca → confirma cantidad y costo → listo. Si ya existe el producto, solo suma stock.

### Caja (cajero / dueño)
**Caja** → ver pagos del día por método, registrar gastos (con foto del recibo) → **Cerrar día**.

## 3. Cliente del taller

No necesitas cuenta. El taller te envía un link como `motattomotocicletas.com/cc/motatto/MT-2026-0001`:
- Ves tu cuenta de cobro completa, el total y la garantía vigente.
- **Descargar PDF**, **Copiar texto**, **Escribir al taller** por WhatsApp.

## 4. Administrador de la plataforma (superadmin)

`/superadmin` → lista de talleres, plan, estado, uso (facturas del mes, usuarios, productos).
- **Cambiar plan** / **Suspender** / **Activar**.
- **Entrar como soporte**: entras a la app del taller con permisos de dueño; queda registrado en auditoría; "Salir del modo soporte" te regresa.

## Preguntas frecuentes
- **¿Puedo editar una factura pagada?** No. Anúlala (queda rastro y el stock se devuelve) y crea otra.
- **¿El dictado no funciona?** Usa Chrome (Android o computador). En iPhone/Safari escribe el texto en el asistente.
- **¿Qué pasa si no tengo internet?** La app abre, pero necesitas conexión para guardar.
- **¿Mis datos son míos?** Sí. Exporta inventario y reportes a Excel cuando quieras.
