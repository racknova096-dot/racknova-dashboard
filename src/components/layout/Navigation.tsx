import React from "react";
import { Link, useLocation } from "react-router-dom";
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
  Bot,
  LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { getCurrentRole, UserRole } from "@/lib/roles";

const navItems: {
  path: string;
  label: string;
  icon: React.ElementType;
  color: string;
  allowedRoles: UserRole[];
}[] = [
  {
    path: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    color: "from-blue-500 to-cyan-500",
    allowedRoles: ["admin", "operator", "viewer"],
  },
  {
    path: "/add",
    label: "Agregar",
    icon: Plus,
    color: "from-emerald-500 to-teal-500",
    allowedRoles: ["admin", "operator"],
  },
  {
    path: "/products",
    label: "Productos",
    icon: Table,
    color: "from-orange-500 to-amber-500",
    allowedRoles: ["admin", "operator", "viewer"],
  },
  {
    path: "/tracking",
    label: "Trackeo",
    icon: Activity,
    color: "from-purple-500 to-violet-500",
    allowedRoles: ["admin", "operator", "viewer"],
  },
  {
    path: "/finanzas",
    label: "Finanzas",
    icon: DollarSign,
    color: "from-green-500 to-emerald-500",
    allowedRoles: ["admin"],
  },
  {
    path: "/reportes",
    label: "Reportes",
    icon: BarChart3,
    color: "from-pink-500 to-rose-500",
    allowedRoles: ["admin", "operator", "viewer"],
  },
  {
    path: "/catalogo",
    label: "Catálogo",
    icon: BookOpen,
    color: "from-sky-500 to-blue-500",
    allowedRoles: ["admin", "operator"],
  },
  {
    path: "/racknova-ia",
    label: "RackNova IA",
    icon: Bot,
    color: "from-blue-600 to-cyan-500",
    allowedRoles: ["admin", "operator"],
  },
  {
    path: "/usuarios",
    label: "Usuarios",
    icon: Users,
    color: "from-indigo-500 to-purple-500",
    allowedRoles: ["admin"],
  },
];

const getRoleLabel = (role: UserRole | null) => {
  if (role === "admin") return "Administrador";
  if (role === "operator") return "Operador";
  if (role === "viewer") return "Visor";
  return "Usuario";
};

export function Navigation() {
  const location = useLocation();
  const role = getCurrentRole();

  const usuario = localStorage.getItem("usuario");
  const nombre = localStorage.getItem("nombre");

  const visibleItems = navItems.filter(
    (item) => role && item.allowedRoles.includes(role)
  );

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("nombre");
    localStorage.removeItem("rol");

    window.location.href = "/login";
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
            {visibleItems.map((item) => {
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

            <div className="hidden xl:flex flex-col items-end px-3 py-1 rounded-xl border bg-muted/40">
              <span className="text-xs font-medium leading-tight">
                {nombre || usuario || "Usuario"}
              </span>
              <span className="text-[11px] text-muted-foreground leading-tight">
                {getRoleLabel(role)}
              </span>
            </div>

            <ThemeToggle />

            <Button
              variant="outline"
              onClick={handleLogout}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/30"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
