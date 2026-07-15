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
        icon: <TrendingUp className="mr-1 h-3 w-3" />,
      },
      Egreso: {
        variant: "destructive",
        icon: <TrendingDown className="mr-1 h-3 w-3" />,
      },
      Edición: {
        variant: "secondary",
        icon: <Edit className="mr-1 h-3 w-3" />,
      },
    };

    return (
      <Badge variant={variants[action].variant}>
        {variants[action].icon}
        {action}
      </Badge>
    );
  };

  const periodMovements = useMemo(() => {
    return movements.filter((movement) =>
      isDateInPeriod(movement.timestamp, filterPeriod)
    );
  }, [movements, filterPeriod]);

  const filteredMovements = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return movements
      .filter((movement) => {
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
      .sort((a, b) => {
        const firstDate = new Date(a.timestamp).getTime();
        const secondDate = new Date(b.timestamp).getTime();

        return sortDesc
          ? secondDate - firstDate
          : firstDate - secondDate;
      });
  }, [movements, searchTerm, filterAction, filterPeriod, sortDesc]);

  const totalIngresos = useMemo(() => {
    return periodMovements.filter(
      (movement) => movement.action === "Ingreso"
    ).length;
  }, [periodMovements]);

  const totalEgresos = useMemo(() => {
    return periodMovements.filter(
      (movement) => movement.action === "Egreso"
    ).length;
  }, [periodMovements]);

  const totalEdiciones = useMemo(() => {
    return periodMovements.filter(
      (movement) => movement.action === "Edición"
    ).length;
  }, [periodMovements]);

  const resetFilters = () => {
    setSearchTerm("");
    setFilterAction("all");
    setFilterPeriod("all");
    setSortDesc(true);
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
            label: "Movimientos",
            value: periodMovements.length,
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
            label: "Ediciones",
            value: totalEdiciones,
            tone: "purple",
          },
        ]}
      >
        Periodo activo:{" "}
        <span className="font-semibold">
          {getPeriodLabel(filterPeriod)}
        </span>
        . Esta sección funciona como bitácora para revisar qué se agregó, qué
        se vendió o retiró y qué cambios se hicieron.
      </PageHero>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de movimientos
          </CardTitle>

          <p className="text-sm text-muted-foreground">
            Los indicadores del encabezado se actualizan según el periodo
            seleccionado. La búsqueda y el tipo de acción filtran la tabla.
          </p>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px_190px_auto_auto]">
            <div className="relative min-w-0">
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
              onValueChange={(value) =>
                setFilterPeriod(value as DatePeriod)
              }
            >
              <SelectTrigger>
                <CalendarDays className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="1m">Último mes</SelectItem>
                <SelectItem value="1y">Último año</SelectItem>
                <SelectItem value="all">Todo el historial</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setSortDesc((previous) => !previous)}
            >
              <ArrowUpDown className="mr-2 h-4 w-4" />
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Historial de movimientos</CardTitle>

            <span className="text-sm font-normal text-muted-foreground">
              Mostrando {filteredMovements.length} de {periodMovements.length}{" "}
              movimientos del periodo
            </span>
          </div>
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
                    const precioVenta = Number(
                      movement.precio_venta ?? 0
                    );

                    const ingresoTotal = Number(
                      movement.ingreso_total ?? 0
                    );

                    const costoProveedor = Number(
                      movement.costo_proveedor ?? 0
                    );

                    const costoTotal = Number(
                      movement.costo_total ?? 0
                    );

                    const ganancia = Number(
                      movement.ganancia ?? 0
                    );

                    return (
                      <TableRow key={movement.id}>
                        <TableCell>
                          {getActionBadge(movement.action)}
                        </TableCell>

                        <TableCell className="font-medium">
                          {movement.productName}
                        </TableCell>

                        <TableCell className="font-mono">
                          {movement.productSku}
                        </TableCell>

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

                        <TableCell>
                          {money(costoProveedor)}
                        </TableCell>

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

                        <TableCell>
                          {money(costoTotal)}
                        </TableCell>

                        <TableCell>
                          {movement.action === "Egreso" ? (
                            <span
                              className={
                                ganancia >= 0
                                  ? "font-semibold text-green-600"
                                  : "font-semibold text-red-600"
                              }
                            >
                              {money(ganancia)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>

                        <TableCell>{movement.user}</TableCell>

                        <TableCell className="whitespace-nowrap">
                          {formatDateTimeDDMMYYYY(
                            movement.timestamp
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            En los ingresos se muestra el costo del inventario agregado. En
            los egresos se muestran el ingreso de venta, el costo total y la
            ganancia registrada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
