import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Gauge, Receipt, Wrench } from "lucide-react";
import { LoginSchema } from "@motatto/shared";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Input } from "@/components/ui";
import { AuthLayout } from "@/layouts/AuthLayout";
import { ParticleField } from "@/components/fx/ParticleField";
import "./login.css";

/** Wheel with a rotating rim and spokes; the tire stays still so only the spokes turn. */
function Wheel({ cx, cy }: { cx: number; cy: number }) {
  const r = 60;
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx - Math.cos(a) * r, cy - Math.sin(a) * r];
  });
  return (
    <g>
      <circle cx={cx} cy={cy} r={74} fill="none" stroke="#0b0f19" strokeWidth={20} />
      <g className="lg-wheel">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#cbd5e1" strokeWidth={3} />
        {spokes.map((s, i) => (
          <line key={i} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} stroke="#94a3b8" strokeWidth={2.5} />
        ))}
        <circle cx={cx} cy={cy} r={8} fill="#F0611A" />
      </g>
    </g>
  );
}

/** Animated sport bike. Decorative, so it is hidden from assistive tech. */
function BikeScene() {
  return (
    <svg viewBox="0 0 640 330" className="w-full h-auto max-w-xl" aria-hidden focusable="false">
      <defs>
        <linearGradient id="lg-beam" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#FDE68A" stopOpacity="0.6" />
          <stop offset="1" stopColor="#FDE68A" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Ground */}
      <ellipse cx="320" cy="318" rx="270" ry="9" fill="#000" opacity="0.35" />
      {/* Speed lines */}
      <rect x="0" y="150" width="110" height="3" rx="2" fill="#F0611A" className="lg-speed" style={{ animationDelay: "0s" }} />
      <rect x="0" y="182" width="150" height="3" rx="2" fill="#F5A524" className="lg-speed" style={{ animationDelay: "0.5s" }} />
      <rect x="0" y="214" width="90" height="3" rx="2" fill="#F0611A" className="lg-speed" style={{ animationDelay: "1s" }} />
      <rect x="0" y="236" width="130" height="3" rx="2" fill="#F5A524" className="lg-speed" style={{ animationDelay: "0.3s" }} />

      {/* Headlight beam (behind the bike) */}
      <polygon points="486,170 630,118 630,222" fill="url(#lg-beam)" className="lg-beam" />

      <g className="lg-bike">
        {/* Exhaust smoke */}
        {[0, 0.8, 1.6].map((d) => (
          <circle key={d} cx="186" cy="256" r="11" fill="#e2e8f0" className="lg-puff" style={{ animationDelay: `${d}s` }} />
        ))}
        {/* Exhaust pipe */}
        <path d="M262 240 L206 250 L188 262" fill="none" stroke="#94a3b8" strokeWidth={9} strokeLinecap="round" />
        {/* Frame */}
        <path d="M160 250 L240 196 L330 196 L392 146 L436 146" fill="none" stroke="#F0611A" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M330 196 L300 232 L250 234" fill="none" stroke="#F0611A" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        {/* Engine */}
        <rect x="262" y="206" width="78" height="44" rx="10" fill="#1f2937" stroke="#475569" strokeWidth={2} />
        {[276, 290, 304, 318, 332].map((x) => (
          <line key={x} x1={x} y1="212" x2={x} y2="244" stroke="#334155" strokeWidth={3} />
        ))}
        {/* Tank with displacement sticker */}
        <path d="M236 178 Q250 128 318 126 Q352 126 368 146 L338 178 Z" fill="#F0611A" />
        <text x="296" y="164" fontSize="15" fontWeight="800" fill="#ffffff" fontFamily="Sora, sans-serif" textAnchor="middle" letterSpacing="1">TU MOTO</text>
        {/* Seat */}
        <path d="M196 178 Q226 160 268 168 L256 186 L200 190 Z" fill="#111827" />
        {/* Fairing and headlight */}
        <path d="M436 146 Q470 150 488 180 L470 198 L440 182 Z" fill="#0f172a" stroke="#F0611A" strokeWidth={3} />
        <circle cx="476" cy="172" r="10" fill="#FDE68A" className="lg-glow" />
        {/* Handlebar and fork */}
        <path d="M420 132 L440 112 L462 116" fill="none" stroke="#cbd5e1" strokeWidth={6} strokeLinecap="round" />
        <line x1="436" y1="146" x2="480" y2="250" stroke="#cbd5e1" strokeWidth={7} strokeLinecap="round" />
        {/* Wheels */}
        <Wheel cx={160} cy={250} />
        <Wheel cx={480} cy={250} />
      </g>

      {/* Road markings */}
      <line x1="0" y1="304" x2="640" y2="304" stroke="#475569" strokeWidth={3} strokeDasharray="18 14" className="lg-dash" />
    </svg>
  );
}

