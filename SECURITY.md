# Política de seguridad

## Versiones soportadas

Solo la rama `main` recibe correcciones de seguridad: es la que está desplegada (la web en Vercel y la API en Railway). Las demás ramas y los commits anteriores no tienen soporte.

| Versión | Soporte |
| --- | --- |
| `main` (desplegada) | Sí |
| Otras ramas y commits anteriores | No |

## Cómo reportar una vulnerabilidad

Escribe en privado a **ronalddemiancipagauta@gmail.com** con el asunto `[Seguridad] motattomotocicletas: <resumen breve>`.

**No abras issues, discusiones ni pull requests públicos para reportar una vulnerabilidad**: la dejarían a la vista antes de que exista una corrección.

Incluye en el reporte:

- Qué parte está afectada: URL, ruta de la API, archivo o commit.
- Tipo de problema e impacto posible (por ejemplo, ver datos o fotos de otro taller, saltarse un rol o robar una sesión).
- Pasos para reproducirlo o una prueba de concepto mínima.
- El commit de `main` o la fecha en que lo probaste, y el navegador o entorno si aplica.

Prueba solo con un taller y cuentas propios o de prueba: no accedas a datos de otros talleres, no los cambies ni los borres, y no degrades el servicio.

## Plazos orientativos

- **Acuse de recibo:** dentro de 72 horas.
- **Evaluación inicial** (si se confirma y qué gravedad tiene): dentro de 7 días.

Luego recibirás el plan de corrección y un aviso cuando esté desplegada. Te pido no divulgar el problema hasta entonces.

## Medidas actuales

Cada taller queda aislado por el `tenantId` de la sesión (lo verifican `apps/api/test/tenancy.test.ts` y `files.test.ts`), con contraseñas en bcrypt, JWT, Helmet, CORS limitado, límite de peticiones en `/api/auth` y validación Zod.

---

## Summary (English)

Only the `main` branch (the deployed one) receives security fixes. Report vulnerabilities privately to **ronalddemiancipagauta@gmail.com**. Please do not open public issues, discussions or pull requests for them. Include the affected component, the impact, steps to reproduce or a minimal proof of concept, and the commit or date you tested. Use only your own or test workshop and accounts. You can expect an acknowledgement within 72 hours and an initial assessment within 7 days.
