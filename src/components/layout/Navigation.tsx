import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Package,
  Table,
  LayoutDashboard,
  Plus,
  Users,
  Activity,
  DollarSign,
  BarChart3,
  BookOpen,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const navItems = [
  {
    path: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    color: "from-blue-500 to-cyan-500",
  },
  {
    path: "/add",
    label: "Agregar",
    icon: Plus,
    color: "from-emerald-500 to-teal-500",
  },
  {
    path: "/products",
    label: "Productos",
    icon: Table,
    color: "from-orange-500 to-amber-500",
  },
  {
    path: "/tracking",
    label: "Trackeo",
    icon: Activity,
    color: "from-purple-500 to-violet-500",
  },
  {
    path: "/finanzas",
    label: "Finanzas",
    icon: DollarSign,
    color: "from-green-500 to-emerald-500",
  },
  {
    path: "/reportes",
    label: "Reportes",
    icon: BarChart3,
    color: "from-pink-500 to-rose-500",
  },
  {
  path: "/catalogo",
  label: "Catálogo",
  icon: BookOpen,
  color: "from-sky-500 to-blue-500",
},
];

export function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Link to="/" className="group flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-primary shadow-lg flex items-center justify-center transition-transform group-hover:scale-105">
              <Package className="h-6 w-6 text-white" />
            </div>

            <div>
              <h1 className="text-xl font-black tracking-tight racknova-page-title">
                RackNova
              </h1>
              <p className="text-xs text-muted-foreground">
                Sistema inteligente de inventario
              </p>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={active ? "default" : "ghost"}
                    className={
                      active
                        ? `bg-gradient-to-r ${item.color} text-white shadow-md hover:opacity-95`
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                    }
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}

            {false && (
              <Link to="/usuarios">
                <Button
                  variant={isActive("/usuarios") ? "default" : "ghost"}
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Usuarios
                </Button>
              </Link>
            )}

            <div className="ml-1">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
