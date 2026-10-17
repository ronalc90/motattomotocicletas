import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "@/layouts/PublicLayout";
import { AppShell } from "@/layouts/AppShell";
import { SuperadminShell } from "@/layouts/SuperadminShell";
import { RequireCan, RequireSuperadmin, RequireTenantUser } from "@/components/layout/Guards";
import { PageLoader } from "@/components/ui";
import { Landing } from "@/pages/public/Landing";
import { Registro, Invitacion } from "@/pages/public/Auth";
import { Login } from "@/pages/public/Login";
import { NotFound } from "@/pages/NotFound";

const ComoFunciona = lazy(() => import("@/pages/public/ComoFunciona").then((m) => ({ default: m.ComoFunciona })));
const Precios = lazy(() => import("@/pages/public/Precios").then((m) => ({ default: m.Precios })));
const Nosotros = lazy(() => import("@/pages/public/Nosotros").then((m) => ({ default: m.Nosotros })));
const PublicInvoicePage = lazy(() => import("@/pages/public/PublicInvoicePage").then((m) => ({ default: m.PublicInvoicePage })));
const Dashboard = lazy(() => import("@/pages/app/Dashboard").then((m) => ({ default: m.Dashboard })));
const Onboarding = lazy(() => import("@/pages/app/Onboarding").then((m) => ({ default: m.Onboarding })));
const Orders = lazy(() => import("@/pages/app/Orders").then((m) => ({ default: m.Orders })));
const OrderForm = lazy(() => import("@/pages/app/OrderForm").then((m) => ({ default: m.OrderForm })));
const OrderDetail = lazy(() => import("@/pages/app/OrderDetail").then((m) => ({ default: m.OrderDetail })));
const Assistant = lazy(() => import("@/pages/app/Assistant").then((m) => ({ default: m.Assistant })));
const Customers = lazy(() => import("@/pages/app/Customers").then((m) => ({ default: m.Customers })));
const CustomerDetail = lazy(() => import("@/pages/app/Customers").then((m) => ({ default: m.CustomerDetail })));
const VehicleDetail = lazy(() => import("@/pages/app/Customers").then((m) => ({ default: m.VehicleDetail })));
const Inventory = lazy(() => import("@/pages/app/Inventory").then((m) => ({ default: m.Inventory })));
const InventoryEntry = lazy(() => import("@/pages/app/InventoryEntry").then((m) => ({ default: m.InventoryEntry })));
const ProductDetail = lazy(() => import("@/pages/app/ProductDetail").then((m) => ({ default: m.ProductDetail })));
const Services = lazy(() => import("@/pages/app/Services").then((m) => ({ default: m.Services })));
const Cash = lazy(() => import("@/pages/app/Cash").then((m) => ({ default: m.Cash })));
const Reports = lazy(() => import("@/pages/app/Reports").then((m) => ({ default: m.Reports })));
const Settings = lazy(() => import("@/pages/app/Settings").then((m) => ({ default: m.Settings })));
const SaStats = lazy(() => import("@/pages/superadmin/Superadmin").then((m) => ({ default: m.SaStats })));
const SaTenants = lazy(() => import("@/pages/superadmin/Superadmin").then((m) => ({ default: m.SaTenants })));
const SaTenantDetail = lazy(() => import("@/pages/superadmin/Superadmin").then((m) => ({ default: m.SaTenantDetail })));
const SaAi = lazy(() => import("@/pages/superadmin/Superadmin").then((m) => ({ default: m.SaAi })));

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/como-funciona" element={<ComoFunciona />} />
            <Route path="/precios" element={<Precios />} />
            <Route path="/nosotros" element={<Nosotros />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/invitacion/:token" element={<Invitacion />} />
          <Route path="/cc/:tenantSlug/:number" element={<PublicInvoicePage />} />

          <Route path="/app" element={<RequireTenantUser><AppShell /></RequireTenantUser>}>
            <Route index element={<Dashboard />} />
            <Route path="bienvenida" element={<RequireCan perm="tenant:settings"><Onboarding /></RequireCan>} />
            <Route path="ordenes" element={<Orders />} />
            <Route path="ordenes/nueva" element={<RequireCan perm="orders:write"><OrderForm /></RequireCan>} />
            <Route path="ordenes/:id" element={<OrderDetail />} />
            <Route path="ordenes/:id/editar" element={<RequireCan perm="orders:write"><OrderForm /></RequireCan>} />
            <Route path="asistente" element={<RequireCan perm="assistant:use"><Assistant /></RequireCan>} />
            <Route path="clientes" element={<Customers />} />
            <Route path="clientes/:id" element={<CustomerDetail />} />
            <Route path="vehiculos/:id" element={<VehicleDetail />} />
            <Route path="inventario" element={<Inventory />} />
            <Route path="inventario/entrada" element={<RequireCan perm="inventory:entry"><InventoryEntry /></RequireCan>} />
            <Route path="inventario/:id" element={<ProductDetail />} />
            <Route path="servicios" element={<RequireCan perm="services:manage"><Services /></RequireCan>} />
            <Route path="caja" element={<RequireCan perm="cash:read"><Cash /></RequireCan>} />
            <Route path="reportes" element={<RequireCan perm="reports:read"><Reports /></RequireCan>} />
            <Route path="configuracion" element={<Settings />} />
            <Route path="configuracion/usuarios" element={<Navigate to="/app/configuracion?tab=usuarios" replace />} />
          </Route>

          <Route path="/superadmin" element={<RequireSuperadmin><SuperadminShell /></RequireSuperadmin>}>
            <Route index element={<SaStats />} />
            <Route path="talleres" element={<SaTenants />} />
            <Route path="talleres/:id" element={<SaTenantDetail />} />
            <Route path="ia" element={<SaAi />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
