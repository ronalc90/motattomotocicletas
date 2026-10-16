# Motatto — Plataforma de gestión para talleres de motos y carros

Plataforma web **multitenant**: cada taller (de motos o de carros) se registra, tiene su propio espacio aislado y maneja **cuentas de cobro / facturas, inventario, clientes, vehículos, caja y reportes**, desde el celular, con cámara y voz.

El primer taller de la plataforma es **Motatto Motocicletas** (Calle 5A Sur # 85-25, Bogotá · 321 422 9804), que hoy usa un generador estático de cuentas de cobro en Netlify que no guarda nada.

Dominio: **motattomotocicletas.com** → cada taller tendrá su subdominio o slug (`motatto.motattomotocicletas.com` o `motattomotocicletas.com/t/motatto`).

## Índice del plan

1. [[Alcance y módulos]] — qué hace la plataforma, módulo por módulo, multitenant, voz, cámara.
2. [[Usuarios y roles]] — tipos de usuario, permisos por módulo.
3. [[Flujos de trabajo]] — registro de un taller, llegada de un vehículo, factura por voz, inventario con fotos, descuento de stock con confirmación, caja.
4. [[Modelo de datos]] — colecciones de MongoDB y cómo se aísla cada tenant.
5. [[Arquitectura y despliegue]] — stack, Railway (API + Mongo), Vercel (frontend), Namecheap (DNS), variables de entorno.
6. [[Formato de cuenta de cobro]] — el documento que recibe el cliente final (WhatsApp, PDF, link).
7. [[Roadmap]] — fases y criterios de "listo".
8. [[Manual de usuario]] — se completa cuando la app esté desplegada.

## Repositorios y servicios

| Qué | Dónde |
|---|---|
| Código | https://github.com/ronalc90/motattomotocicletas |
| API + MongoDB | Railway, proyecto `motattomotocicletas` (ID `5727b468-f3b3-4acf-bd87-1460a45d044c`) |
| Frontend | Vercel, proyecto `motattomotocicletas` (equipo Koptup's projects) |
| Dominio / DNS | Namecheap → `motattomotocicletas.com` |
