import type { Customer, Order, Paginated, Product, Service, Tenant, Vehicle } from "@motatto/shared";
import { api } from "./api";

export const qk = {
  tenant: ["tenant"] as const,
  dashboard: ["dashboard"] as const,
  orders: (params: Record<string, unknown>) => ["orders", params] as const,
  order: (id: string) => ["order", id] as const,
  invoice: (id: string) => ["order-invoice", id] as const,
  customers: (q: string) => ["customers", q] as const,
  customer: (id: string) => ["customer", id] as const,
  vehicle: (id: string) => ["vehicle", id] as const,
  products: (params: Record<string, unknown>) => ["products", params] as const,
  product: (id: string) => ["product", id] as const,
  services: ["services"] as const,
  users: ["users"] as const,
  cashDay: (date: string) => ["cash-day", date] as const,
  closings: ["closings"] as const,
  report: (from: string, to: string) => ["report", from, to] as const,
  audit: ["audit"] as const,
};

export const fetchers = {
  tenant: () => api.get<Tenant>("/tenant"),
  orders: (params: Record<string, string | number | undefined>) => api.get<Paginated<Order>>("/orders", params),
  order: (id: string) => api.get<Order>(`/orders/${id}`),
  customers: (q: string) => api.get<Paginated<Customer>>("/customers", { q, limit: 30 }),
  customer: (id: string) => api.get<Customer>(`/customers/${id}`),
  vehicle: (id: string) => api.get<Vehicle>(`/vehicles/${id}`),
  products: (params: Record<string, string | number | undefined>) => api.get<Paginated<Product>>("/products", params),
  services: () => api.get<Paginated<Service>>("/services"),
};

export interface DeductRow { productId: string; name: string; qty: number; stock: number; after: number }
export interface InvoiceResponse { invoice: import("@motatto/shared").PublicInvoice; text: string; whatsappUrl: string; publicUrl: string }
