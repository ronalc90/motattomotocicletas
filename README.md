# Motatto — Plataforma de gestión para talleres de motos y carros

Plataforma web multitenant: cada taller se registra y maneja cuentas de cobro/facturas, inventario (con fotos), clientes y vehículos, caja y reportes, desde el celular, con cámara y voz.

- Plan completo: [`docs/`](docs/Home.md) (espejo del wiki).
- Dominio: https://motattomotocicletas.com
- API: Railway · Web: Vercel · DNS: Namecheap

## Estructura (en construcción)

```
apps/web        → frontend React + Vite (Vercel)
apps/api        → API Node + Express + Mongoose (Railway)
packages/shared → tipos y validaciones compartidas
docs/           → documentación
```
