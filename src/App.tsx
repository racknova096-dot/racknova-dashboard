import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { InventoryProvider } from "@/context/InventoryContext";
import { Navigation } from "@/components/layout/Navigation";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { RackNovaIAAssistant } from "@/components/ia/RackNovaIAAssistant";
import { canUseIA } from "@/lib/roles";

import Finanzas from "./pages/Finanzas";
import Reportes from "./pages/Reportes";
import Index from "./pages/Index";
import AddProduct from "./pages/AddProduct";
import ProductList from "./pages/ProductList";
import Tracking from "./pages/Tracking";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import RackView from "./pages/RackView";
import RackNovaIA from "./pages/RackNovaIA";
import Catalogo from "./pages/Catalogo";
import Usuarios from "./pages/Usuarios";
import ProtectedRoute from "./pages/ProtectedRoute";
import ProtectedLayout from "@/components/layout/ProtectedLayout";

const queryClient = new QueryClient();

const App = () => {
  const isLoginPage = window.location.pathname === "/login";
  const showIAAssistant = !isLoginPage && canUseIA();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <TooltipProvider>
          <InventoryProvider>
            <Toaster />
            <Sonner />

            <BrowserRouter>
              <div className="min-h-screen bg-background">
                {!isLoginPage && <Navigation />}
                {showIAAssistant && <RackNovaIAAssistant />}

                <Routes>
                  <Route path="/login" element={<Login />} />

                  <Route element={<ProtectedLayout />}>
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute
                          allowedRoles={["admin", "operator", "viewer"]}
                        >
                          <Index />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/add"
                      element={
                        <ProtectedRoute allowedRoles={["admin", "operator"]}>
                          <AddProduct />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/add-product"
                      element={
                        <ProtectedRoute allowedRoles={["admin", "operator"]}>
                          <AddProduct />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/products"
                      element={
                        <ProtectedRoute
                          allowedRoles={["admin", "operator", "viewer"]}
                        >
                          <ProductList />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/tracking"
                      element={
                        <ProtectedRoute
                          allowedRoles={["admin", "operator", "viewer"]}
                        >
                          <Tracking />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/reportes"
                      element={
                        <ProtectedRoute
                          allowedRoles={["admin", "operator", "viewer"]}
                        >
                          <Reportes />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/finanzas"
                      element={
                        <ProtectedRoute allowedRoles={["admin"]}>
                          <Finanzas />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/catalogo"
                      element={
                        <ProtectedRoute allowedRoles={["admin", "operator"]}>
                          <Catalogo />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/racknova-ia"
                      element={
                        <ProtectedRoute allowedRoles={["admin", "operator"]}>
                          <RackNovaIA />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/usuarios"
                      element={
                        <ProtectedRoute allowedRoles={["admin"]}>
                          <Usuarios />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/rackview"
                      element={
                        <ProtectedRoute allowedRoles={["admin", "operator"]}>
                          <RackView />
                        </ProtectedRoute>
                      }
                    />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </BrowserRouter>
          </InventoryProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
