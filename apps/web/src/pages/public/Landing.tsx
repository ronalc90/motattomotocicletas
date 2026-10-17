import { Link } from "react-router-dom";
import { ArrowRight, Boxes, Camera, CheckSquare, FileDown, MessageCircle, Mic, PieChart, Shield, Wallet } from "lucide-react";
import { Button } from "@/components/ui";
import { ParticleField } from "@/components/fx/ParticleField";

const FEATURES = [
  { icon: FileDown, title: "Factura y descarga el PDF", text: "Cuenta de cobro con el formato que tus clientes ya conocen: texto, PDF y link público." },
  { icon: MessageCircle, title: "Envía por WhatsApp", text: "Un toque abre WhatsApp con la cuenta lista para el cliente. Sin copiar y pegar." },
  { icon: Camera, title: "Inventario por foto de etiqueta", text: "Toma la foto del repuesto; el sistema lee referencia, nombre y marca." },
  { icon: CheckSquare, title: "Descuento de stock con confirmación", text: "Al terminar una orden te pregunta qué repuestos descontar. Nada sale solo." },
  { icon: Mic, title: "Asistente por voz", text: "“Cambio de aceite, pastillas delanteras y bujía NS 200”. Listo, propone las líneas." },
  { icon: Wallet, title: "Caja y cierre del día", text: "Pagos por método, recargo Nequi, gastos con foto del recibo y cierre en un botón." },
  { icon: PieChart, title: "Reportes", text: "Ventas, utilidad, más vendidos y clientes frecuentes. Exporta a Excel." },
  { icon: Shield, title: "Roles de usuario", text: "Dueño, administrador, mecánico, cajero y contador. Cada uno ve lo suyo." },
];

const STEPS = [
  { t: "Registra tu taller", d: "Nombre, tipo (motos, carros o ambos) y tu WhatsApp. Dos minutos." },
  { t: "Mete tus repuestos", d: "Con fotos de las etiquetas, con Excel o a mano. El catálogo de servicios ya viene listo." },
  { t: "Recibe el vehículo", d: "Busca la placa, anota qué le pasa y arma la cuenta hablando o escogiendo de la lista." },
  { t: "Cobra y envía", d: "Efectivo o Nequi con recargo, cierre de caja y la cuenta por WhatsApp o PDF." },
];

export function Landing() {
  return (
    <>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }} />
        <ParticleField />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <p className="text-amber font-semibold text-sm mb-3">Para talleres de motos y carros en Colombia</p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">Tu taller al día desde el celular.</h1>
            <p className="mt-5 text-lg text-slate-300 max-w-xl leading-relaxed">Cuentas de cobro, inventario con fotos, clientes y caja. Dicta la factura por voz y envíala por WhatsApp antes de que el cliente se baje de la moto.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/registro"><Button size="lg" full icon={<ArrowRight className="h-5 w-5" />}>Registrar mi taller gratis</Button></Link>
              <Link to="/como-funciona"><Button size="lg" variant="outline" full className="border-white/30 text-white hover:bg-white/10">Ver cómo funciona</Button></Link>
            </div>
            <p className="mt-4 text-sm text-slate-400">Sin tarjeta. Plan gratis con 200 facturas al mes.</p>
          </div>
          <HeroInvoice />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl font-bold tracking-tight">Tres puertas, una sola plataforma</h2>
        <p className="muted mt-2 max-w-2xl">Cada quien entra por la suya.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <PortalCard title="Dueños de taller" text="Registras tu taller, invitas a tu equipo y manejas órdenes, inventario, caja y reportes." cta={{ to: "/registro", label: "Registrar mi taller" }} tone="motor" />
          <PortalCard title="Clientes del taller" text="Reciben su cuenta de cobro por WhatsApp con un link. La ven, la descargan en PDF y conocen su garantía. Sin crear cuenta." cta={{ to: "/como-funciona", label: "Ver un ejemplo" }} tone="light" />
          <PortalCard title="Administración de la plataforma" text="Nosotros vemos los talleres registrados, su uso y su plan, y entramos como soporte cuando lo piden." cta={{ to: "/nosotros", label: "Quiénes somos" }} tone="dark" />
        </div>
      </section>

      <section className="bg-slate-50 dark:bg-ink-2">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-3xl font-bold tracking-tight">Lo que hace por ti</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-card bg-white dark:bg-ink p-5 border border-slate-200 dark:border-slate-800">
                <f.icon className="h-6 w-6 text-motor" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm muted leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl font-bold tracking-tight">Cómo funciona</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="relative">
              <span className="font-display text-5xl font-extrabold text-motor/30">{i + 1}</span>
              <h3 className="font-semibold mt-1">{s.t}</h3>
              <p className="text-sm muted mt-1 leading-relaxed">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-card bg-motor text-white p-8 sm:p-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-3xl font-bold">Deja el bloc de notas hoy.</h2>
            <p className="mt-2 opacity-90">Registra tu taller y haz tu primera cuenta de cobro en cinco minutos.</p>
          </div>
          <Link to="/registro"><Button size="lg" variant="dark" className="bg-ink hover:bg-ink-2 text-white">Registrar mi taller</Button></Link>
        </div>
      </section>
    </>
  );
}

