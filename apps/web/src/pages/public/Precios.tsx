import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Minus } from "lucide-react";
import { SERVICES_CARROS, SERVICES_MOTOS, formatMoney } from "@motatto/shared";
import { Button, Tabs } from "@/components/ui";

const ROWS: Array<{ f: string; free: string | boolean; pro: string | boolean }> = [
  { f: "Usuarios", free: "1", pro: "Ilimitados" },
  { f: "Cuentas de cobro al mes", free: "200", pro: "Ilimitadas" },
  { f: "Productos en inventario", free: "Hasta 300", pro: "Ilimitados" },
  { f: "Clientes y vehículos", free: true, pro: true },
  { f: "Texto WhatsApp, PDF y link público", free: true, pro: true },
  { f: "Caja y cierre del día", free: true, pro: true },
  { f: "Asistente por voz", free: false, pro: true },
  { f: "Lectura de etiquetas con IA (entrada por foto)", free: false, pro: true },
  { f: "Reportes y exportar a Excel", free: false, pro: true },
  { f: "Portal público de facturas con tu logo", free: false, pro: true },
  { f: "Soporte", free: "Por WhatsApp", pro: "Prioritario" },
];

const FAQ = [
  { q: "¿Qué es una cuenta de cobro y en qué se diferencia de una factura electrónica?", a: "La cuenta de cobro es el documento que la mayoría de talleres entregan hoy: detalla el trabajo y el valor a pagar. No es una factura electrónica DIAN. Motatto genera cuentas de cobro; la facturación electrónica está en el roadmap para los talleres que la necesiten." },
  { q: "¿Puedo cancelar cuando quiera?", a: "Sí. El plan Pro se paga mes a mes y lo cancelas desde Configuración. Tu taller baja al plan Gratis sin perder datos." },
  { q: "¿Mis datos son míos?", a: "Sí. Clientes, vehículos, inventario y órdenes son del taller. Puedes exportar el inventario y las ventas a Excel en cualquier momento." },
  { q: "¿Funciona sin internet?", a: "La app se instala en el celular y abre sin conexión, pero para guardar una orden o cobrar necesitas datos o WiFi. El dictado por voz usa el reconocimiento del navegador." },
  { q: "¿Necesito un computador?", a: "No. Está pensado para el celular. En tablet o computador verás un menú lateral y más espacio para las tablas." },
  { q: "¿El plan Gratis tiene límite de tiempo?", a: "No. Es gratis mientras uses hasta 200 cuentas de cobro al mes y un usuario." },
];

export function Precios() {
  const [cat, setCat] = useState<"motos" | "carros">("motos");
  const services = cat === "motos" ? SERVICES_MOTOS : SERVICES_CARROS;
  const byCat = services.reduce<Record<string, typeof services>>((acc, s) => ((acc[s.category] ??= []).push(s), acc), {});
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 space-y-14">
      <header className="text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Precios claros</h1>
        <p className="mt-3 muted text-lg">Dos planes. Empiezas gratis y subes a Pro cuando lo necesites.</p>
      </header>

      <section className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        <div className="card p-6 flex flex-col">
          <h2 className="font-display text-2xl font-bold">Gratis</h2>
          <div className="mt-2"><span className="font-display text-4xl font-extrabold">$0</span><span className="muted"> / mes</span></div>
          <ul className="mt-5 space-y-2 text-sm flex-1">
            {["1 usuario", "200 cuentas de cobro al mes", "Inventario hasta 300 productos", "Soporte por WhatsApp"].map((x) => (
              <li key={x} className="flex gap-2"><Check className="h-4 w-4 text-ok mt-0.5 shrink-0" />{x}</li>
            ))}
          </ul>
          <Link to="/registro" className="mt-6"><Button variant="dark" full size="lg">Empezar gratis</Button></Link>
        </div>
        <div className="rounded-card bg-ink text-white p-6 flex flex-col ring-4 ring-motor/40">
          <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Pro</h2><span className="rounded-full bg-motor px-2.5 py-0.5 text-xs font-semibold">Recomendado</span></div>
          <div className="mt-2"><span className="font-display text-4xl font-extrabold">$49.900</span><span className="text-slate-400"> COP / mes</span></div>
          <ul className="mt-5 space-y-2 text-sm flex-1">
            {["Usuarios ilimitados", "Cuentas de cobro ilimitadas", "Asistente por voz y lectura de etiquetas con IA", "Reportes y exportar a Excel", "Portal público de facturas con tu logo", "Soporte prioritario"].map((x) => (
              <li key={x} className="flex gap-2"><Check className="h-4 w-4 text-amber mt-0.5 shrink-0" />{x}</li>
            ))}
          </ul>
          <Link to="/registro" className="mt-6"><Button full size="lg">Empezar con Pro</Button></Link>
          <p className="mt-2 text-xs text-slate-400 text-center">Se activa desde Configuración después de registrarte.</p>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold mb-4">Comparación</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b line text-left"><th className="p-3 font-medium muted">Función</th><th className="p-3 font-semibold w-28 sm:w-40">Gratis</th><th className="p-3 font-semibold w-28 sm:w-40 text-motor-dark">Pro</th></tr></thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.f} className="border-b line last:border-0">
                  <td className="p-3">{r.f}</td>
                  <td className="p-3"><Cell v={r.free} /></td>
                  <td className="p-3"><Cell v={r.pro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold">Costos por servicio de referencia</h2>
        <p className="muted mt-1 mb-4 max-w-2xl">Cada taller nace con este catálogo de mano de obra según su tipo. Son precios de referencia editables: cada taller pone los suyos.</p>
        <Tabs value={cat} onChange={setCat} items={[{ value: "motos", label: "Motos" }, { value: "carros", label: "Carros" }]} className="mb-4" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(byCat).map(([c, list]) => (
            <div key={c} className="card p-4">
              <h3 className="font-semibold text-sm mb-2">{c}</h3>
              <ul className="space-y-1.5 text-sm">
                {list.map((s) => (
                  <li key={s.name} className="flex justify-between gap-3"><span>{s.name}</span><span className="tabular-nums muted">$ {formatMoney(s.suggestedPrice)}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto">
        <h2 className="font-display text-2xl font-bold mb-4">Preguntas frecuentes</h2>
        <div className="space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="card p-4 group">
              <summary className="cursor-pointer font-medium list-none flex justify-between gap-3">{f.q}<span className="muted group-open:rotate-45 transition-transform">+</span></summary>
              <p className="mt-2 text-sm muted leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="h-5 w-5 text-ok" />;
  if (v === false) return <Minus className="h-5 w-5 muted" />;
  return <span className="font-medium">{v}</span>;
}
