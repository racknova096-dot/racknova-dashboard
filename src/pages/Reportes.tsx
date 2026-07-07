import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Product } from "@/types/inventory";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  CalendarClock,
  AlertTriangle,
  Boxes,
  PackageCheck,
  Download,
  Printer,
  ShoppingCart,
  Percent,
  Lightbulb,
  Calculator,
  MapPin,
} from "lucide-react";

type VentaProducto = {
  sku: string;
  nombre: string;
  cantidadVendida: number;
  ingresoTotal: number;
  costoTotal: number;
  gananciaTotal: number;
  primeraVenta: Date | null;
  ultimaVenta: Date | null;
};

type IngresoProducto = {
  sku: string;
  nombre: string;
  cantidadIngresada: number;
  primeraEntrada: Date | null;
  ultimaEntrada: Date | null;
};

type CaducidadProducto = {
  sku: string;
  nombre: string;
  cantidad: number;
  caducidad: string;
  diasRestantes: number;
};

type ProductoAnalizado = {
  sku: string;
  nombre: string;
  locationId: string;
  cantidadActual: number;
  stockMinimo: number;
  caducidad: string | null;
  diasCaducidad: number | null;

  cantidadIngresada: number;
  cantidadVendida: number;
  ingresoTotal: number;
  costoTotal: number;
  gananciaTotal: number;

  primeraVenta: Date | null;
  ultimaVenta: Date | null;
  diasSinVenta: number | null;

  diasAnalizados: number;
  demandaDiaria: number;
  diasCobertura: number | null;
  stockSeguridad: number;
  puntoReorden: number;
  stockObjetivo: number;
  compraSugerida: number;
  sellThrough: number;
  rotacionInventario: number;
  margen: number;

  costoProveedorUnitario: number;
  precioPromedioVenta: number;
  descuentoSugerido: number;
  precioConDescuento: number;
  costoInventarioActual: number;
  recuperacionEstimada: number;
  resultadoConDescuento: number;
  porcentajeRecuperacionCosto: number;
  piezasDiariasParaEvitarCaducidad: number | null;
};

type Recomendacion = {
  tipo:
    | "COMPRA"
    | "DESCUENTO"
    | "CADUCIDAD"
    | "STOCK"
    | "ROTACION"
    | "RENTABLE"
    | "UBICACION";
  prioridad: "Alta" | "Media" | "Baja";
  sku: string;
  nombre: string;
  mensaje: string;
  accion: string;
  valorReferencia: string;

  descuentoSugerido?: number;
  precioConDescuento?: number;
  recuperacionEstimada?: number;
  resultadoConDescuento?: number;
  porcentajeRecuperacionCosto?: number;
  ubicacionActual?: string;
  ubicacionSugerida?: string;
};

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ca8a04",
  "#be185d",
];

const LEAD_TIME_DAYS = 5;
const SAFETY_DAYS = 3;
const TARGET_COVERAGE_DAYS = 15;

function getStockMinimo(product: Product) {
  return Number((product as any).stock_minimo ?? 10);
}

function getCaducidad(product: Product) {
  return ((product as any).caducidad ?? null) as string | null;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPercent(value: number) {
  return `${formatNumber(value)}%`;
}

function formatDate(dateValue: string) {
  const cleanDate = dateValue.slice(0, 10);
  const date = new Date(`${cleanDate}T00:00:00`);

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getDaysToExpiration(dateValue: string) {
  const cleanDate = dateValue.slice(0, 10);
  const expirationDate = new Date(`${cleanDate}T00:00:00`);

  const today = new Date();
  const todayClean = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const diffMs = expirationDate.getTime() - todayClean.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function daysBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return 1;

  const startClean = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );

  const endClean = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const diffMs = endClean.getTime() - startClean.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return Math.max(days, 1);
}

function daysSince(date: Date | null) {
  if (!date) return null;

  const today = new Date();
  const todayClean = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const dateClean = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffMs = todayClean.getTime() - dateClean.getTime();
  return Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 0);
}

function ExpirationBadge({ days }: { days: number }) {
  if (days < 0) return <Badge variant="destructive">Vencido</Badge>;
  if (days === 0) return <Badge variant="destructive">Caduca hoy</Badge>;
  if (days <= 5) return <Badge variant="destructive">Urgente</Badge>;
  if (days <= 30) return <Badge variant="secondary">Próximo</Badge>;

  return <Badge variant="outline">Vigente</Badge>;
}

function PriorityBadge({ prioridad }: { prioridad: Recomendacion["prioridad"] }) {
  if (prioridad === "Alta") return <Badge variant="destructive">Alta</Badge>;
  if (prioridad === "Media") return <Badge variant="secondary">Media</Badge>;

  return <Badge variant="outline">Baja</Badge>;
}

