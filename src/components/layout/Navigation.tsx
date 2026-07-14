import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Table,
  UserCircle,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { getCurrentRole, UserRole } from "@/lib/roles";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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

  const displayName = nombre || usuario || "Usuario";
  const roleLabel = getRoleLabel(role);

  return (
    <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="group flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary shadow-lg transition-transform group-hover:scale-105">
              <Package className="h-6 w-6 text-white" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-xl font-black tracking-tight racknova-page-title">
                RackNova
              </h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                Sistema inteligente de inventario
              </p>
            </div>
          </Link>

          {/* Menú escritorio amplio */}
          <div className="hidden xl:flex xl:items-center xl:gap-2">
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
                        : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                    }
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}

            <div className="ml-2 hidden min-w-[150px] flex-col items-end rounded-xl border bg-muted/40 px-3 py-1.5 2xl:flex">
              <span className="max-w-[160px] truncate text-xs font-medium leading-tight">
                {displayName}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {roleLabel}
              </span>
            </div>

            <ThemeToggle />

            <Button
              variant="outline"
              onClick={handleLogout}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/30"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>

          {/* Menú tablet / celular */}
          <div className="flex items-center gap-2 xl:hidden">
            <div className="hidden min-w-0 flex-col items-end rounded-xl border bg-muted/40 px-3 py-1.5 sm:flex">
              <span className="max-w-[160px] truncate text-xs font-medium leading-tight">
                {displayName}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {roleLabel}
              </span>
            </div>

            <ThemeToggle />

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="shrink-0">
                  <Menu className="mr-2 h-4 w-4" />
                  Menú
                </Button>
              </SheetTrigger>

              <SheetContent
                side="right"
                className="flex w-[88vw] max-w-sm flex-col p-0"
              >
                <SheetHeader className="border-b px-5 py-5 text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-primary shadow-lg">
                      <Package className="h-6 w-6 text-white" />
                    </div>

                    <div className="min-w-0">
                      <SheetTitle className="racknova-page-title">
                        RackNova
                      </SheetTitle>
                      <SheetDescription>
                        Menú principal del sistema
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="border-b px-5 py-4">
                  <div className="flex items-center gap-3 rounded-2xl border bg-muted/40 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
                      <UserCircle className="h-6 w-6 text-muted-foreground" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {roleLabel}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-2">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);

                      return (
                        <SheetClose asChild key={item.path}>
                          <Link
                            to={item.path}
                            className={
                              active
                                ? `flex items-center gap-3 rounded-2xl bg-gradient-to-r ${item.color} px-4 py-3 text-sm font-semibold text-white shadow-md`
                                : "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            }
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        </SheetClose>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t p-4">
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/30"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
