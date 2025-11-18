//modificacion inicia
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
  Filter,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Edit,
} from "lucide-react";

export default function Tracking() {
  // ✅ Ahora usamos directamente el estado reactivo del contexto
  const { movements } = useInventory();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterDate, setFilterDate] = useState("");
  const [sortDesc, setSortDesc] = useState(true);

  // ✅ Filtrado dinámico en tiempo real
  const filteredMovements = movements
    .filter((movement) => {
      const matchesSearch =
        movement.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.productSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAction =
        filterAction === "all" || movement.action === filterAction;

      const matchesDate =
        !filterDate ||
        movement.timestamp.toISOString().split("T")[0] === filterDate;

      return matchesSearch && matchesAction && matchesDate;
    })
    .sort((a, b) =>
      sortDesc
        ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

  // ✅ Badges personalizados según tipo de movimiento
  const getActionBadge = (action: MovementRecord["action"]) => {
    const variants: Record<
      MovementRecord["action"],
      {
        variant: "default" | "destructive" | "secondary" | "outline";
        icon: React.ReactNode;
      }
    > = {
      Ingreso: { variant: "default", icon: <TrendingUp className="h-3 w-3" /> },
      Egreso: {
        variant: "destructive",
        icon: <TrendingDown className="h-3 w-3" />,
      },
      Edición: { variant: "secondary", icon: <Edit className="h-3 w-3" /> },
    };

    return (
      <Badge
        variant={variants[action].variant}
        className="flex items-center gap-1"
      >
        {variants[action].icon}
        {action}
      </Badge>
    );
  };

  // ✅ Formato de fecha amigable
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">
            Historial de Movimientos
          </h1>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Buscar */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="SKU, producto, ubicación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Acción */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Acción</label>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las acciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                <SelectItem value="Ingreso">Ingreso</SelectItem>
                <SelectItem value="Egreso">Egreso</SelectItem>
                <SelectItem value="Edición">Edición</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fecha */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha</label>
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {filteredMovements.length} de {movements.length} movimientos
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortDesc((prev) => !prev)}
        >
          <ArrowUpDown className="h-4 w-4 mr-2" />
          Ordenar por fecha
        </Button>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acción</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Fecha y Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No se encontraron movimientos
                  </TableCell>
                </TableRow>
              ) : (
                filteredMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>{getActionBadge(movement.action)}</TableCell>
                    <TableCell className="font-medium">
                      {movement.productName}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {movement.productSku}
                      </code>
                    </TableCell>
                    <TableCell>
                      {movement.action === "Edición" ? (
                        <span className="text-sm">
                          {movement.previousQuantity} → {movement.newQuantity}
                        </span>
                      ) : (
                        <span className="font-medium">{movement.quantity}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {movement.location}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{movement.user}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(movement.timestamp)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Nota */}
      <div className="bg-accent/50 p-4 rounded-lg border border-accent">
        <p className="text-sm text-foreground">
          📝 <strong>Nota:</strong> Para restringir el acceso a esta sección
          solo a administradores, necesitarás conectar tu proyecto a Supabase
          para implementar autenticación y roles de usuario.
        </p>
      </div>
    </div>
  );
}
//modificacion cierra
