import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { InventoryProvider } from "@/context/InventoryContext";
import { Navigation } from "@/components/layout/Navigation";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

// 🧩 Páginas
import Index from "./pages/Index";
import AddProduct from "./pages/AddProduct";
import ProductList from "./pages/ProductList";
import Tracking from "./pages/Tracking";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import RackView from "./pages/RackView";
import Usuarios from "./pages/Usuarios";
import ProtectedRoute from "./pages/ProtectedRoute";

// 🔒 Layout de protección global
import ProtectedLayout from "@/components/layout/ProtectedLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <TooltipProvider>
        <InventoryProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <div className="min-h-screen bg-background">
              {/* Oculta el menú si estás en /login */}
              {window.location.pathname !== "/login" && <Navigation />}

              <Routes>
                {/* 🔓 Rutas públicas */}
                <Route path="/login" element={<Login />} />

                {/* 🔐 Grupo de rutas protegidas */}
                <Route element={<ProtectedLayout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/add-product" element={<AddProduct />} />
                  <Route path="/products" element={<ProductList />} />
                  <Route path="/tracking" element={<Tracking />} />
                  <Route path="/rackview" element={<RackView />} />
                </Route>

                {/* 🚫 Página no encontrada */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </BrowserRouter>
        </InventoryProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
