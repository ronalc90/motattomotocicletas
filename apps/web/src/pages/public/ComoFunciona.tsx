import { Link } from "react-router-dom";
import { Bike, Car } from "lucide-react";
import { Button } from "@/components/ui";

function Flow({ title, steps }: { title: string; steps: Array<{ s: string; d?: string; state?: string }> }) {
  return (
    <div className="card p-5 sm:p-6">
      <h3 className="font-display text-xl font-bold">{title}</h3>
      <ol className="mt-4 relative border-l-2 border-motor/30 ml-3 space-y-5">
        {steps.map((st, i) => (
          <li key={i} className="pl-5 relative">
            <span className="absolute -left-[11px] top-0.5 h-5 w-5 rounded-full bg-motor text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
            <div className="font-medium">{st.s}</div>
            {st.d && <div className="text-sm muted mt-0.5">{st.d}</div>}
            {st.state && <span className="mt-1 inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold">→ {st.state}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ComoFunciona() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 space-y-12">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Cómo funciona</h1>
        <p className="mt-3 muted max-w-2xl text-lg">Los mismos pasos que ya haces en el taller, pero el sistema recuerda todo: clientes, vehículos, repuestos y plata.</p>
      </header>

      <section>
        <h2 className="font-display text-2xl font-bold mb-4">Llega un vehículo → cuenta de cobro → cobro</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Flow title={"Taller de motos"} steps={[
            { s: "Buscar la placa, el nombre o el teléfono", d: "Si no existe, creas cliente y moto en el mismo paso." },
            { s: "Nueva orden: kilometraje, “qué le pasa”, fotos de entrada", state: "recibida" },
            { s: "Agregar líneas por voz, por foto de la etiqueta o de la lista", d: "“Kit de arrastre, cambio de kit, pastillas traseras y purga de frenos”. Propone descripción y precio; tú confirmas." },
            { s: "Enviar cotización por WhatsApp (opcional)", state: "cotizada" },
            { s: "Trabajar", state: "en_proceso" },
            { s: "Marcar terminada → pregunta qué descontar del inventario", state: "terminada" },
            { s: "Cobrar: efectivo, Nequi (+recargo) o transferencia", d: "Queda el pago en caja y se calcula la garantía.", state: "pagada" },
            { s: "Enviar: texto WhatsApp, PDF o link público" },
          ]} />
          <Flow title={"Taller de carros"} steps={[
            { s: "Buscar la placa o el cliente", d: "Marca, modelo, año y color del carro quedan guardados." },
            { s: "Nueva orden: kilometraje, síntoma, fotos del estado de entrada", state: "recibida" },
            { s: "Agregar líneas", d: "“Cambio de aceite y filtro, pastillas delanteras, alineación y balanceo”. Repuestos del inventario y servicios del catálogo de carros." },
            { s: "Cotizar y esperar aprobación del cliente", state: "cotizada" },
            { s: "Trabajar", state: "en_proceso" },
            { s: "Terminar y confirmar descuento de inventario", state: "terminada" },
            { s: "Cobrar y registrar en caja", state: "pagada" },
            { s: "Entregar con la cuenta de cobro y la garantía por escrito" },
          ]} />
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="card p-5 sm:p-6">
          <h3 className="font-display text-xl font-bold">Factura por voz</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl bg-motor-soft dark:bg-motor/20 p-3 italic">“Moto de Ronal, la Gixxer. Kit de arrastre, cambio de kit, aceite, filtro, cambio de aceite y filtro, pastillas traseras y delanteras, purga de frenos”</div>
            <div className="text-center muted">↓ el navegador transcribe, la IA interpreta con tu inventario y catálogo ↓</div>
            <div className="rounded-xl border line p-3 space-y-1.5">
              <div className="flex justify-between"><span>Kit de arrastre ×1</span><span className="tabular-nums">274.000</span></div>
              <div className="flex justify-between"><span>Cambio kit de arrastre</span><span className="tabular-nums">25.000</span></div>
              <div className="flex justify-between"><span>Pastillas traseras ×1</span><span className="tabular-nums">26.000</span></div>
              <div className="flex justify-between text-amber-800 dark:text-amber-200"><span>Purga de frenos</span><span>revisar precio</span></div>
            </div>
            <p className="muted">Cada línea se puede corregir o borrar antes de confirmar. También sirve para preguntar: “¿cuánto vale la bujía de NS 200?”.</p>
          </div>
        </div>
        <div className="card p-5 sm:p-6">
          <h3 className="font-display text-xl font-bold">Descuento de inventario con confirmación</h3>
          <div className="mt-4 rounded-xl border line p-4 text-sm font-mono space-y-1.5">
            <div className="font-sans font-semibold mb-2">¿Descontar del inventario?</div>
            <div>☑ Kit arrastre <span className="muted">1 ud (stock 3→2)</span></div>
            <div>☑ Pastillas traseras <span className="muted">1 ud (stock 5→4)</span></div>
            <div>☐ Aceite 20W50 <span className="text-bad">1 ud ⚠ stock 0</span></div>
            <div className="pt-2 flex gap-2 font-sans"><span className="rounded-btn bg-motor text-white px-3 py-1.5 text-xs font-semibold">Descontar lo marcado</span><span className="rounded-btn bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold">No descontar nada</span></div>
          </div>
          <p className="mt-3 text-sm muted">Desmarcas cuando el repuesto lo trajo el cliente o no pasó por el estante. Queda registrado quién confirmó y qué salió.</p>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {[
          { t: "Entrada de mercancía con fotos", d: "Foto de la etiqueta → lee referencia, nombre, marca y precio impreso → si ya existe, pregunta cuántas entraron; si es nuevo, llena el formulario. La foto queda en el producto." },
          { t: "Caja y cierre del día", d: "Pagos por método, gastos con foto del recibo y cierre con totales. Solo dueño o administrador reabren un día." },
          { t: "Garantía", d: "Si el vehículo vuelve dentro del plazo, el historial muestra “garantía vigente hasta…” y la nueva orden queda marcada como garantía de la anterior." },
        ].map((x) => (
          <div key={x.t} className="card p-5">
            <h3 className="font-semibold">{x.t}</h3>
            <p className="text-sm muted mt-1.5 leading-relaxed">{x.d}</p>
          </div>
        ))}
      </section>

      <section className="rounded-card bg-ink text-white p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3"><Bike className="h-8 w-8 text-amber" /><Car className="h-8 w-8 text-amber" /><span className="font-display text-xl font-bold">Motos, carros o ambos.</span></div>
        <Link to="/registro"><Button size="lg">Registrar mi taller</Button></Link>
      </section>
    </div>
  );
}