function Hero() {
  const perks = [
    { icon: Gauge, text: "Todo tipo de motos, atendidas como se debe" },
    { icon: Wrench, text: "Repuestos con foto y stock al día" },
    { icon: Receipt, text: "Facturas en segundos, incluso dictándolas" },
  ];
  return (
    <section className="lg-scan relative overflow-hidden bg-gradient-to-br from-ink via-ink-2 to-[#2a1408] px-6 py-10 sm:px-10 lg:py-16 flex flex-col justify-center">
      <div aria-hidden className="lg-grid-bg pointer-events-none absolute inset-0" />
      <ParticleField />
      {/* Glow behind the bike */}
      <div aria-hidden className="pointer-events-none absolute -top-24 right-[-10%] h-96 w-96 rounded-full bg-motor/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 h-40 w-full bg-gradient-to-t from-ink to-transparent" />
      <div className="relative">
        <p className="lg-rise inline-flex items-center gap-2 rounded-full border border-motor/40 bg-motor/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-orange-300">
          Taller de motos y carros
        </p>
        <h2 className="lg-rise mt-4 font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-white" style={{ animationDelay: "0.08s" }}>
          Tu taller, <span className="lg-gradient-text">a toda marcha.</span>
        </h2>
        <p className="lg-rise mt-3 max-w-md text-slate-300" style={{ animationDelay: "0.16s" }}>
          Órdenes, facturas, inventario con fotos y caja. Todo desde el celular, sin perder el ritmo de la rodada.
        </p>
        <ul className="mt-6 space-y-3">
          {perks.map((p, i) => (
            <li key={p.text} className="lg-rise flex items-center gap-3 text-sm text-slate-200" style={{ animationDelay: `${0.24 + i * 0.08}s` }}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-motor/15 text-motor">
                <p.icon className="h-5 w-5" />
              </span>
              {p.text}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative mt-8 lg:mt-10 lg-fade" style={{ animationDelay: "0.3s" }}>
        <BikeScene />
      </div>
    </section>
  );
}

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof LoginSchema>>({ resolver: zodResolver(LoginSchema) });

  return (
    <AuthLayout>
      <div className="flex-1 grid lg:grid-cols-2">
        <Hero />
        <div className="flex items-center justify-center px-4 py-10 sm:py-14 bg-slate-50 dark:bg-ink-2">
          <div className="lg-rise w-full max-w-md"><div className="lg-ring shadow-float"><div className="relative overflow-hidden rounded-[0.9rem] bg-white text-ink dark:bg-ink-2 dark:text-slate-100 p-6 sm:p-8">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-motor via-amber to-motor" />
            <h1 className="font-display text-2xl font-bold">Ingresar</h1>
            <p className="muted mt-1 text-sm">Entra con el correo de tu taller.</p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit(async (v) => {
              try {
                const r = await login(v.email, v.password);
                const from = loc.state?.from;
                if (r.user.role === "superadmin") nav("/superadmin", { replace: true });
                else nav(from && from.startsWith("/app") ? from : "/app", { replace: true });
              } catch (e) { toast.error(errorMessage(e)); }
            })}>
              <Input label="Correo" type="email" autoComplete="email" inputMode="email" {...register("email")} error={errors.email?.message} />
              <Input label="Contraseña" type="password" autoComplete="current-password" {...register("password")} error={errors.password?.message} />
              <div className="lg-shine lg-pulse rounded-btn">
                <Button type="submit" full size="lg" loading={isSubmitting}>Entrar al taller</Button>
              </div>
            </form>
            <p className="mt-6 text-center text-sm muted">
              ¿Aún no tienes taller? <Link to="/registro" className="font-semibold text-motor-dark dark:text-orange-300">Regístralo gratis</Link>
            </p>
          </div></div></div>
        </div>
      </div>
    </AuthLayout>
  );
}