function PortalCard({ title, text, cta, tone }: { title: string; text: string; cta: { to: string; label: string }; tone: "motor" | "light" | "dark" }) {
  const cls = { motor: "bg-motor text-white", light: "bg-white dark:bg-ink border border-slate-200 dark:border-slate-800", dark: "bg-ink text-white dark:bg-ink-2" }[tone];
  return (
    <div className={`rounded-card p-6 flex flex-col ${cls}`}>
      <h3 className="font-display text-xl font-bold">{title}</h3>
      <p className={`mt-2 text-sm leading-relaxed flex-1 ${tone === "light" ? "muted" : "opacity-85"}`}>{text}</p>
      <Link to={cta.to} className="mt-5 inline-flex items-center gap-1.5 font-semibold text-sm underline-offset-4 hover:underline">{cta.label} <ArrowRight className="h-4 w-4" /></Link>
    </div>
  );
}

function HeroInvoice() {
  const rows = [["Kit de arrastre Pulsar NS 200", "274.000"], ["Cambio kit de arrastre", "25.000"], ["Cambio de aceite y filtro", "10.000"], ["Pastillas delanteras", "26.000"]];
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="rounded-card bg-white text-ink shadow-float p-5 rotate-[-2deg]">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display font-bold">MOTATTO MOTOCICLETAS</div>
            <div className="text-xs text-slate-500">Cuenta de cobro MT-2026-0142</div>
          </div>
          <span className="plate px-2 py-0.5 text-xs">KJP 42F</span>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          {rows.map(([d, v]) => (
            <div key={d} className="flex justify-between gap-3"><span>{d}</span><span className="tabular-nums font-medium">{v}</span></div>
          ))}
        </div>
        <div className="mt-3 border-t pt-3 flex justify-between font-display font-bold text-lg"><span>Total</span><span className="text-motor-dark">$ 335.000</span></div>
        <div className="mt-3 flex gap-2">
          <span className="flex-1 rounded-btn bg-ok text-white text-xs font-semibold py-2 text-center">WhatsApp</span>
          <span className="flex-1 rounded-btn bg-slate-100 text-xs font-semibold py-2 text-center">PDF</span>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 sm:-left-8 rounded-full bg-motor text-white px-4 py-2 text-sm font-semibold shadow-float rotate-[3deg] flex items-center gap-2"><Mic className="h-4 w-4" /> “…pastillas delanteras y bujía”</div>
      <div className="absolute -top-4 -right-2 rounded-full bg-amber text-ink px-3 py-1.5 text-xs font-semibold shadow-float flex items-center gap-1.5"><Boxes className="h-3.5 w-3.5" /> stock 3 → 2</div>
    </div>
  );
}
