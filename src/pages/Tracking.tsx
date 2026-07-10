import React, { useState } from "react";
import {
  Activity,
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Edit,
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

export default function Tracking() {
  const { movements } = useInventory();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [sortDesc, setSortDesc] = useState(true);

  const money = (value: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(Number(value || 0));

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getLocalDateKey = (date: Date) => {
    const localDate = new Date(date);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

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
        icon: <TrendingUp className="h-3.5 w-3.5" />,
      },
      Egreso: {
        variant: "destructive",
        icon: <TrendingDown className="h-3.5 w-3.5" />,
      },
      Edición: {
        variant: "secondary",
        icon: <Edit className="h-3.5 w-3.5" />,
      },
    };

    return (
      <Badge variant={variants[action].variant} className="gap-1">
        {variants[action].icon}
        {action}
      </Badge>
    );
  };

  const filteredMovements = movements
    .filter((movement) => {
      const term = searchTerm.toLowerCase();

      const matchesSearch =
        movement.productName.toLowerCase().includes(term) ||
        movement.productSku.toLowerCase().includes(term) ||
        movement.location.toLowerCase().includes(term);

      const matchesAction =
        filterAction === "all" || movement.action === filterAction;

      const matchesDate =
        !filterDate || getLocalDateKey(movement.timestamp) === filterDate;

      return matchesSearch && matchesAction && matchesDate;
    })
    .sort((a, b) =>
      sortDesc
        ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

  const totalIngresos = movements.filter(
    (movement) => movement.action === "Ingreso"
  ).length;

  const totalEgresos = movements.filter(
    (movement) => movement.action === "Egreso"
  ).length;

  const totalEdiciones = movements.filter(
    (movement) => movement.action === "Edición"
  ).length;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHero
        badge="Auditoría operativa"
        title="Historial de Movimientos"
        description="Consulta entradas, salidas, ediciones, costos, ventas y ganancias registradas en el inventario."
        icon={Activity}
        stats={[
          {
            label: "Movimientos totales",
            value: movements.length,
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
        Esta sección funciona como bitácora de inventario para revisar qué se
        agregó, qué se vendió o retiró y qué cambios se hicieron.
      </PageHero>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

              <Input
                placeholder="Buscar por producto, SKU o ubicación..."
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

            <Input
              type="date"
              value={filterDate}
              onChange={(event) => setFilterDate(event.target.value)}
            />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-between">
            <Button
              variant="outline"
              onClick={() => setSortDesc((prev) => !prev)}
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Ordenar por fecha
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setFilterAction("all");
                setFilterDate("");
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle>
            Mostrando {filteredMovements.length} de {movements.length}{" "}
            movimientos
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableHead>Fecha y Hora</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={12}
                      className="text-center text-muted-foreground py-8"
                    >
                      No se encontraron movimientos.
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
                          {movement.action === "Edición" ? (
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

                        <TableCell>{formatDate(movement.timestamp)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-sm text-muted-foreground mt-4">
            Nota: En ingresos se muestra el costo total del inventario agregado.
            En egresos se muestra ingreso de venta, costo total y ganancia.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
