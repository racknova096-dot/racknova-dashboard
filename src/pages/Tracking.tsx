import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Activity,
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Edit,
} from "lucide-react";

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
        icon: <TrendingUp className="h-3 w-3" />,
      },
      Egreso: {
        variant: "destructive",
        icon: <TrendingDown className="h-3 w-3" />,
      },
      Edición: {
        variant: "secondary",
        icon: <Edit className="h-3 w-3" />,
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
      const matchesSearch =
        movement.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.productSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.location.toLowerCase().includes(searchTerm.toLowerCase());

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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Historial de Movimientos
          </h1>
          <p className="text-muted-foreground">
            Consulta ingresos, egresos, costos y ganancias del inventario.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar por producto, SKU o ubicación..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                onChange={(e) => setFilterDate(e.target.value)}
              />

              <Button
                variant="outline"
                onClick={() => setSortDesc((prev) => !prev)}
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Ordenar por fecha
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Mostrando {filteredMovements.length} de {movements.length}{" "}
              movimientos
            </CardTitle>
          </CardHeader>

          <CardContent>
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
                    <TableCell colSpan={12} className="text-center py-8">
                      No se encontraron movimientos
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

                        <TableCell>
                          <Badge variant="outline">
                            {movement.productSku}
                          </Badge>
                        </TableCell>

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

                        <TableCell>
                          <Badge variant="secondary">
                            {movement.location}
                          </Badge>
                        </TableCell>

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

                        <TableCell>
                          <Badge variant="outline">{movement.user}</Badge>
                        </TableCell>

                        <TableCell>{formatDate(movement.timestamp)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          Nota: En ingresos se muestra el costo total del inventario agregado.
          En egresos se muestra ingreso de venta, costo total y ganancia.
        </p>
      </div>
    </div>
  );
}
