/**
 * API contract. Base URL: `${VITE_API_URL}/api`.
 * Auth: `Authorization: Bearer <jwt>`. All tenant routes are scoped by the user's tenant from the token.
 * Errors: `{ error: { code: string, message: string, details?: unknown } }` with 4xx/5xx.
 * Lists: `{ items: T[], total: number, page: number, limit: number }`.
 * Single: the object itself. Mutations return the updated object.
 */
export const API_ROUTES = {
  health: "GET /health",

  // ---- public ----
  registerTenant: "POST /api/auth/register", // RegisterTenantInput → { token, user, tenant }
  login: "POST /api/auth/login", // LoginInput → { token, user, tenant | null }
  me: "GET /api/auth/me", // → { user, tenant | null }
  changePassword: "POST /api/auth/password", // ChangePasswordSchema
  invitePreview: "GET /api/auth/invite/:token", // → { name, email, role, tenantName }
  acceptInvite: "POST /api/auth/invite/accept", // AcceptInviteSchema → { token, user, tenant }
  publicInvoice: "GET /api/public/invoices/:tenantSlug/:number", // → PublicInvoice
  publicInvoicePdf: "GET /api/public/invoices/:tenantSlug/:number/pdf", // → application/pdf
  publicTenant: "GET /api/public/tenants/:slug", // → { name, slogan, address, phone, logoUrl, type }

  // ---- tenant ----
  tenant: "GET /api/tenant", // → Tenant
  updateTenant: "PATCH /api/tenant", // UpdateTenantInput → Tenant
  uploadLogo: "POST /api/tenant/logo", // multipart "file" → Tenant

  users: "GET /api/users",
  inviteUser: "POST /api/users/invite", // InviteUserInput → { inviteUrl, user }
  updateUser: "PATCH /api/users/:id",
  deleteUser: "DELETE /api/users/:id",

  dashboard: "GET /api/dashboard", // → DashboardData

  customers: "GET /api/customers?q=&page=&limit=",
  createCustomer: "POST /api/customers",
  customer: "GET /api/customers/:id", // → Customer with vehicles[]
  updateCustomer: "PATCH /api/customers/:id",
  deleteCustomer: "DELETE /api/customers/:id",
  customerOrders: "GET /api/customers/:id/orders",

  vehicles: "GET /api/vehicles?q=&customerId=",
  createVehicle: "POST /api/vehicles",
  vehicle: "GET /api/vehicles/:id", // → Vehicle with customer
  updateVehicle: "PATCH /api/vehicles/:id",
  deleteVehicle: "DELETE /api/vehicles/:id",
  vehicleOrders: "GET /api/vehicles/:id/orders",
  searchByPlate: "GET /api/vehicles/plate/:plate", // → Vehicle with customer | 404

  products: "GET /api/products?q=&category=&lowStock=1&page=&limit=",
  createProduct: "POST /api/products", // ProductInput
  product: "GET /api/products/:id", // → Product & { movements: StockMovement[] }
  updateProduct: "PATCH /api/products/:id",
  deleteProduct: "DELETE /api/products/:id", // soft (active=false)
  productMovement: "POST /api/products/:id/movements", // StockMovementInput (entrada/ajuste)
  productAdjust: "POST /api/products/:id/adjust", // StockAdjustSchema
  productPhoto: "POST /api/products/:id/photos", // multipart "file" → Product
  readLabel: "POST /api/products/read-label", // multipart "file" → LabelReadResult
  productsImport: "POST /api/products/import", // multipart "file" (xlsx/csv) → { created, updated, errors }
  productsExport: "GET /api/products/export", // → xlsx
  lowStock: "GET /api/products/low-stock",
  movements: "GET /api/movements?productId=&type=&from=&to=",

  services: "GET /api/services",
  createService: "POST /api/services",
  updateService: "PATCH /api/services/:id",
  deleteService: "DELETE /api/services/:id",

  orders: "GET /api/orders?status=&q=&customerId=&vehicleId=&from=&to=&page=&limit=",
  createOrder: "POST /api/orders", // OrderInput → Order
  order: "GET /api/orders/:id", // → Order with customer, vehicle, payments
  updateOrder: "PATCH /api/orders/:id", // OrderInput (partial) – only while not pagada/anulada
  orderStatus: "POST /api/orders/:id/status", // OrderStatusChangeInput → Order
  orderDeductPreview: "GET /api/orders/:id/deduct-preview", // → [{productId,name,qty,stock,after}]
  orderPay: "POST /api/orders/:id/pay", // PaymentInput → Order (status pagada)
  orderPhoto: "POST /api/orders/:id/photos", // multipart "file"
  orderInvoice: "GET /api/orders/:id/invoice", // → { invoice: PublicInvoice, text, whatsappUrl, publicUrl }
  orderPdf: "GET /api/orders/:id/pdf",

  payments: "GET /api/payments?from=&to=",
  expenses: "GET /api/expenses?from=&to=",
  createExpense: "POST /api/expenses",
  deleteExpense: "DELETE /api/expenses/:id",
  cashDay: "GET /api/cash/day?date=", // → { date, totals, closing | null, payments, expenses }
  closeDay: "POST /api/cash/close", // CloseDaySchema → CashClosing
  reopenDay: "POST /api/cash/reopen", // { date }
  closings: "GET /api/cash/closings?from=&to=",

  reportSales: "GET /api/reports/sales?from=&to=", // → ReportSales
  reportExport: "GET /api/reports/sales/export?from=&to=", // → xlsx

  assistant: "POST /api/assistant", // AssistantInput → AssistantProposal
  assistantTranscribe: "POST /api/assistant/transcribe", // multipart "audio" → { text }

  upload: "POST /api/uploads", // multipart "file" → { url }

  audit: "GET /api/audit?limit=",

  // ---- superadmin ----
  saTenants: "GET /api/superadmin/tenants?q=",
  saTenant: "GET /api/superadmin/tenants/:id",
  saUpdateTenant: "PATCH /api/superadmin/tenants/:id", // SuperadminUpdateTenantSchema
  saImpersonate: "POST /api/superadmin/tenants/:id/impersonate", // → { token } (audited)
  saStats: "GET /api/superadmin/stats",
} as const;

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
