import { MessageCircle, Mail } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/utils";

const MODULES = [
  ["Clientes y vehículos", "Nombre, WhatsApp, placa, marca, modelo y kilometraje. Historial completo por vehículo."],
  ["Inventario", "Productos con fotos, referencia, compatibilidad, costo y precio. Entradas por foto, ajustes por conteo, alertas de stock bajo."],
  ["Catálogo de servicios", "Mano de obra con precio sugerido por categoría. Catálogo inicial para motos y para carros."],
  ["Órdenes y cuentas de cobro", "Estados recibida → cotizada → en proceso → terminada → pagada. Descuento de inventario con confirmación, garantía y anulación con motivo."],
  ["Caja", "Pagos por método con recargo, gastos con foto del recibo y cierre del día."],
  ["Reportes", "Ventas, utilidad, más vendidos, clientes frecuentes. Excel."],
  ["Asistente", "Un solo lugar para hablar con tu taller: crear la cuenta, preguntar precios y stock, buscar un vehículo."],
  ["Usuarios y roles", "Dueño, administrador, mecánico, cajero y contador. Invitación por link, auditoría de acciones."],
];

const ROADMAP = [
  { f: "Fase 0 — Base", d: "Monorepo, API multitenant, registro de taller y onboarding. Dominio y API en línea.", done: true },
  { f: "Fase 1 — Reemplaza el generador actual", d: "Clientes, vehículos, catálogo, inventario manual, órdenes con estados, cobro con recargo, garantía y cuenta de cobro en texto, PDF y link.", done: true },
  { f: "Fase 2 — Cámara y voz", d: "Entrada de inventario por foto de etiqueta, lectura de placa y asistente por voz para crear la cuenta dictando.", done: true },
  { f: "Fase 3 — Operación completa", d: "Caja con cierre del día, reportes y Excel, roles completos con auditoría y panel de superadmin.", done: true },
  { f: "Fase 4 — Plataforma", d: "Planes y cobro de suscripción, portal del cliente final, WhatsApp API oficial, conteo de estante por foto y facturación electrónica.", done: false },
];

export function Nosotros() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 space-y-14">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Nacimos en un taller</h1>
        <p className="mt-4 text-lg leading-relaxed">Motatto es la plataforma que construimos para <strong>Motatto Motocicletas</strong>, un taller de motos en Bogotá. Durante años las cuentas de cobro salían de un generador de texto: un archivo .txt por cliente, sin historial, sin inventario y sin saber cuánto se vendió en el mes.</p>
        <p className="mt-3 text-lg leading-relaxed muted">Queríamos lo mismo que cualquier dueño de taller: saber qué le hicimos a cada moto, qué hay en el estante y cuánta plata entró hoy, sin sentarnos frente a un computador.</p>
      </header>

      <section className="rounded-card bg-ink text-white p-8">
        <h2 className="font-display text-2xl font-bold">Misión</h2>
        <p className="mt-2 text-lg leading-relaxed text-slate-200">Que el dueño de cualquier taller de motos o carros en Colombia pueda administrar su negocio desde el celular, en español, con la voz y la cámara, sin que nadie se lo tenga que configurar.</p>
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold mb-4">Qué hace cada módulo</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {MODULES.map(([t, d]) => (
            <div key={t} className="card p-4"><h3 className="font-semibold">{t}</h3><p className="text-sm muted mt-1 leading-relaxed">{d}</p></div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold mb-4">Roadmap público</h2>
        <ol className="space-y-3">
          {ROADMAP.map((r) => (
            <li key={r.f} className="card p-4 flex gap-4">
              <span className={`mt-1 h-3 w-3 rounded-full shrink-0 ${r.done ? "bg-ok" : "bg-amber"}`} />
              <div><h3 className="font-semibold">{r.f} <span className="text-xs font-normal muted ml-1">{r.done ? "en producción" : "en construcción"}</span></h3><p className="text-sm muted mt-1">{r.d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-6">
        <h2 className="font-display text-2xl font-bold">Contacto</h2>
        <p className="muted mt-1">Escríbenos. Respondemos desde el taller.</p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-btn bg-ok text-white px-4 h-11 font-semibold"><MessageCircle className="h-5 w-5" /> WhatsApp 321 422 9804</a>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 rounded-btn bg-slate-100 dark:bg-slate-800 px-4 h-11 font-semibold"><Mail className="h-5 w-5" /> {SUPPORT_EMAIL}</a>
        </div>
      </section>
    </div>
  );
}
