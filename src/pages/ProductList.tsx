import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Pencil,
  Trash2,
  Search,
  Filter,
  ArrowLeft,
  ShoppingCart,
  AlertTriangle,
  CalendarDays,
  Percent,
  Calculator,
  LocateFixed,
  Boxes,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import { ProductModal } from "@/components/inventory/ProductModal";
import { PageHero } from "@/components/layout/PageHero";
import { Product, Location } from "@/types/inventory";
import { useToast } from "@/hooks/use-toast";

type StockFilter = "all" | "bajo" | "normal" | "alto";

const formatCurrency = (value: number) => {
  return `$${Number(value || 0).toFixed(2)}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "No aplica";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const getDaysToExpire = (caducidad?: string | null) => {
  if (!caducidad) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(`${caducidad.slice(0, 10)}T00:00:00`);
  expiration.setHours(0, 0, 0, 0);

  const diffMs = expiration.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const getSuggestedDiscount = (caducidad?: string | null) => {
  const days = getDaysToExpire(caducidad);

  if (days === null) return 0;
  if (days < 0) return 0;
  if (days <= 5) return 40;
  if (days <= 10) return 30;
  if (days <= 15) return 20;
  if (days <= 30) return 10;

  return 0;
};

export default function ProductList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRack, setFilterRack] = useState("all");
  const [filterNivel, setFilterNivel] = useState("all");
  const [filterStock, setFilterStock] = useState<StockFilter>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    null
  );

  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleProduct, setSaleProduct] = useState<Product | null>(null);
  const [cantidadVendida, setCantidadVendida] = useState("1");
  const [precioVenta, setPrecioVenta] = useState("");

  const { products, locations, deleteProduct, buscarFisicamente } =
    useInventory();

  const { toast } = useToast();

  const productsWithLocation = useMemo(() => {
    return products.map((product) => ({
      ...product,
      location: locations.find((location) => location.id === product.locationId),
    }));
  }, [products, locations]);

  const getStockStatus = (product: Product): "bajo" | "normal" | "alto" => {
    const stockMinimo = Number(product.stock_minimo ?? 10);
    const stockAlto = Number(product.stock_alto ?? stockMinimo * 3);

    if (product.cantidad <= stockMinimo) return "bajo";
    if (product.cantidad >= stockAlto) return "alto";

    return "normal";
  };

  const filteredProducts = productsWithLocation.filter((product) => {
    const term = searchTerm.trim().toLowerCase();

    const matchesSearch =
      !term ||
      product.sku.toLowerCase().includes(term) ||
      product.nombre.toLowerCase().includes(term);

    const matchesRack =
      filterRack === "all" || product.location?.rack === filterRack;

    const matchesNivel =
      filterNivel === "all" ||
      product.location?.nivel.toString() === filterNivel;

    const matchesStock =
      filterStock === "all" || getStockStatus(product) === filterStock;

    return matchesSearch && matchesRack && matchesNivel && matchesStock;
  });

  const lowStockCount = productsWithLocation.filter((product) => {
    const stockMinimo = Number(product.stock_minimo ?? 10);
    return product.cantidad <= stockMinimo;
  }).length;

  const activeRacks = new Set(
    productsWithLocation
      .map((product) => product.location?.rack)
      .filter(Boolean)
  ).size;

  const handleEdit = (product: Product) => {
    const location = locations.find((loc) => loc.id === product.locationId);

    setSelectedProduct(product);
    setSelectedLocation(location || null);
    setModalOpen(true);
  };

  const handleBuscarFisicamente = async (product: Product) => {
    try {
      const result = await buscarFisicamente(product.locationId);

      toast({
        title: result.ok ? "Buscar físicamente" : "No se pudo buscar",
        description: result.mensaje,
        variant: result.ok ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Error buscando físicamente:", error);

      toast({
        title: "Error",
        description: "No se pudo enviar la búsqueda física.",
        variant: "destructive",
      });
    }
  };

  const handleOpenSale = (product: Product) => {
    setSaleProduct(product);
    setCantidadVendida("1");

    const suggestedPrice = Number(product.precio_venta_sugerido ?? 0);

    if (suggestedPrice > 0) {
      setPrecioVenta(suggestedPrice.toString());
    } else {
      setPrecioVenta("");
    }

    setSaleModalOpen(true);
  };

  const closeSaleModal = () => {
    setSaleModalOpen(false);
    setSaleProduct(null);
    setCantidadVendida("1");
    setPrecioVenta("");
  };

  const saleCalculations = useMemo(() => {
    if (!saleProduct) {
      return {
        cantidad: 0,
        precio: 0,
        costoProveedor: 0,
        ingresoTotal: 0,
        costoTotal: 0,
        ganancia: 0,
        precioSugerido: 0,
        descuento: 0,
        precioConDescuento: 0,
        diasCaducidad: null as number | null,
        vencido: false,
        proximoCaducar: false,
      };
    }

    const cantidad = Number(cantidadVendida || 0);
    const precio = Number(precioVenta || 0);
    const costoProveedor = Number(saleProduct.costo_proveedor ?? 0);
    const precioSugerido = Number(saleProduct.precio_venta_sugerido ?? 0);
    const descuento = getSuggestedDiscount(saleProduct.caducidad);

    const precioConDescuento =
      precioSugerido > 0
        ? Number((precioSugerido * (1 - descuento / 100)).toFixed(2))
        : 0;

    const diasCaducidad = getDaysToExpire(saleProduct.caducidad);
    const vencido = diasCaducidad !== null && diasCaducidad < 0;
    const proximoCaducar =
      diasCaducidad !== null && diasCaducidad >= 0 && diasCaducidad <= 30;

    const ingresoTotal = precio * cantidad;
    const costoTotal = costoProveedor * cantidad;
    const ganancia = ingresoTotal - costoTotal;

    return {
      cantidad,
      precio,
      costoProveedor,
      ingresoTotal,
      costoTotal,
      ganancia,
      precioSugerido,
      descuento,
      precioConDescuento,
      diasCaducidad,
      vencido,
      proximoCaducar,
    };
  }, [saleProduct, cantidadVendida, precioVenta]);

  const confirmSale = async () => {
    if (!saleProduct) return;

    const cantidad = Number(cantidadVendida);
    const precio = Number(precioVenta);

    if (!cantidad || cantidad <= 0) {
      toast({
        title: "Error",
        description: "La cantidad vendida debe ser válida.",
        variant: "destructive",
      });
      return;
    }

    if (cantidad > saleProduct.cantidad) {
      toast({
        title: "Error",
        description: "No puedes vender más cantidad de la existente.",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(precio) || precio < 0) {
      toast({
        title: "Error",
        description: "El precio de venta debe ser válido.",
        variant: "destructive",
      });
      return;
    }

    await deleteProduct(saleProduct.sku, {
      cantidad_vendida: cantidad,
      precio_venta: precio,
    });

    toast({
      title: "Salida registrada",
      description: `${saleProduct.nombre} fue registrado como salida/venta.`,
    });

    closeSaleModal();
  };

  const getStockBadge = (product: Product) => {
    const status = getStockStatus(product);

    if (status === "bajo") {
      return <Badge variant="destructive">Stock bajo</Badge>;
    }

    if (status === "alto") {
      return <Badge className="bg-blue-600 text-white">Stock alto</Badge>;
    }

    return <Badge variant="secondary">Stock normal</Badge>;
  };

  const getExpirationBadge = (product: Product) => {
    const days = getDaysToExpire(product.caducidad);

    if (days === null) {
      return <Badge variant="outline">Sin caducidad</Badge>;
    }

    if (days < 0) {
      return <Badge variant="destructive">Vencido</Badge>;
    }

    if (days <= 30) {
      return (
        <Badge className="bg-amber-500 text-white">
          Caduca en {days} día(s)
        </Badge>
      );
    }

    return <Badge variant="secondary">{formatDate(product.caducidad)}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHero
        badge="Inventario activo"
        title="Listado de Productos"
        description="Consulta, filtra, edita y registra salidas de productos almacenados en RackNova."
        icon={Boxes}
        actions={
          <Button variant="secondary" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Link>
          </Button>
        }
        stats={[
          {
            label: "Productos totales",
            value: productsWithLocation.length,
            tone: "blue",
          },
          {
            label: "Productos visibles",
            value: filteredProducts.length,
            tone: "green",
          },
          {
            label: "Stock crítico",
            value: lowStockCount,
            tone: "amber",
          },
          {
            label: "Racks activos",
            value: activeRacks,
            tone: "purple",
          },
        ]}
      >
        Usa los filtros para localizar productos por SKU, nombre, rack o nivel.
        Desde esta página también puedes registrar salidas y ventas.
      </PageHero>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros y búsqueda
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por SKU o nombre..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterRack} onValueChange={setFilterRack}>
              <SelectTrigger>
                <SelectValue placeholder="Rack" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">Todos los racks</SelectItem>
                <SelectItem value="A">Rack A</SelectItem>
                <SelectItem value="B">Rack B</SelectItem>
                <SelectItem value="C">Rack C</SelectItem>
                <SelectItem value="D">Rack D</SelectItem>
                <SelectItem value="E">Rack E</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterNivel} onValueChange={setFilterNivel}>
              <SelectTrigger>
                <SelectValue placeholder="Nivel" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">Todos los niveles</SelectItem>
                <SelectItem value="1">Nivel 1</SelectItem>
                <SelectItem value="2">Nivel 2</SelectItem>
                <SelectItem value="3">Nivel 3</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterStock}
              onValueChange={(value) => setFilterStock(value as StockFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Stock" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">Todo el stock</SelectItem>
                <SelectItem value="bajo">Stock bajo</SelectItem>
                <SelectItem value="normal">Stock normal</SelectItem>
                <SelectItem value="alto">Stock alto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setFilterRack("all");
                setFilterNivel("all");
                setFilterStock("all");
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
            Productos ({filteredProducts.length} de {productsWithLocation.length})
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Costo promedio</TableHead>
                  <TableHead>Precio sugerido</TableHead>
                  <TableHead>Caducidad</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground py-8"
                    >
                      No se encontraron productos.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.location
                          ? `${product.location.rack}-${product.location.nivel}-${product.location.slot}`
                          : product.locationId}
                      </TableCell>

                      <TableCell>{product.sku}</TableCell>

                      <TableCell>
                        <div className="font-medium">{product.nombre}</div>
                        {product.descripcion && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {product.descripcion}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>{product.cantidad}</TableCell>

                      <TableCell>
                        {formatCurrency(Number(product.costo_proveedor ?? 0))}
                      </TableCell>

                      <TableCell>
                        {formatCurrency(
                          Number(product.precio_venta_sugerido ?? 0)
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          {getExpirationBadge(product)}
                          <div className="text-xs text-muted-foreground">
                            {formatDate(product.caducidad)}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>{getStockBadge(product)}</TableCell>

                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBuscarFisicamente(product)}
                          >
                            <LocateFixed className="h-4 w-4 mr-1" />
                            Buscar
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(product)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleOpenSale(product)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Salida
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={saleModalOpen} onOpenChange={setSaleModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Registrar salida / venta
            </DialogTitle>
          </DialogHeader>

          {saleProduct && (
            <div className="space-y-5">
              <div className="rounded-xl border bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Producto</p>
                <h3 className="text-lg font-semibold">{saleProduct.nombre}</h3>
                <p className="text-sm text-muted-foreground">
                  SKU: {saleProduct.sku} · Stock actual: {saleProduct.cantidad}{" "}
                  pieza(s)
                </p>
                <p className="text-sm text-muted-foreground">
                  Ubicación: {saleProduct.locationId}
                </p>
              </div>

              {saleCalculations.vencido && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-200">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-5 w-5" />
                    Producto vencido
                  </div>
                  <p className="text-sm mt-1">
                    Este producto venció hace{" "}
                    {Math.abs(saleCalculations.diasCaducidad ?? 0)} día(s).
                    Recomendación: no vender, retirar del inventario o registrar
                    merma.
                  </p>
                </div>
              )}

              {!saleCalculations.vencido &&
                saleCalculations.proximoCaducar && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-2 font-semibold">
                      <CalendarDays className="h-5 w-5" />
                      Producto próximo a caducar
                    </div>
                    <p className="text-sm mt-1">
                      Caduca en {saleCalculations.diasCaducidad} día(s).
                      RackNova sugiere un descuento de{" "}
                      {saleCalculations.descuento}% para acelerar su salida.
                    </p>
                  </div>
                )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cantidad vendida / retirada</Label>
                  <Input
                    type="number"
                    min={1}
                    max={saleProduct.cantidad}
                    value={cantidadVendida}
                    onChange={(event) => setCantidadVendida(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Máximo disponible: {saleProduct.cantidad}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Precio venta unitario</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={precioVenta}
                    onChange={(event) => setPrecioVenta(event.target.value)}
                    placeholder="Ej: 100.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Precio sugerido:{" "}
                    {formatCurrency(saleCalculations.precioSugerido)}
                  </p>
                </div>
              </div>

              {saleCalculations.descuento > 0 &&
                saleCalculations.precioConDescuento > 0 && (
                  <div className="rounded-xl border bg-muted/40 p-4">
                    <div className="flex items-center gap-2 font-semibold mb-2">
                      <Percent className="h-5 w-5" />
                      Descuento sugerido por caducidad
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">
                          Precio sugerido original
                        </p>
                        <p className="font-semibold">
                          {formatCurrency(saleCalculations.precioSugerido)}
                        </p>
                      </div>

                      <div>
                        <p className="text-muted-foreground">Descuento</p>
                        <p className="font-semibold">
                          {saleCalculations.descuento}%
                        </p>
                      </div>

                      <div>
                        <p className="text-muted-foreground">
                          Precio con descuento
                        </p>
                        <p className="font-semibold">
                          {formatCurrency(saleCalculations.precioConDescuento)}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        setPrecioVenta(
                          saleCalculations.precioConDescuento.toString()
                        )
                      }
                    >
                      Usar precio con descuento
                    </Button>
                  </div>
                )}

              <div className="rounded-xl border bg-muted/40 p-4">
                <div className="flex items-center gap-2 font-semibold mb-3">
                  <Calculator className="h-5 w-5" />
                  Estimación financiera
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Ingreso estimado
                    </p>
                    <p className="text-lg font-bold">
                      {formatCurrency(saleCalculations.ingresoTotal)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Costo estimado
                    </p>
                    <p className="text-lg font-bold">
                      {formatCurrency(saleCalculations.costoTotal)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Ganancia estimada
                    </p>
                    <p
                      className={`text-lg font-bold ${
                        saleCalculations.ganancia >= 0
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(saleCalculations.ganancia)}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  La salida se descontará usando FEFO: primero se descuenta el
                  lote que caduca antes.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeSaleModal}>
              Cancelar
            </Button>

            <Button onClick={confirmSale}>Confirmar salida</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedProduct && selectedLocation && (
        <ProductModal
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);

            if (!open) {
              setSelectedProduct(null);
              setSelectedLocation(null);
            }
          }}
          location={selectedLocation}
          product={selectedProduct}
          mode="edit"
        />
      )}
    </div>
  );
}
