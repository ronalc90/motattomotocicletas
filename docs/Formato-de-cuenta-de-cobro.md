# Formato de cuenta de cobro

Se conserva el formato que el taller ya usa (y que sus clientes reconocen), ahora generado desde la orden. Tres salidas con el mismo contenido:

1. **Texto plano** → botón "Enviar por WhatsApp" (abre `wa.me` con el texto) o "Copiar".
2. **PDF** → con logo, para imprimir o adjuntar.
3. **Link público** → `motattomotocicletas.com/cc/MT-2026-0001`.

## Plantilla de texto

Las partes entre `{{ }}` salen de la configuración del taller o de la orden.

```
{{taller.nombre}}
{{taller.slogan}}
{{taller.direccion}}
Teléfono: {{taller.telefono}}

----------------------------------------
CUENTA DE COBRO {{orden.numero}}
Generada el: {{orden.fecha}}

Cliente:
{{cliente.nombre}} — {{vehiculo.modelo}} {{vehiculo.placa}}

Descripción                      Valor (COP)
{{#cada linea}}
{{linea.descripcion}} {{linea.cantidad>1 ? "x"+cantidad}}   {{linea.total}}
{{/cada}}
----------------------------------------
{{#si descuento}}Descuento: -{{descuento}}{{/si}}
{{#si recargo}}Recargo {{metodo}} ({{pct}}%): {{recargo}}{{/si}}
TOTAL: {{total}}

Métodos de Pago:
- Efectivo
- Transferencia: {{taller.paymentInfo}} (⚠️ Los pagos por Nequi tienen un cargo adicional del {{pct}}%)

----------------------------------------
Política de Garantía:
{{taller.warrantyText}}
{{#si pagada}}Garantía vigente hasta: {{orden.garantiaHasta}}{{/si}}
{{taller.footerText}}
----------------------------------------
```

## Texto de garantía por defecto (tenant Motatto)
- ✅ Los trabajos realizados tienen una garantía de 9 días, siempre y cuando los repuestos sean adquiridos con nosotros.
- ⚡ Las partes eléctricas no tienen garantía.
- ❗ En casos de reparación de motor, cambio de discos de embrague y similares, el taller no se hace responsable por el mal manejo del cliente.

Cada taller edita este texto y el pie en Configuración.

## Formato de números
`274.000` (punto de miles, sin decimales, sin símbolo en la tabla; "COP" en el encabezado).

## Numeración
`{{prefijo}}-{{año}}-{{consecutivo de 4 dígitos}}`, reinicia cada año si el taller lo configura así. Nunca se reutiliza un número, incluso si la orden se anula.
