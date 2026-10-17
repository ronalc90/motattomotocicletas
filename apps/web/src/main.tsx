import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import "./index.css";
import "./styles/fx.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false } },
});

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "Inter, system-ui, sans-serif" } }} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
