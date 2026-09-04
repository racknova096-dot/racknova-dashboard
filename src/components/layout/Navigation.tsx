import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  ChevronDown,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  ShoppingCart,
  Settings,
  Table,
  UserCircle2,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { obtenerEstadoPOS } from "@/lib/pos";
import type { POSEstado } from "@/lib/pos";

type NavItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  color: string;
};

const primaryItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, color: "from-blue-500 to-cyan-500" },
  { path: "/add", label: "Agregar", icon: Plus, color: "from-emerald-500 to-teal-500" },
  { path: "/products", label: "Productos", icon: Table, color: "from-orange-500 to-amber-500" },
];

const posNavItem: NavItem = {
  path: "/pos",
  label: "Punto de Venta",
  icon: ShoppingCart,
  color: "from-fuchsia-500 to-pink-500",
};

const operationItems: NavItem[] = [
  { path: "/tracking", label: "Trackeo", icon: Activity, color: "from-purple-500 to-violet-500" },
  { path: "/finanzas", label: "Finanzas", icon: DollarSign, color: "from-green-500 to-emerald-500" },
  { path: "/reportes", label: "Reportes", icon: BarChart3, color: "from-pink-500 to-rose-500" },
];

const managementItems: NavItem[] = [
  { path: "/catalogo", label: "Catálogo", icon: BookOpen, color: "from-sky-500 to-blue-500" },
  { path: "/racknova-ia", label: "RackNova IA", icon: Bot, color: "from-blue-600 to-cyan-500" },
  { path: "/usuarios", label: "Usuarios", icon: Users, color: "from-indigo-500 to-purple-500" },
  { path: "/configuracion", label: "Configuración", icon: Settings, color: "from-slate-500 to-slate-700" },
];

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  operator: "Operador",
  viewer: "Consulta",
};

