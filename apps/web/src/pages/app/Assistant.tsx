import { useNavigate } from "react-router-dom";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { PageHeader } from "@/components/ui";

export function Assistant() {
  const nav = useNavigate();
  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-7rem)]">
      <PageHeader title="Asistente" sub="Habla con tu taller: crea la cuenta, pregunta precios o stock." />
      <div className="flex-1 min-h-0">
        <AssistantPanel compact onUseItems={(items, p) => nav("/app/ordenes/nueva", { state: { items, customer: p.customer, vehicle: p.vehicle, transcript: p.answer, discount: p.discount, km: p.km, description: p.description } })} />
      </div>
    </div>
  );
}
