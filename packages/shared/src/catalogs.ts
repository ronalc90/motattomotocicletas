import type { TenantType } from "./enums.js";

export interface SeedService {
  name: string;
  category: string;
  suggestedPrice: number;
}

export const SERVICES_MOTOS: SeedService[] = [
  { name: "Cambio de aceite y filtro", category: "Mantenimiento", suggestedPrice: 10000 },
  { name: "Cambio de pastillas", category: "Frenos", suggestedPrice: 10000 },
  { name: "Purga de frenos", category: "Frenos", suggestedPrice: 70000 },
  { name: "Cambio kit de arrastre", category: "Transmisión", suggestedPrice: 25000 },
  { name: "Cambio cunas de dirección", category: "Suspensión", suggestedPrice: 100000 },
  { name: "Pinta", category: "Estética", suggestedPrice: 25000 },
  { name: "Cambio de bujía", category: "Motor", suggestedPrice: 5000 },
  { name: "Lavado y engrase de cadena", category: "Transmisión", suggestedPrice: 15000 },
  { name: "Sincronización", category: "Motor", suggestedPrice: 40000 },
  { name: "Cambio de llanta", category: "Llantas", suggestedPrice: 15000 },
  { name: "Revisión general", category: "Mantenimiento", suggestedPrice: 30000 },
  { name: "Mano de obra general (hora)", category: "General", suggestedPrice: 30000 },
];

export const SERVICES_CARROS: SeedService[] = [
  { name: "Cambio de aceite y filtro", category: "Mantenimiento", suggestedPrice: 40000 },
  { name: "Cambio de pastillas delanteras", category: "Frenos", suggestedPrice: 50000 },
  { name: "Cambio de pastillas traseras", category: "Frenos", suggestedPrice: 50000 },
  { name: "Purga de frenos", category: "Frenos", suggestedPrice: 60000 },
  { name: "Alineación y balanceo", category: "Llantas", suggestedPrice: 80000 },
  { name: "Cambio de batería", category: "Eléctrico", suggestedPrice: 20000 },
  { name: "Cambio de filtro de aire", category: "Mantenimiento", suggestedPrice: 15000 },
  { name: "Cambio de correa", category: "Motor", suggestedPrice: 120000 },
  { name: "Escaneo computarizado", category: "Diagnóstico", suggestedPrice: 60000 },
  { name: "Cambio de amortiguadores", category: "Suspensión", suggestedPrice: 150000 },
  { name: "Revisión general", category: "Mantenimiento", suggestedPrice: 60000 },
  { name: "Mano de obra general (hora)", category: "General", suggestedPrice: 50000 },
];

export function seedServicesFor(type: TenantType): SeedService[] {
  if (type === "motos") return SERVICES_MOTOS;
  if (type === "carros") return SERVICES_CARROS;
  const names = new Set<string>();
  return [...SERVICES_MOTOS, ...SERVICES_CARROS].filter((s) => {
    if (names.has(s.name)) return false;
    names.add(s.name);
    return true;
  });
}

export const DEFAULT_WARRANTY_TEXT = `✅ Los trabajos realizados tienen una garantía de 9 días, siempre y cuando los repuestos sean adquiridos con nosotros.
⚡ Las partes eléctricas no tienen garantía.
❗ En casos de reparación de motor, cambio de discos de embrague y similares, el taller no se hace responsable por el mal manejo del cliente.`;

export const DEFAULT_FOOTER_TEXT = "Gracias por confiar en nosotros. 😊";

export const VEHICLE_BRANDS_MOTO = ["Bajaj", "Suzuki", "Yamaha", "Honda", "AKT", "Kawasaki", "KTM", "TVS", "Hero", "Pulsar", "Otra"];
export const VEHICLE_BRANDS_CARRO = ["Chevrolet", "Renault", "Mazda", "Kia", "Hyundai", "Toyota", "Nissan", "Ford", "Volkswagen", "Suzuki", "Otra"];