function TypeBadge({ tipo }: { tipo: Recomendacion["tipo"] }) {
  const labels: Record<Recomendacion["tipo"], string> = {
    COMPRA: "Comprar",
    DESCUENTO: "Descuento",
    CADUCIDAD: "Caducidad",
    STOCK: "Stock",
    ROTACION: "Rotación",
    RENTABLE: "Rentable",
    UBICACION: "Ubicación",
  };

  return <Badge variant="outline">{labels[tipo]}</Badge>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center rounded-lg border border-dashed">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function getDiscountSuggestion(daysToExpiration: number | null) {
  if (daysToExpiration === null) return 0;

  // Vencido: no sugerir descuento, sugerir retirar/eliminar.
  if (daysToExpiration < 0) return 0;

  if (daysToExpiration <= 5) return 40;
  if (daysToExpiration <= 10) return 30;
  if (daysToExpiration <= 15) return 20;
  if (daysToExpiration <= 30) return 10;

  return 0;
}

function parseLocationId(locationId: string) {
  const [rack, nivelRaw, slotRaw] = locationId.split("-");

  return {
    rack,
    nivel: Number(nivelRaw),
    slot: Number(slotRaw),
  };
}

export default function Reportes() {
  const { products, locations, movements } = useInventory();

  const { ventasOrdenadas, ventasMap } = useMemo(() => {
    const map = new Map<string, VentaProducto>();

    movements
      .filter((movement) => movement.action === "Egreso")
      .forEach((movement) => {
        const sku = movement.productSku;
        const fecha = new Date(movement.timestamp);
        const current = map.get(sku);

        if (current) {
          current.cantidadVendida += Number(movement.quantity ?? 0);
          current.ingresoTotal += Number(movement.ingreso_total ?? 0);
          current.costoTotal += Number(movement.costo_total ?? 0);
          current.gananciaTotal += Number(movement.ganancia ?? 0);

          if (!current.primeraVenta || fecha < current.primeraVenta) {
            current.primeraVenta = fecha;
          }

          if (!current.ultimaVenta || fecha > current.ultimaVenta) {
            current.ultimaVenta = fecha;
          }
        } else {
          map.set(sku, {
            sku,
            nombre: movement.productName,
            cantidadVendida: Number(movement.quantity ?? 0),
            ingresoTotal: Number(movement.ingreso_total ?? 0),
            costoTotal: Number(movement.costo_total ?? 0),
            gananciaTotal: Number(movement.ganancia ?? 0),
            primeraVenta: fecha,
            ultimaVenta: fecha,
          });
        }
      });

    const ventas = Array.from(map.values()).sort(
      (a, b) => b.cantidadVendida - a.cantidadVendida
    );

    return {
      ventasOrdenadas: ventas,
      ventasMap: map,
    };
  }, [movements]);

  const ingresosMap = useMemo(() => {
    const map = new Map<string, IngresoProducto>();

    movements
      .filter((movement) => movement.action === "Ingreso")
      .forEach((movement) => {
        const sku = movement.productSku;
        const fecha = new Date(movement.timestamp);
        const current = map.get(sku);

        if (current) {
          current.cantidadIngresada += Number(movement.quantity ?? 0);

          if (!current.primeraEntrada || fecha < current.primeraEntrada) {
            current.primeraEntrada = fecha;
          }

          if (!current.ultimaEntrada || fecha > current.ultimaEntrada) {
            current.ultimaEntrada = fecha;
          }
        } else {
          map.set(sku, {
            sku,
            nombre: movement.productName,
            cantidadIngresada: Number(movement.quantity ?? 0),
            primeraEntrada: fecha,
            ultimaEntrada: fecha,
          });
        }
      });

    return map;
  }, [movements]);

  const productoMasVendidoColocado = useMemo(() => {
    for (const venta of ventasOrdenadas) {
      const productoColocado = products.find((p) => p.sku === venta.sku);

      if (productoColocado) {
        return {
          ...venta,
          locationId: productoColocado.locationId,
        };
      }
    }

    return null;
  }, [ventasOrdenadas, products]);

  const occupiedLocationIds = useMemo(() => {
    return new Set(products.map((product) => product.locationId));
  }, [products]);

  const getSuggestedVisibleLocation = (currentLocationId: string) => {
    const emptyLocations = locations.filter(
      (location) => !occupiedLocationIds.has(location.id)
    );

    if (emptyLocations.length === 0) {
      return null;
    }

    if (!productoMasVendidoColocado) {
      return emptyLocations[0]?.id ?? null;
    }

    const reference = parseLocationId(productoMasVendidoColocado.locationId);

    const ranked = [...emptyLocations].sort((a, b) => {
      const aDistance =
        (a.rack === reference.rack ? 0 : 100) +
        (Number(a.nivel) === reference.nivel ? 0 : 20) +
        Math.abs(Number(a.slot) - reference.slot);

      const bDistance =
        (b.rack === reference.rack ? 0 : 100) +
        (Number(b.nivel) === reference.nivel ? 0 : 20) +
        Math.abs(Number(b.slot) - reference.slot);

      return aDistance - bDistance;
    });

    const suggested = ranked.find((location) => location.id !== currentLocationId);

    return suggested?.id ?? ranked[0]?.id ?? null;
  };

  const productosAnalizados: ProductoAnalizado[] = useMemo(() => {
    const today = new Date();

    return products.map((product) => {
      const venta = ventasMap.get(product.sku);
      const ingreso = ingresosMap.get(product.sku);

      const stockMinimo = getStockMinimo(product);
      const caducidad = getCaducidad(product);
      const diasCaducidad = caducidad ? getDaysToExpiration(caducidad) : null;

      const cantidadVendida = venta?.cantidadVendida ?? 0;
      const ingresoTotal = venta?.ingresoTotal ?? 0;
      const costoTotal = venta?.costoTotal ?? 0;
      const gananciaTotal = venta?.gananciaTotal ?? 0;

      const cantidadIngresada =
        ingreso?.cantidadIngresada && ingreso.cantidadIngresada > 0
          ? ingreso.cantidadIngresada
          : product.cantidad + cantidadVendida;

      const diasAnalizados =
        cantidadVendida > 0
          ? daysBetween(venta?.primeraVenta ?? null, today)
          : 1;

      const demandaDiaria =
        cantidadVendida > 0 ? cantidadVendida / diasAnalizados : 0;

      const diasCobertura =
        demandaDiaria > 0 ? product.cantidad / demandaDiaria : null;

      const stockSeguridad = demandaDiaria * SAFETY_DAYS;

      const puntoReorden = demandaDiaria * LEAD_TIME_DAYS + stockSeguridad;

      const stockObjetivo = demandaDiaria * TARGET_COVERAGE_DAYS;

      const compraSugerida = Math.max(
        Math.ceil(stockObjetivo - product.cantidad),
        product.cantidad < stockMinimo ? stockMinimo - product.cantidad : 0,
        0
      );

      const sellThrough =
        cantidadIngresada > 0 ? (cantidadVendida / cantidadIngresada) * 100 : 0;

      const stockInicialEstimado = product.cantidad + cantidadVendida;
      const stockPromedio = Math.max(
        (stockInicialEstimado + product.cantidad) / 2,
        1
      );

      const rotacionInventario =
        cantidadVendida > 0 ? cantidadVendida / stockPromedio : 0;

      const margen = ingresoTotal > 0 ? (gananciaTotal / ingresoTotal) * 100 : 0;

      const piezasDiariasParaEvitarCaducidad =
        diasCaducidad !== null && diasCaducidad > 0
          ? product.cantidad / diasCaducidad
          : diasCaducidad !== null && diasCaducidad <= 0
          ? product.cantidad
          : null;

      const descuentoSugerido = getDiscountSuggestion(diasCaducidad);

      const costoProveedorUnitario = Number(product.costo_proveedor ?? 0);

      const precioPromedioVenta =
        cantidadVendida > 0 ? ingresoTotal / cantidadVendida : 0;

      const precioConDescuento =
        precioPromedioVenta > 0 && descuentoSugerido > 0
          ? precioPromedioVenta * (1 - descuentoSugerido / 100)
          : 0;

      const costoInventarioActual = costoProveedorUnitario * product.cantidad;

      const recuperacionEstimada =
        precioConDescuento > 0 ? precioConDescuento * product.cantidad : 0;

      const resultadoConDescuento =
        recuperacionEstimada > 0
          ? recuperacionEstimada - costoInventarioActual
          : 0;

      const porcentajeRecuperacionCosto =
        costoInventarioActual > 0 && recuperacionEstimada > 0
          ? (recuperacionEstimada / costoInventarioActual) * 100
          : 0;

      return {
        sku: product.sku,
        nombre: product.nombre,
        locationId: product.locationId,
        cantidadActual: product.cantidad,
        stockMinimo,
        caducidad,
        diasCaducidad,

        cantidadIngresada,
        cantidadVendida,
        ingresoTotal,
        costoTotal,
        gananciaTotal,

        primeraVenta: venta?.primeraVenta ?? null,
        ultimaVenta: venta?.ultimaVenta ?? null,
        diasSinVenta: daysSince(venta?.ultimaVenta ?? null),

        diasAnalizados,
        demandaDiaria,
        diasCobertura,
        stockSeguridad,
        puntoReorden,
        stockObjetivo,
        compraSugerida,
        sellThrough,
        rotacionInventario,
        margen,

        costoProveedorUnitario,
        precioPromedioVenta,
        descuentoSugerido,
        precioConDescuento,
        costoInventarioActual,
        recuperacionEstimada,
        resultadoConDescuento,
        porcentajeRecuperacionCosto,
        piezasDiariasParaEvitarCaducidad,
      };
    });
  }, [products, ventasMap, ingresosMap]);

  const productosSinVentaODemorados = useMemo(() => {
    return [...productosAnalizados]
      .filter((product) => product.cantidadActual > 0)
      .sort((a, b) => {
        const aScore =
          a.diasSinVenta === null ? 999999 : Number(a.diasSinVenta);
        const bScore =
          b.diasSinVenta === null ? 999999 : Number(b.diasSinVenta);

        if (aScore !== bScore) return bScore - aScore;

        return b.cantidadActual - a.cantidadActual;
      })
      .slice(0, 2);
  }, [productosAnalizados]);

  const recomendaciones = useMemo(() => {
    const lista: Recomendacion[] = [];

    productosAnalizados.forEach((product) => {
      const stockBajo = product.cantidadActual < product.stockMinimo;

      const bajoPuntoReorden =
        product.demandaDiaria > 0 &&
        product.cantidadActual <= product.puntoReorden;

      const coberturaCritica =
        product.diasCobertura !== null && product.diasCobertura <= 7;

      const coberturaMedia =
        product.diasCobertura !== null &&
        product.diasCobertura > 7 &&
        product.diasCobertura <= 14;

      const altaRotacion = product.sellThrough >= 70;
      const bajaRotacion =
        product.cantidadVendida > 0 && product.sellThrough < 30;

      const sinVentas = product.cantidadVendida === 0;

      const stockAlto =
        product.cantidadActual >= product.stockMinimo * 3 &&
        (sinVentas || bajaRotacion);

      const caducado =
        product.diasCaducidad !== null && product.diasCaducidad < 0;

      const proximoCaducar =
        product.diasCaducidad !== null &&
        product.diasCaducidad >= 0 &&
        product.diasCaducidad <= 30;

      const caducaUrgente =
        product.diasCaducidad !== null &&
        product.diasCaducidad >= 0 &&
        product.diasCaducidad <= 5;

      const rentable =
        product.cantidadVendida > 0 &&
        product.gananciaTotal > 0 &&
        product.margen >= 30;

      if (
        stockBajo ||
        bajoPuntoReorden ||
        coberturaCritica ||
        coberturaMedia
      ) {
        const compraSugerida =
          product.compraSugerida > 0
            ? product.compraSugerida
            : Math.max(product.stockMinimo - product.cantidadActual, 1);

        lista.push({
          tipo: "COMPRA",
          prioridad:
            stockBajo || bajoPuntoReorden || coberturaCritica
              ? "Alta"
              : "Media",
          sku: product.sku,
          nombre: product.nombre,
          mensaje:
            product.diasCobertura !== null
              ? `Cobertura estimada de ${formatNumber(
                  product.diasCobertura
                )} día(s). Punto de reorden: ${formatNumber(
                  product.puntoReorden
                )} piezas.`
              : "El producto está por debajo del stock crítico.",
          accion: `Comprar aproximadamente ${compraSugerida} pieza(s) para cubrir ${TARGET_COVERAGE_DAYS} días de demanda.`,
          valorReferencia: `Demanda diaria: ${formatNumber(
            product.demandaDiaria
          )} pz/día | Stock actual: ${product.cantidadActual}`,
        });
      }

      if (caducado) {
        const ubicacionSugerida = getSuggestedVisibleLocation(product.locationId);

        lista.push({
          tipo: "CADUCIDAD",
          prioridad: "Alta",
          sku: product.sku,
          nombre: product.nombre,
          mensaje: `Producto vencido hace ${Math.abs(
            product.diasCaducidad ?? 0
          )} día(s). No se recomienda descuento.`,
          accion:
            "Retirar/eliminar del inventario y registrar merma. Si aún debe revisarse físicamente, mover temporalmente a una zona visible para control inmediato.",
          valorReferencia: ubicacionSugerida
            ? `Ubicación actual: ${product.locationId} | Posición visible sugerida: ${ubicacionSugerida}`
            : `Ubicación actual: ${product.locationId} | Sin espacio vacío sugerido.`,
          ubicacionActual: product.locationId,
          ubicacionSugerida: ubicacionSugerida ?? undefined,
        });
      } else if (proximoCaducar) {
        const ubicacionSugerida = getSuggestedVisibleLocation(product.locationId);

        const resultadoTexto =
          product.precioPromedioVenta <= 0
            ? "No hay historial de venta suficiente para estimar recuperación."
            : product.resultadoConDescuento >= 0
            ? `Con el descuento se estima utilidad de ${formatMoney(
                product.resultadoConDescuento
              )}.`
            : `Con el descuento se estima pérdida de ${formatMoney(
                Math.abs(product.resultadoConDescuento)
              )}, recuperando aprox. ${formatPercent(
                product.porcentajeRecuperacionCosto
              )} del costo.`;

        lista.push({
          tipo: "CADUCIDAD",
          prioridad: caducaUrgente ? "Alta" : "Media",
          sku: product.sku,
          nombre: product.nombre,
          mensaje: `Caduca en ${product.diasCaducidad} día(s). Descuento sugerido: ${product.descuentoSugerido}%.`,
          accion:
            product.precioPromedioVenta > 0
              ? `Priorizar salida, mover a posición visible y aplicar descuento calculado. ${resultadoTexto}`
              : "Priorizar salida, mover a posición visible y evaluar descuento manualmente.",
          valorReferencia: ubicacionSugerida
            ? `Ubicación actual: ${product.locationId} | Posición visible sugerida: ${ubicacionSugerida}`
            : `Debe vender aprox. ${formatNumber(
                product.piezasDiariasParaEvitarCaducidad ?? 0
              )} pz/día para evitar pérdida.`,
          descuentoSugerido: product.descuentoSugerido,
          precioConDescuento: product.precioConDescuento,
          recuperacionEstimada: product.recuperacionEstimada,
          resultadoConDescuento: product.resultadoConDescuento,
          porcentajeRecuperacionCosto: product.porcentajeRecuperacionCosto,
          ubicacionActual: product.locationId,
          ubicacionSugerida: ubicacionSugerida ?? undefined,
        });
      }

      if (stockAlto) {
        lista.push({
          tipo: "DESCUENTO",
          prioridad: proximoCaducar ? "Alta" : "Media",
          sku: product.sku,
          nombre: product.nombre,
          mensaje: `Stock alto con baja rotación. Sell-through: ${formatPercent(
            product.sellThrough
          )}.`,
          accion:
            product.descuentoSugerido > 0
              ? `Aplicar descuento sugerido de ${product.descuentoSugerido}% y mover a zona visible.`
              : "Aplicar promoción por volumen, revisar precio o mover a zona visible.",
          valorReferencia: `Stock actual: ${product.cantidadActual} | Vendidas: ${product.cantidadVendida}`,
          descuentoSugerido: product.descuentoSugerido,
          precioConDescuento: product.precioConDescuento,
          recuperacionEstimada: product.recuperacionEstimada,
          resultadoConDescuento: product.resultadoConDescuento,
          porcentajeRecuperacionCosto: product.porcentajeRecuperacionCosto,
        });
      }

      if (rentable || (altaRotacion && product.margen > 0)) {
        lista.push({
          tipo: "RENTABLE",
          prioridad:
            product.cantidadActual <= product.puntoReorden ? "Media" : "Baja",
          sku: product.sku,
          nombre: product.nombre,
          mensaje: `Producto de buen desempeño. Margen: ${formatPercent(
            product.margen
          )}, sell-through: ${formatPercent(product.sellThrough)}.`,
          accion:
            product.cantidadActual <= product.puntoReorden
              ? "Mantener inventario suficiente. Considerar recompra."
              : "Mantener seguimiento de ventas y rentabilidad.",
          valorReferencia: `Ganancia acumulada: ${formatMoney(
            product.gananciaTotal
          )}`,
        });
      }
    });

    productosSinVentaODemorados.forEach((product) => {
      const ubicacionSugerida = getSuggestedVisibleLocation(product.locationId);

      const mensaje =
        product.diasSinVenta === null
          ? "Producto sin ventas registradas en el historial actual."
          : `Producto con baja rotación. Lleva ${product.diasSinVenta} día(s) sin venta.`;

      const productoReferencia = productoMasVendidoColocado
        ? `${productoMasVendidoColocado.nombre} (${productoMasVendidoColocado.sku})`
        : "producto más vendido";

      lista.push({
        tipo: "UBICACION",
        prioridad:
          product.cantidadActual >= product.stockMinimo * 2 ? "Media" : "Baja",
        sku: product.sku,
        nombre: product.nombre,
        mensaje,
        accion: ubicacionSugerida
          ? `Mover a ${ubicacionSugerida}, cerca de ${productoReferencia}. Evaluar descuento si continúa sin rotación.`
          : "Mover a una posición más visible y evaluar descuento si continúa sin rotación.",
        valorReferencia: `Ubicación actual: ${product.locationId}${
          productoMasVendidoColocado
            ? ` | Más vendido ubicado en ${productoMasVendidoColocado.locationId}`
            : ""
        }`,
        ubicacionActual: product.locationId,
        ubicacionSugerida: ubicacionSugerida ?? undefined,
      });
    });

    const priorityOrder = {
      Alta: 0,
      Media: 1,
      Baja: 2,
    };

    return lista.sort(
      (a, b) => priorityOrder[a.prioridad] - priorityOrder[b.prioridad]
    );
  }, [
    productosAnalizados,
    productosSinVentaODemorados,
    productoMasVendidoColocado,
    locations,
    products,
  ]);

  const productosMasVendidos = ventasOrdenadas.slice(0, 8);

  const productosMenosVendidos = useMemo(() => {
    return [...productosAnalizados]
      .sort((a, b) => {
        if (a.cantidadVendida !== b.cantidadVendida) {
          return a.cantidadVendida - b.cantidadVendida;
        }

        return a.cantidadActual - b.cantidadActual;
      })
      .slice(0, 8);
  }, [productosAnalizados]);

  const productosCaducidad = useMemo(() => {
    return productosAnalizados
      .filter((product) => product.caducidad)
      .map((product) => ({
        sku: product.sku,
        nombre: product.nombre,
        cantidad: product.cantidadActual,
        caducidad: product.caducidad as string,
        diasRestantes: product.diasCaducidad ?? 0,
      }))
      .sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [productosAnalizados]);

  const productosPorCaducar = productosCaducidad
    .filter((product) => product.diasRestantes <= 30)
    .slice(0, 10);

  const productosStockBajo = useMemo(() => {
    return productosAnalizados
      .filter((product) => product.cantidadActual < product.stockMinimo)
      .sort((a, b) => a.cantidadActual - b.cantidadActual)
      .slice(0, 10);
  }, [productosAnalizados]);

  const productosStockAlto = useMemo(() => {
    return [...productosAnalizados]
      .sort((a, b) => b.cantidadActual - a.cantidadActual)
      .slice(0, 10);
  }, [productosAnalizados]);

  const productosParaReabastecer = useMemo(() => {
    return [...productosAnalizados]
      .filter(
        (product) =>
          product.compraSugerida > 0 ||
          product.cantidadActual <= product.puntoReorden
      )
      .sort((a, b) => b.compraSugerida - a.compraSugerida)
      .slice(0, 10);
  }, [productosAnalizados]);

  const comprasSugeridas = recomendaciones
    .filter((item) => item.tipo === "COMPRA")
    .slice(0, 10);

  const descuentosSugeridos = recomendaciones
    .filter((item) => item.tipo === "DESCUENTO" || item.tipo === "CADUCIDAD")
    .slice(0, 10);

  const ubicacionSugerida = recomendaciones
    .filter((item) => item.tipo === "UBICACION")
    .slice(0, 10);

  const productosSinVentas = productosAnalizados.filter(
    (product) => product.cantidadVendida === 0 && product.cantidadActual > 0
  ).length;

  const totalPiezasVendidas = ventasOrdenadas.reduce(
    (total, product) => total + product.cantidadVendida,
    0
  );

  const vencidos = productosCaducidad.filter(
    (product) => product.diasRestantes < 0
  ).length;

  const porCaducar = productosCaducidad.filter(
    (product) => product.diasRestantes >= 0 && product.diasRestantes <= 30
  ).length;

  const alertasAltas = recomendaciones.filter(
    (item) => item.prioridad === "Alta"
  ).length;

  const productosRentables = recomendaciones.filter(
    (item) => item.tipo === "RENTABLE"
  ).length;

  const exportRecommendationsCSV = () => {
    const headers = [
      "prioridad",
      "tipo",
      "sku",
      "producto",
      "mensaje",
      "accion",
      "referencia",
      "descuento_sugerido",
      "precio_con_descuento",
      "recuperacion_estimada",
      "resultado_estimado",
      "porcentaje_recuperacion_costo",
      "ubicacion_actual",
      "ubicacion_sugerida",
    ];

    const rows = recomendaciones.map((item) => [
      item.prioridad,
      item.tipo,
      item.sku,
      item.nombre,
      item.mensaje,
      item.accion,
      item.valorReferencia,
      item.descuentoSugerido ?? "",
      item.precioConDescuento ?? "",
      item.recuperacionEstimada ?? "",
      item.resultadoConDescuento ?? "",
      item.porcentajeRecuperacionCosto ?? "",
      item.ubicacionActual ?? "",
      item.ubicacionSugerida ?? "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `racknova-ia-reporte-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    link.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-2 racknova-page-title">
              <BarChart3 className="h-8 w-8" />
              RackNova IA
            </h1>

            <p className="text-muted-foreground">
              Modelo inteligente de análisis, predicción y recomendaciones para
              compras, descuentos, caducidad, ubicación y rotación.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={printReport}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir / PDF
            </Button>

            <Button onClick={exportRecommendationsCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        <Card className="racknova-card border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Modelo matemático de inventario
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              El sistema calcula demanda diaria, punto de reorden, stock de
              seguridad, sell-through, rotación, margen, recuperación con
              descuento y ubicación sugerida.
            </p>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div className="rounded-xl border bg-card p-4">
                <p className="font-semibold">Punto de reorden</p>
                <p className="text-muted-foreground mt-1">
                  Demanda diaria × {LEAD_TIME_DAYS} días de entrega + stock de
                  seguridad.
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <p className="font-semibold">Compra sugerida</p>
                <p className="text-muted-foreground mt-1">
                  Stock objetivo para cubrir {TARGET_COVERAGE_DAYS} días menos
                  stock actual.
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <p className="font-semibold">Descuento con recuperación</p>
                <p className="text-muted-foreground mt-1">
                  Estima cuánto dinero se recupera y si la pérdida es aceptable.
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <p className="font-semibold">Ubicación inteligente</p>
                <p className="text-muted-foreground mt-1">
                  Sugiere mover productos lentos cerca del producto más vendido.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              RackNova iA - Recomendaciones inteligentes
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              Recomendaciones automáticas basadas en ventas, stock, caducidad,
              recuperación económica, rentabilidad y ubicación.
            </p>
          </CardHeader>

          <CardContent>
            {recomendaciones.length === 0 ? (
              <EmptyState text="Aún no hay datos suficientes para generar recomendaciones." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {recomendaciones.slice(0, 6).map((item, index) => (
                  <div
                    key={`${item.tipo}-${item.sku}-${index}`}
                    className="rounded-xl border bg-card p-4 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <TypeBadge tipo={item.tipo} />
                      <PriorityBadge prioridad={item.prioridad} />
                    </div>

                    <div>
                      <p className="font-semibold">{item.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {item.sku}
                      </p>
                    </div>

                    <p className="text-sm">{item.mensaje}</p>

                    <div className="rounded-md bg-muted p-3 text-sm">
                      <p className="font-medium">{item.accion}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.valorReferencia}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Card className="racknova-card racknova-metric-success">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Vendidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalPiezasVendidas}</p>
            </CardContent>
          </Card>

          <Card className="racknova-card racknova-metric-warning">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Sin ventas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{productosSinVentas}</p>
            </CardContent>
          </Card>

          <Card className="racknova-card racknova-metric-warning">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Por caducar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{porCaducar}</p>
            </CardContent>
          </Card>

          <Card className="racknova-card racknova-metric-danger">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Vencidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{vencidos}</p>
            </CardContent>
          </Card>

          <Card className="racknova-card racknova-metric-danger">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Boxes className="h-4 w-4" />
                Alertas altas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{alertasAltas}</p>
            </CardContent>
          </Card>

          <Card className="racknova-card racknova-metric-info">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <PackageCheck className="h-4 w-4" />
                Rentables
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{productosRentables}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle>Modelo predictivo de reabastecimiento</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tabla matemática para decidir cuándo comprar y cuánto comprar.
            </p>
          </CardHeader>

          <CardContent>
            {productosParaReabastecer.length === 0 ? (
              <EmptyState text="No hay productos con recomendación matemática de compra." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Demanda diaria</TableHead>
                    <TableHead>Días cobertura</TableHead>
                    <TableHead>Punto reorden</TableHead>
                    <TableHead>Sell-through</TableHead>
                    <TableHead>Margen</TableHead>
                    <TableHead>Compra sugerida</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {productosParaReabastecer.map((product) => (
                    <TableRow key={`modelo-${product.sku}`}>
                      <TableCell>
                        <Badge variant="outline">{product.sku}</Badge>
                      </TableCell>

                      <TableCell className="font-medium">
                        {product.nombre}
                      </TableCell>

                      <TableCell>{product.cantidadActual}</TableCell>

                      <TableCell>
                        {formatNumber(product.demandaDiaria)} pz/día
                      </TableCell>

                      <TableCell>
                        {product.diasCobertura === null
                          ? "Sin ventas"
                          : `${formatNumber(product.diasCobertura)} días`}
                      </TableCell>

                      <TableCell>
                        {formatNumber(product.puntoReorden)} pz
                      </TableCell>

                      <TableCell>{formatPercent(product.sellThrough)}</TableCell>

                      <TableCell>{formatPercent(product.margen)}</TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            product.compraSugerida > 0
                              ? "destructive"
                              : "outline"
                          }
                        >
                          Comprar {product.compraSugerida}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="racknova-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Recomendación de compra
              </CardTitle>
            </CardHeader>

            <CardContent>
              {comprasSugeridas.length === 0 ? (
                <EmptyState text="No hay productos con recomendación de compra." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {comprasSugeridas.map((item, index) => (
                      <TableRow key={`compra-${item.sku}-${index}`}>
                        <TableCell>
                          <PriorityBadge prioridad={item.prioridad} />
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline">{item.sku}</Badge>
                        </TableCell>

                        <TableCell className="font-medium">
                          {item.nombre}
                        </TableCell>

                        <TableCell>{item.mensaje}</TableCell>

                        <TableCell>{item.accion}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="racknova-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Descuentos / prioridad de salida
              </CardTitle>
            </CardHeader>

            <CardContent>
              {descuentosSugeridos.length === 0 ? (
                <EmptyState text="No hay productos con recomendación de descuento o caducidad." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Descuento</TableHead>
                      <TableHead>Recuperación</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {descuentosSugeridos.map((item, index) => (
                      <TableRow key={`descuento-${item.sku}-${index}`}>
                        <TableCell>
                          <PriorityBadge prioridad={item.prioridad} />
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline">{item.sku}</Badge>
                        </TableCell>

                        <TableCell className="font-medium">
                          {item.nombre}
                        </TableCell>

                        <TableCell>{item.mensaje}</TableCell>

                        <TableCell>
                          {item.descuentoSugerido
                            ? `${item.descuentoSugerido}%`
                            : "No aplica"}
                        </TableCell>

                        <TableCell>
                          {item.recuperacionEstimada
                            ? formatMoney(item.recuperacionEstimada)
                            : "-"}
                        </TableCell>

                        <TableCell>
                          {item.resultadoConDescuento !== undefined &&
                          item.resultadoConDescuento !== 0 ? (
                            <span
                              className={
                                item.resultadoConDescuento >= 0
                                  ? "font-semibold text-green-600"
                                  : "font-semibold text-red-600"
                              }
                            >
                              {item.resultadoConDescuento >= 0 ? "+" : "-"}
                              {formatMoney(Math.abs(item.resultadoConDescuento))}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Optimización de ubicación
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Muestra los 2 productos sin venta o con más tiempo sin vender y
              sugiere moverlos cerca del producto más vendido.
            </p>
          </CardHeader>

          <CardContent>
            {ubicacionSugerida.length === 0 ? (
              <EmptyState text="No hay recomendaciones de ubicación por ahora." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Diagnóstico</TableHead>
                    <TableHead>Ubicación actual</TableHead>
                    <TableHead>Ubicación sugerida</TableHead>
                    <TableHead>Acción</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {ubicacionSugerida.map((item, index) => (
                    <TableRow key={`ubicacion-${item.sku}-${index}`}>
                      <TableCell>
                        <PriorityBadge prioridad={item.prioridad} />
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">{item.sku}</Badge>
                      </TableCell>

                      <TableCell className="font-medium">
                        {item.nombre}
                      </TableCell>

                      <TableCell>{item.mensaje}</TableCell>

                      <TableCell>{item.ubicacionActual ?? "-"}</TableCell>

                      <TableCell>
                        <Badge variant="secondary">
                          {item.ubicacionSugerida ?? "Revisar manualmente"}
                        </Badge>
                      </TableCell>

                      <TableCell>{item.accion}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="racknova-card">
            <CardHeader>
              <CardTitle>Productos más vendidos</CardTitle>
            </CardHeader>

            <CardContent>
              {productosMasVendidos.length === 0 ? (
                <EmptyState text="Todavía no hay ventas registradas." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={productosMasVendidos}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sku" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="cantidadVendida" name="Piezas vendidas">
                      {productosMasVendidos.map((_, index) => (
                        <Cell
                          key={`top-sale-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="racknova-card">
            <CardHeader>
              <CardTitle>Productos menos vendidos / sin ventas</CardTitle>
            </CardHeader>

            <CardContent>
              {productosMenosVendidos.length === 0 ? (
                <EmptyState text="No hay productos para analizar." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={productosMenosVendidos}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sku" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="cantidadVendida"
                      name="Piezas vendidas"
                      fill="hsl(var(--chart-orange))"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="racknova-card">
            <CardHeader>
              <CardTitle>Stock bajo</CardTitle>
            </CardHeader>

            <CardContent>
              {productosStockBajo.length === 0 ? (
                <EmptyState text="No hay productos con stock bajo." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={productosStockBajo}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sku" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="cantidadActual"
                      name="Cantidad actual"
                      fill="hsl(var(--chart-red))"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="racknova-card">
            <CardHeader>
              <CardTitle>Productos con mayor stock</CardTitle>
            </CardHeader>

            <CardContent>
              {productosStockAlto.length === 0 ? (
                <EmptyState text="No hay productos para analizar." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={productosStockAlto}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sku" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="cantidadActual"
                      name="Cantidad actual"
                      fill="hsl(var(--chart-green))"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle>Productos próximos a caducar</CardTitle>
          </CardHeader>

          <CardContent>
            {productosPorCaducar.length === 0 ? (
              <EmptyState text="No hay productos próximos a caducar en los siguientes 30 días." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Caducidad</TableHead>
                    <TableHead>Días restantes</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {productosPorCaducar.map((product) => (
                    <TableRow key={product.sku}>
                      <TableCell>
                        <ExpirationBadge days={product.diasRestantes} />
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">{product.sku}</Badge>
                      </TableCell>

                      <TableCell className="font-medium">
                        {product.nombre}
                      </TableCell>

                      <TableCell>{product.cantidad}</TableCell>

                      <TableCell>{formatDate(product.caducidad)}</TableCell>

                      <TableCell>
                        {product.diasRestantes < 0
                          ? `${Math.abs(product.diasRestantes)} día(s) vencido`
                          : `${product.diasRestantes} día(s)`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle>Reporte ejecutivo de recomendaciones</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tabla general para revisar decisiones sugeridas por RackNova iA.
            </p>
          </CardHeader>

          <CardContent>
            {recomendaciones.length === 0 ? (
              <EmptyState text="No hay recomendaciones generadas." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Diagnóstico</TableHead>
                    <TableHead>Acción sugerida</TableHead>
                    <TableHead>Referencia</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {recomendaciones.map((item, index) => (
                    <TableRow key={`reporte-${item.sku}-${item.tipo}-${index}`}>
                      <TableCell>
                        <PriorityBadge prioridad={item.prioridad} />
                      </TableCell>

                      <TableCell>
                        <TypeBadge tipo={item.tipo} />
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">{item.sku}</Badge>
                      </TableCell>

                      <TableCell className="font-medium">
                        {item.nombre}
                      </TableCell>

                      <TableCell>{item.mensaje}</TableCell>

                      <TableCell>{item.accion}</TableCell>

                      <TableCell>{item.valorReferencia}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
