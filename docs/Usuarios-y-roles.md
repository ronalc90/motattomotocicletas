# Usuarios y roles

## Tipos de usuario

| Rol | Quién es | Ámbito |
|---|---|---|
| `superadmin` | Nosotros, los operadores de la plataforma | Toda la plataforma, todos los talleres |
| `dueno` | Dueño del taller; quien registró el tenant | Su taller, todo |
| `admin` | Persona de confianza del dueño (socio, administrador) | Su taller, todo menos borrar el taller y facturación del plan |
| `mecanico` | Trabaja las motos/carros | Órdenes, inventario (ver y descontar), clientes. No ve dinero ni costos |
| `cajero` | Cobra y cierra caja | Facturas, pagos, caja, clientes. No edita inventario ni precios |
| `contador` | Revisa números | Solo lectura de reportes, caja y facturas; exporta Excel |
| `cliente` (público) | Dueño del vehículo | Sin cuenta: ve su factura por link público. Fase 2: portal con historial de su vehículo |

## Matriz de permisos

| Módulo / acción | superadmin | dueno | admin | mecanico | cajero | contador |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Ver todos los talleres | ✅ | | | | | |
| Configurar taller (datos, recargos, garantía) | ✅ | ✅ | ✅ | | | |
| Invitar / quitar usuarios | ✅ | ✅ | ✅ | | | |
| Clientes y vehículos: ver / crear / editar | ✅ | ✅ | ✅ | ✅ | ✅ | ver |
| Órdenes: crear / editar líneas | ✅ | ✅ | ✅ | ✅ | ✅ | ver |
| Órdenes: cambiar precio de línea | ✅ | ✅ | ✅ | | ✅ | |
| Órdenes: aplicar descuento | ✅ | ✅ | ✅ | | | |
| Órdenes: marcar terminada (descuento stock) | ✅ | ✅ | ✅ | ✅ | | |
| Órdenes: cobrar / registrar pago | ✅ | ✅ | ✅ | | ✅ | |
| Órdenes: anular | ✅ | ✅ | ✅ | | | |
| Inventario: ver stock | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inventario: ver costo de compra | ✅ | ✅ | ✅ | | | ✅ |
| Inventario: entrada por foto / crear producto | ✅ | ✅ | ✅ | ✅ | | |
| Inventario: ajustes y precios de venta | ✅ | ✅ | ✅ | | | |
| Servicios: editar catálogo | ✅ | ✅ | ✅ | | | |
| Caja: gastos y cierre del día | ✅ | ✅ | ✅ | | ✅ | ver |
| Reportes | ✅ | ✅ | ✅ | | | ✅ |
| Asistente por voz | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Borrar el taller / cambiar plan | ✅ | ✅ | | | | |

## Reglas
- Un usuario pertenece a **un** taller (salvo superadmin). Si una persona trabaja en dos talleres usa dos cuentas (correo + sufijo) — simplifica el aislamiento en fase 1.
- El dueño no se puede quitar a sí mismo; puede transferir la propiedad.
- Invitación por link con vencimiento de 48 h; el invitado crea su contraseña.
- Toda acción de dinero, anulación o ajuste de inventario guarda `userId` en el registro (auditoría).
- Login: correo + contraseña, sesión JWT de larga duración en el celular, cierre de sesión remoto desde el panel del dueño.
