import type {
  ExpenseCategory,
  ItemType,
  MovementType,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  Plan,
  ProductCategory,
  Role,
  TenantStatus,
  TenantType,
  VehicleKind,
} from "./enums.js";

/** All API documents expose `id` (string) instead of `_id`. Dates are ISO strings. */
export interface BaseDoc {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Surcharge {
  method: PaymentMethod;
  pct: number;
}

export interface TenantSettings {
  logoUrl?: string;
  slogan?: string;
  address?: string;
  phone?: string;
  currency: string; // "COP"
  invoicePrefix: string; // "MT"
  invoiceNextNumber: number;
  invoiceYearReset: boolean;
  surcharges: Surcharge[];
  warrantyDays: number;
  warrantyText: string;
  footerText: string;
  paymentInfo: string; // "Nequi 321 422 9804"
  askStockOnClose: boolean;
}

export interface Tenant extends BaseDoc {
  slug: string;
  name: string;
  type: TenantType;
  city?: string;
  phone?: string;
  address?: string;
  email: string;
  plan: Plan;
  status: TenantStatus;
  settings: TenantSettings;
  usage: { ordersThisMonth: number; usersCount: number; productsCount: number };
}

export interface User extends BaseDoc {
  tenantId: string | null; // null for superadmin
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt?: string;
}

export interface Customer extends BaseDoc {
  tenantId: string;
  name: string;
  phone?: string;
  document?: string;
  notes?: string;
  /** Populated on detail endpoints */
  vehicles?: Vehicle[];
}

export interface Vehicle extends BaseDoc {
  tenantId: string;
  customerId: string;
  kind: VehicleKind;
  brand: string;
  model: string;
  plate?: string;
  year?: number;
  color?: string;
  lastKm?: number;
  photos: string[];
  /** Populated on some endpoints */
  customer?: Pick<Customer, "id" | "name" | "phone">;
}

export interface ProductPhoto {
  url: string;
  source: "label" | "shelf" | "other";
  at: string;
}

export interface Product extends BaseDoc {
  tenantId: string;
  name: string;
  reference?: string;
  barcode?: string;
  brand?: string;
  category: ProductCategory;
  compatibleWith: string[];
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  location?: string;
  photos: ProductPhoto[];
  active: boolean;
}

export interface StockMovement extends BaseDoc {
  tenantId: string;
  productId: string;
  type: MovementType;
  qty: number;
  unitCost?: number;
  orderId?: string;
  supplier?: string;
  note?: string;
  photoUrl?: string;
  userId: string;
  product?: Pick<Product, "id" | "name" | "reference">;
  user?: Pick<User, "id" | "name">;
}

export interface Service extends BaseDoc {
  tenantId: string;
  name: string;
  category: string;
  suggestedPrice: number;
  active: boolean;
}

export interface OrderItem {
  id: string;
  type: ItemType;
  productId?: string;
  serviceId?: string;
  description: string;
  qty: number;
  unitPrice: number;
  unitCost?: number;
  total: number;
  pos: number;
}

export interface StockDeducted {
  productId: string;
  qty: number;
  movementId: string;
}

export interface Order extends BaseDoc {
  tenantId: string;
  number: string;
  customerId: string;
  vehicleId: string;
  km?: number;
  description?: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  surcharge: number;
  surchargeMethod?: PaymentMethod;
  total: number;
  stockDeducted: StockDeducted[];
  photos: string[];
  internalNotes?: string;
  warrantyUntil?: string;
  warrantyOfOrderId?: string;
  paidAt?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  source: OrderSource;
  voiceTranscript?: string;
  createdBy: string;
  assignedTo?: string;
  // populated
  customer?: Pick<Customer, "id" | "name" | "phone">;
  vehicle?: Pick<Vehicle, "id" | "kind" | "brand" | "model" | "plate">;
  payments?: Payment[];
}

export interface Payment extends BaseDoc {
  tenantId: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  surcharge: number;
  reference?: string;
  closingId?: string;
  userId: string;
  voided: boolean;
}

export interface Expense extends BaseDoc {
  tenantId: string;
  concept: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  movementId?: string;
  receiptPhotoUrl?: string;
  closingId?: string;
  userId: string;
}

export interface CashClosingTotals {
  efectivo: number;
  nequi: number;
  transferencia: number;
  otro: number;
  surcharges: number;
  expenses: number;
  sales: number;
  net: number;
}

export interface CashClosing extends BaseDoc {
  tenantId: string;
  date: string; // YYYY-MM-DD
  totals: CashClosingTotals;
  closedBy: string;
  reopened: boolean;
}

export interface AuditEntry extends BaseDoc {
  tenantId: string | null;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}

/** Public invoice payload (no costs, no stock, no internal notes). */
export interface PublicInvoice {
  number: string;
  createdAt: string;
  paidAt?: string;
  status: OrderStatus;
  tenant: {
    name: string;
    slogan?: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
    paymentInfo: string;
    surcharges: Surcharge[];
    warrantyText: string;
    footerText: string;
    currency: string;
  };
  customer: { name: string };
  vehicle: { kind: VehicleKind; brand: string; model: string; plate?: string };
  km?: number;
  items: Array<Pick<OrderItem, "description" | "qty" | "unitPrice" | "total" | "type">>;
  subtotal: number;
  discount: number;
  surcharge: number;
  surchargeMethod?: PaymentMethod;
  total: number;
  warrantyUntil?: string;
}

/** Result of interpreting a voice/text command. */
export interface AssistantProposal {
  intent: "crear_orden" | "consultar_precio" | "consultar_stock" | "buscar_vehiculo" | "desconocido";
  answer: string; // human-readable response, shown and optionally spoken
  customer?: { id?: string; name: string; phone?: string };
  vehicle?: { id?: string; brand?: string; model?: string; plate?: string };
  items: Array<{
    type: ItemType;
    productId?: string;
    serviceId?: string;
    description: string;
    qty: number;
    unitPrice: number;
    confidence: number; // 0..1
    matchedName?: string;
  }>;
  unrecognized: string[];
}

/** Result of reading a product label photo. */
export interface LabelReadResult {
  reference?: string;
  barcode?: string;
  name?: string;
  brand?: string;
  category?: ProductCategory;
  compatibleWith: string[];
  printedPrice?: number;
  manufacturedOn?: string;
  rawText: string;
  existingProductId?: string;
  confidence: number;
}

export interface DashboardData {
  openOrders: Order[];
  today: { sales: number; payments: number; expenses: number; ordersPaid: number };
  lowStock: Product[];
  activeWarranties: Order[];
  month: { sales: number; orders: number };
}

export interface ReportSales {
  from: string;
  to: string;
  totalSales: number;
  totalCost: number;
  profit: number;
  ordersCount: number;
  byDay: Array<{ date: string; sales: number; orders: number }>;
  byMethod: Array<{ method: PaymentMethod; amount: number }>;
  topProducts: Array<{ productId: string; name: string; qty: number; sales: number }>;
  topServices: Array<{ serviceId?: string; name: string; qty: number; sales: number }>;
  topCustomers: Array<{ customerId: string; name: string; orders: number; sales: number }>;
}
