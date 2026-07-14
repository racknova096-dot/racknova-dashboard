import React, { useMemo, useState } from "react";
import {
  Activity,
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Edit,
  CalendarDays,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";
import { useInventory } from "@/context/InventoryContext";
import { MovementRecord } from "@/types/movement";
import { PageHero } from "@/components/layout/PageHero";

import {
  DatePeriod,
  formatDateTimeDDMMYYYY,
  getPeriodLabel,
  isDateInPeriod,
} from "@/lib/dateFormat";

export default function Tracking() {
  const { movements } = useInventory();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState<DatePeriod>("all");
  const [sortDesc, setSortDesc] = useState(true);

  const money = (value: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(Number(value || 0));

  const getActionBadge = (action: MovementRecord["action"]) => {
    const variants: Record<
      MovementRecord["action"],
      {
        variant: "default" | "destructive" | "secondary" | "outline";
        icon: React.ReactNode;
      }
    > = {
      Ingreso: {
        variant: "default",
        icon: <TrendingUp className="h-3 w-3 mr-1" />,
      },
      Egreso: {
        variant: "destructive",
        icon: <TrendingDown className="h-3 w-3 mr-1" />,
      },
      Edición: {
        variant: "secondary",
        icon: <Edit className="h-3 w-3 mr-1" />,
      },
    };

    return (
      <Badge variant={variants[action].variant}>
        {variants[action].icon}
        {action}
      </Badge>
    );
  };

  const filteredMovements = useMemo(() => {
    return movements
      .filter((movement) => {
        const term = searchTerm.trim().toLowerCase();

        const matchesSearch =
          !term ||
          movement.productName.toLowerCase().includes(term) ||
          movement.productSku.toLowerCase().includes(term) ||
          movement.location.toLowerCase().includes(term) ||
          movement.user.toLowerCase().includes(term);

        const matchesAction =
          filterAction === "all" || movement.action === filterAction;

        const matchesPeriod = isDateInPeriod(
          movement.timestamp,
          filterPeriod
        );

        return matchesSearch && matchesAction && matchesPeriod;
      })
      .sort((a, b) =>
        sortDesc
          ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }, [movements, searchTerm, filterAction, filterPeriod, sortDesc]);

  const periodMovements = useMemo(() => {
    return movements.filter((movement) =>
      isDateInPeriod(movement.timestamp, filterPeriod)
    );
  }, [movements, filterPeriod]);

  const totalIngresos = periodMovements.filter(
    (movement) => movement.action === "Ingreso"
  ).length;

  const totalEgresos = periodMovements.filter(
    (movement) => movement.action === "Egreso"
  ).length;

  const totalEdiciones = periodMovements.filter(
    (movement) => movement.action === "Edición"
  ).length;

  const totalIngresosVenta = periodMovements
    .filter((movement) => movement.action === "Egreso")
    .reduce(
      (total, movement) => total + Number(movement.ingreso_total ?? 0),
      0
    );

  const totalGanancia = periodMovements
    .filter((movement) => movement.action === "Egreso")
    .reduce((total, movement) => total + Number(movement.ganancia ?? 0), 0);

  const resetFilters = () => {
    setSearchTerm("");
    setFilterAction("all");
    setFilterPeriod("all");
  };

  return (
    <div className="space-y-8">
      <PageHero
        badge="Bitácora operativa"
        title="Trackeo"
        description="Consulta movimientos de inventario por periodo, producto, usuario, ubicación y tipo de acción."
        icon={Activity}
        stats={[
          {
            label: "Movimientos visibles",
            value: filteredMovements.length,
            tone: "blue",
          },
          {
            label: "Ingresos",
            value: totalIngresos,
            tone: "green",
          },
          {
            label: "Egresos",
            value: totalEgresos,
            tone: "red",
          },
          {
            label: "Ganancia",
            value: money(totalGanancia),
            tone: totalGanancia >= 0 ? "green" : "red",
          },
        ]}
      >
        Periodo activo:{" "}
        <span className="font-semibold">{getPeriodLabel(filterPeriod)}</span>.
        Esta sección funciona como bitácora para revisar qué se agregó, qué se
        vendió o retiró y qué cambios se hicieron.
      </PageHero>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="racknova-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Ingresos</p>
            <p className="text-3xl font-bold text-emerald-600">
              {totalIngresos}
            </p>
            <p className="text-xs text-muted-foreground">
              productos agregados en el periodo
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Egresos</p>
            <p className="text-3xl font-bold text-red-600">{totalEgresos}</p>
            <p className="text-xs text-muted-foreground">
              salidas o ventas en el periodo
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Ediciones</p>
            <p className="text-3xl font-bold text-blue-600">
              {totalEdiciones}
            </p>
            <p className="text-xs text-muted-foreground">
              cambios registrados en el periodo
            </p>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Ingreso por ventas</p>
            <p className="text-3xl font-bold text-emerald-600">
              {money(totalIngresosVenta)}
            </p>
            <p className="text-xs text-muted-foreground">
              ventas registradas en el periodo
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px_auto_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

              <Input
                placeholder="Buscar por producto, SKU, ubicación o usuario..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger>
                <SelectValue placeholder="Acción" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                <SelectItem value="Ingreso">Ingreso</SelectItem>
                <SelectItem value="Egreso">Egreso</SelectItem>
                <SelectItem value="Edición">Edición</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterPeriod}
              onValueChange={(value) => setFilterPeriod(value as DatePeriod)}
            >
              <SelectTrigger>
                <CalendarDays className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="1m">Último mes</SelectItem>
                <SelectItem value="1y">Último año</SelectItem>
                <SelectItem value="all">Todo el historial</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => setSortDesc((prev) => !prev)}>
              <ArrowUpDown className="h-4 w-4 mr-2" />
              {sortDesc ? "Más recientes" : "Más antiguos"}
            </Button>

            <Button variant="outline" onClick={resetFilters}>
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>Historial de movimientos</span>

            <span className="text-sm font-normal text-muted-foreground">
              Mostrando {filteredMovements.length} de {movements.length}{" "}
              movimientos
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="racknova-table-header">
                  <TableHead>Acción</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Costo proveedor</TableHead>
                  <TableHead>Precio venta</TableHead>
                  <TableHead>Ingreso venta</TableHead>
                  <TableHead>Costo total</TableHead>
                  <TableHead>Ganancia</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Fecha y hora</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={12}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No se encontraron movimientos con los filtros
                      seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((movement) => {
                    const precioVenta = Number(movement.precio_venta ?? 0);
                    const ingresoTotal = Number(movement.ingreso_total ?? 0);
                    const costoProveedor = Number(
                      movement.costo_proveedor ?? 0
                    );
                    const costoTotal = Number(movement.costo_total ?? 0);
                    const ganancia = Number(movement.ganancia ?? 0);

                    return (
                      <TableRow key={movement.id}>
                        <TableCell>{getActionBadge(movement.action)}</TableCell>

                        <TableCell className="font-medium">
                          {movement.productName}
                        </TableCell>

                        <TableCell>{movement.productSku}</TableCell>

                        <TableCell>
                          {movement.action === "Edición" &&
                          movement.previousQuantity !== undefined &&
                          movement.newQuantity !== undefined ? (
                            <span>
                              {movement.previousQuantity} →{" "}
                              {movement.newQuantity}
                            </span>
                          ) : (
                            movement.quantity
                          )}
                        </TableCell>

                        <TableCell>{movement.location}</TableCell>

                        <TableCell>{money(costoProveedor)}</TableCell>

                        <TableCell>
                          {movement.action === "Egreso"
                            ? money(precioVenta)
                            : "-"}
                        </TableCell>

                        <TableCell>
                          {movement.action === "Egreso"
                            ? money(ingresoTotal)
                            : "-"}
                        </TableCell>

                        <TableCell>{money(costoTotal)}</TableCell>

                        <TableCell>
                          {movement.action === "Egreso" ? (
                            <span
                              className={
                                ganancia >= 0
                                  ? "text-green-600 font-semibold"
                                  : "text-red-600 font-semibold"
                              }
                            >
                              {money(ganancia)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>

                        <TableCell>{movement.user}</TableCell>

                        <TableCell>
                          {formatDateTimeDDMMYYYY(movement.timestamp)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Nota: en ingresos se muestra el costo total del inventario agregado.
            En egresos se muestra ingreso de venta, costo total y ganancia.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