export function Navigation() {
  const location = useLocation();
  const [posState, setPosState] = useState<POSEstado | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const role = (localStorage.getItem("rol") || "viewer").toLowerCase();
  const canUsePOS = role === "admin" || role === "operator";
  const userName =
    localStorage.getItem("nombre") ||
    localStorage.getItem("usuario") ||
    "Usuario RackNova";
  const userEmail = localStorage.getItem("usuario") || "";
  const roleLabel = roleLabels[role] || role;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await obtenerEstadoPOS();
        if (mounted) setPosState(response);
      } catch {
        if (mounted) setPosState(null);
      }
    };
    const handleStateChanged = (event: Event) => {
      const customEvent = event as CustomEvent<POSEstado>;
      if (customEvent.detail) setPosState(customEvent.detail);
    };
    void load();
    window.addEventListener("racknova:pos-state-changed", handleStateChanged);
    return () => {
      mounted = false;
      window.removeEventListener("racknova:pos-state-changed", handleStateChanged);
    };
  }, []);

  // RACKNOVA_MENU_POR_ROL
  const allowedPaths = useMemo(() => {
    if (role === "viewer") {
      return new Set(["/", "/products"]);
    }

    if (role === "operator") {
      return new Set([
        "/",
        "/add",
        "/products",
        "/tracking",
        "/reportes",
        "/catalogo",
        "/racknova-ia",
        "/configuracion",
      ]);
    }

    return null;
  }, [role]);

  const visiblePrimaryItems = useMemo(() => {
    const items = allowedPaths
      ? primaryItems.filter((item) => allowedPaths.has(item.path))
      : [...primaryItems];

    if (
      role !== "viewer" &&
      canUsePOS &&
      posState?.habilitado
    ) {
      return [...items, posNavItem];
    }

    return items;
  }, [allowedPaths, canUsePOS, posState?.habilitado, role]);

  const visibleOperationItems = useMemo(
    () =>
      allowedPaths
        ? operationItems.filter((item) => allowedPaths.has(item.path))
        : [...operationItems],
    [allowedPaths]
  );

  const visibleManagementItems = useMemo(
    () =>
      allowedPaths
        ? managementItems.filter((item) => allowedPaths.has(item.path))
        : [...managementItems],
    [allowedPaths]
  );

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const groupIsActive = (items: NavItem[]) =>
    items.some((item) => isActive(item.path));

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("nombre");
    localStorage.removeItem("rol");
    window.location.href = `${import.meta.env.BASE_URL}login`;
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/95 shadow-[0_1px_0_hsl(222_47%_11%/0.025)] backdrop-blur-2xl">
      <div className="mx-auto max-w-[1500px] px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="group flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 shadow-lg shadow-slate-950/15 transition-transform group-hover:scale-[1.03] dark:bg-white">
              <Package className="h-6 w-6 text-white dark:text-slate-950" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-tight racknova-page-title sm:text-xl">RackNova</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">Sistema inteligente de inventario</p>
            </div>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex">
            {visiblePrimaryItems.map((item) => (
              <NavButton key={item.path} item={item} active={isActive(item.path)} />
            ))}
            {visibleOperationItems.length > 0 && (
              <NavGroup
                label="Operación"
                items={visibleOperationItems}
                active={groupIsActive(visibleOperationItems)}
                isActive={isActive}
              />
            )}
            {visibleManagementItems.length > 0 && (
              <NavGroup
                label="Gestión"
                items={visibleManagementItems}
                active={groupIsActive(visibleManagementItems)}
                isActive={isActive}
              />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="xl:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" aria-label="Abrir menú">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex w-[88vw] max-w-sm flex-col overflow-hidden p-0">
                  <SheetHeader className="border-b border-border/60 p-5 text-left">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 dark:bg-white">
                        <Package className="h-6 w-6 text-white dark:text-slate-950" />
                      </div>
                      <div>
                        <SheetTitle className="text-xl font-black">RackNova</SheetTitle>
                        <SheetDescription>Menú principal</SheetDescription>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="flex-1 overflow-y-auto p-3">
                    <MobileNavGroup label="Principal" items={visiblePrimaryItems} isActive={isActive} onSelect={() => setMobileMenuOpen(false)} />
                    {visibleOperationItems.length > 0 && <MobileNavGroup label="Operación" items={visibleOperationItems} isActive={isActive} onSelect={() => setMobileMenuOpen(false)} />}
                    {visibleManagementItems.length > 0 && <MobileNavGroup label="Gestión" items={visibleManagementItems} isActive={isActive} onSelect={() => setMobileMenuOpen(false)} />}
                  </div>

                  <div className="border-t border-border/60 bg-secondary/20 p-4">
                    <div className="mb-3 flex items-center gap-3 rounded-xl bg-background p-3">
                      <UserCircle2 className="h-9 w-9 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{userName}</p>
                        <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
                      </div>
                    </div>
                    <Button variant="outline" className="h-11 w-full justify-start text-destructive" onClick={logout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Cerrar sesión
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 max-w-[230px] gap-2 rounded-xl px-3">
                  <UserCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  <span className="hidden min-w-0 text-left md:block">
                    <span className="block truncate text-sm font-semibold">{userName}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{roleLabel}</span>
                  </span>
                  <ChevronDown className="hidden h-4 w-4 shrink-0 md:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block truncate">{userName}</span>
                  <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">{userEmail}</span>
                  <span className="mt-1 block text-xs font-normal text-primary">{roleLabel}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}

function MobileNavGroup({
  label,
  items,
  isActive,
  onSelect,
}: {
  label: string;
  items: NavItem[];
  isActive: (path: string) => boolean;
  onSelect: () => void;
}) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onSelect}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function NavButton({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link to={item.path}>
      <Button
        variant={active ? "default" : "ghost"}
        size="sm"
        className={
          active
            ? "bg-primary text-primary-foreground shadow-md shadow-primary/15 hover:bg-primary/90"
            : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
        }
      >
        <Icon className="mr-2 h-4 w-4" />
        {item.label}
      </Button>
    </Link>
  );
}

function NavGroup({
  label,
  items,
  active,
  isActive,
}: {
  label: string;
  items: NavItem[];
  active: boolean;
  isActive: (path: string) => boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={
            active
              ? "bg-secondary font-semibold text-foreground"
              : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
          }
        >
          {label}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.path} asChild>
              <Link to={item.path} className={isActive(item.path) ? "bg-accent font-semibold" : undefined}>
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
