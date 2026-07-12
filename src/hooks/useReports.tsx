import { useInventory } from "@/context/InventoryContext";
import { Product } from "@/types/inventory";
import { MovementRecord } from "@/types/movement";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export type ReportPeriod = "7d" | "30d" | "month" | "year" | "all";

type ChartItem = {
  label: string;
  value: number;
  color: [number, number, number];
  hex: string;
};

type ProductSalesSummary = {
  sku: string;
  nombre: string;
  cantidadVendida: number;
  ingresoTotal: number;
  costoTotal: number;
  ganancia: number;
  ultimaVenta: Date | null;
};

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  month: "Mes actual",
  year: "Año actual",
  all: "Todo el historial",
};

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));

const shortMoney = (value: number) => {
  const number = Number(value || 0);

  if (Math.abs(number) >= 1_000_000) {
    return `$${(number / 1_000_000).toFixed(1)}M`;
  }

  if (Math.abs(number) >= 1_000) {
    return `$${(number / 1_000).toFixed(1)}K`;
  }

  return `$${number.toFixed(0)}`;
};

const percent = (value: number) => `${Number(value || 0).toFixed(1)}%`;

const formatDate = (value?: string | Date | null) => {
  if (!value) return "Sin fecha";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "Sin fecha";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const cleanDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isMovementInsidePeriod = (
  movement: MovementRecord,
  period: ReportPeriod
) => {
  if (period === "all") return true;

  const movementDate = cleanDate(new Date(movement.timestamp));
  const today = cleanDate(new Date());

  if (period === "7d") {
    const from = new Date(today);
    from.setDate(today.getDate() - 7);
    return movementDate >= from;
  }

  if (period === "30d") {
    const from = new Date(today);
    from.setDate(today.getDate() - 30);
    return movementDate >= from;
  }

  if (period === "month") {
    return (
      movementDate.getFullYear() === today.getFullYear() &&
      movementDate.getMonth() === today.getMonth()
    );
  }

  if (period === "year") {
    return movementDate.getFullYear() === today.getFullYear();
  }

  return true;
};

const getStockStatus = (product: Product) => {
  const stockMinimo = Number(product.stock_minimo ?? 10);
  const stockAlto = Number(product.stock_alto ?? stockMinimo * 3);

  if (product.cantidad <= stockMinimo) return "Stock bajo";
  if (product.cantidad >= stockAlto) return "Stock alto";

  return "Stock normal";
};

const getExpirationDays = (caducidad?: string | null) => {
  if (!caducidad) return null;

  const today = cleanDate(new Date());
  const expiration = cleanDate(new Date(`${caducidad.slice(0, 10)}T00:00:00`));

  return Math.ceil(
    (expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
};

const getExpirationStatus = (caducidad?: string | null) => {
  const diffDays = getExpirationDays(caducidad);

  if (diffDays === null) return "Sin caducidad";
  if (diffDays < 0) return `Vencido hace ${Math.abs(diffDays)} día(s)`;
  if (diffDays === 0) return "Vence hoy";
  if (diffDays <= 30) return `Caduca en ${diffDays} día(s)`;

  return "Vigente";
};

const getLocationParts = (locationId: string) => {
  const [rack = "-", nivel = "-", slot = "-"] = locationId.split("-");
  return { rack, nivel, slot };
};

const getLocationText = (locationId: string) => {
  const { rack, nivel, slot } = getLocationParts(locationId);
  return `Rack ${rack} / Nivel ${nivel} / Slot ${slot}`;
};

const getReportFileName = (
  base: string,
  period: ReportPeriod,
  extension: string
) => {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}-${period}-${stamp}.${extension}`;
};

const getProductSalesSummary = (
  movements: MovementRecord[]
): ProductSalesSummary[] => {
  const map = new Map<string, ProductSalesSummary>();

  movements
    .filter((movement) => movement.action === "Egreso")
    .forEach((movement) => {
      const current = map.get(movement.productSku) ?? {
        sku: movement.productSku,
        nombre: movement.productName,
        cantidadVendida: 0,
        ingresoTotal: 0,
        costoTotal: 0,
        ganancia: 0,
        ultimaVenta: null,
      };

      const fecha = new Date(movement.timestamp);

      current.cantidadVendida += Number(movement.quantity ?? 0);
      current.ingresoTotal += Number(movement.ingreso_total ?? 0);
      current.costoTotal += Number(movement.costo_total ?? 0);
      current.ganancia += Number(movement.ganancia ?? 0);

      if (!current.ultimaVenta || fecha > current.ultimaVenta) {
        current.ultimaVenta = fecha;
      }

      map.set(movement.productSku, current);
    });

  return Array.from(map.values()).sort(
    (a, b) => b.cantidadVendida - a.cantidadVendida
  );
};

const createCanvasBarChart = (
  title: string,
  data: ChartItem[],
  options?: {
    subtitle?: string;
    valueFormatter?: (value: number) => string;
  }
) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1100;
  canvas.height = 520;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const valueFormatter = options?.valueFormatter ?? ((value) => String(value));

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 30px Arial";
  ctx.fillText(title, 40, 52);

  if (options?.subtitle) {
    ctx.fillStyle = "#64748b";
    ctx.font = "18px Arial";
    ctx.fillText(options.subtitle, 40, 82);
  }

  const chartX = 70;
  const chartY = 120;
  const chartW = 960;
  const chartH = 290;

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 5; i++) {
    const y = chartY + (chartH / 5) * i;
    ctx.beginPath();
    ctx.moveTo(chartX, y);
    ctx.lineTo(chartX + chartW, y);
    ctx.stroke();
  }

  const maxValue = Math.max(...data.map((item) => Math.abs(item.value)), 1);
  const barGap = 24;
  const barW = Math.max(45, (chartW - barGap * (data.length + 1)) / data.length);

  data.forEach((item, index) => {
    const barHeight = Math.max(
      3,
      (Math.abs(item.value) / maxValue) * (chartH - 30)
    );

    const x = chartX + barGap + index * (barW + barGap);
    const y = chartY + chartH - barHeight;

    ctx.fillStyle = item.hex;
    ctx.fillRect(x, y, barW, barHeight);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 17px Arial";
    ctx.textAlign = "center";
    ctx.fillText(valueFormatter(item.value), x + barW / 2, y - 10);

    ctx.fillStyle = "#334155";
    ctx.font = "15px Arial";

    const label =
      item.label.length > 14 ? `${item.label.slice(0, 14)}...` : item.label;

    ctx.fillText(label, x + barW / 2, chartY + chartH + 28);
  });

  ctx.textAlign = "left";

  ctx.fillStyle = "#64748b";
  ctx.font = "14px Arial";
  ctx.fillText("Generado automáticamente por RackNova", 40, 485);

  return canvas.toDataURL("image/png");
};

const createCanvasHorizontalChart = (
  title: string,
  data: ChartItem[],
  options?: {
    subtitle?: string;
    valueFormatter?: (value: number) => string;
  }
) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1100;
  canvas.height = 520;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const valueFormatter = options?.valueFormatter ?? ((value) => String(value));

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 30px Arial";
  ctx.fillText(title, 40, 52);

  if (options?.subtitle) {
    ctx.fillStyle = "#64748b";
    ctx.font = "18px Arial";
    ctx.fillText(options.subtitle, 40, 82);
  }

  const chartX = 285;
  const chartY = 115;
  const chartW = 690;
  const barH = 34;
  const gap = 22;

  const maxValue = Math.max(...data.map((item) => Math.abs(item.value)), 1);

  data.forEach((item, index) => {
    const y = chartY + index * (barH + gap);
    const barW = Math.max(4, (Math.abs(item.value) / maxValue) * chartW);

    ctx.fillStyle = "#334155";
    ctx.font = "17px Arial";
    ctx.textAlign = "right";

    const label =
      item.label.length > 25 ? `${item.label.slice(0, 25)}...` : item.label;

    ctx.fillText(label, chartX - 15, y + 23);

    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(chartX, y, chartW, barH);

    ctx.fillStyle = item.hex;
    ctx.fillRect(chartX, y, barW, barH);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.fillText(valueFormatter(item.value), chartX + barW + 12, y + 23);
  });

  ctx.textAlign = "left";

  ctx.fillStyle = "#64748b";
  ctx.font = "14px Arial";
  ctx.fillText("Generado automáticamente por RackNova", 40, 485);

  return canvas.toDataURL("image/png");
};

const drawKpiCard = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  title: string,
  value: string,
  color: [number, number, number]
) => {
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, w, 20, 3, 3, "FD");

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(title, x + 4, y + 7);

  doc.setTextColor(color[0], color[1], color[2]);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(value, x + 4, y + 15);
};

const drawPdfBarChart = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  data: ChartItem[],
  valueFormatter: (value: number) => string = (value) => String(value)
) => {
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title, x + 4, y + 7);

  const chartX = x + 8;
  const chartY = y + 16;
  const chartW = w - 16;
  const chartH = h - 30;

  const maxValue = Math.max(...data.map((item) => Math.abs(item.value)), 1);
  const gap = 4;
  const barW = Math.max(5, (chartW - gap * (data.length + 1)) / data.length);

  data.forEach((item, index) => {
    const barH = Math.max(1, (Math.abs(item.value) / maxValue) * chartH);
    const barX = chartX + gap + index * (barW + gap);
    const barY = chartY + chartH - barH;

    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.rect(barX, barY, barW, barH, "F");

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");

    const label =
      item.label.length > 9 ? `${item.label.slice(0, 9)}...` : item.label;

    doc.text(label, barX, chartY + chartH + 5);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(valueFormatter(item.value), barX, barY - 2);
  });
};

const styleHeaderCell = (cell: ExcelJS.Cell) => {
  cell.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };

  cell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };

  cell.border = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };
};

const styleBodyCell = (cell: ExcelJS.Cell) => {
  cell.border = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  cell.alignment = {
    vertical: "middle",
    wrapText: true,
  };
};

export function useReports() {
  const { products, locations, movements } = useInventory();

  const getReportData = (period: ReportPeriod = "all") => {
    const filteredMovements = movements.filter((movement) =>
      isMovementInsidePeriod(movement, period)
    );

    const allSalesMovements = movements.filter(
      (movement) => movement.action === "Egreso"
    );

    const allIncomeMovements = movements.filter(
      (movement) => movement.action === "Ingreso"
    );

    const salesMovements = filteredMovements.filter(
      (movement) => movement.action === "Egreso"
    );

    const ingresoMovements = filteredMovements.filter(
      (movement) => movement.action === "Ingreso"
    );

    const productSales = getProductSalesSummary(filteredMovements);
    const allProductSales = getProductSalesSummary(movements);

    const soldSkuSet = new Set(productSales.map((item) => item.sku));

    const unsoldProductsInPeriod = products.filter(
      (product) => !soldSkuSet.has(product.sku)
    );

    const totalProductos = products.length;

    const totalPiezas = products.reduce(
      (total, product) => total + Number(product.cantidad || 0),
      0
    );

    const stockBajo = products.filter(
      (product) => getStockStatus(product) === "Stock bajo"
    );

    const stockNormal = products.filter(
      (product) => getStockStatus(product) === "Stock normal"
    );

    const stockAlto = products.filter(
      (product) => getStockStatus(product) === "Stock alto"
    );

    const vencidos = products.filter((product) => {
      const days = getExpirationDays(product.caducidad);
      return days !== null && days < 0;
    });

    const proximosCaducar = products.filter((product) => {
      const days = getExpirationDays(product.caducidad);
      return days !== null && days >= 0 && days <= 30;
    });

    const vigentes = products.filter((product) => {
      const days = getExpirationDays(product.caducidad);
      return days !== null && days > 30;
    });

    const sinCaducidad = products.filter((product) => !product.caducidad);

    const valorInventario = products.reduce(
      (total, product) =>
        total +
        Number(product.cantidad || 0) * Number(product.costo_proveedor || 0),
      0
    );

    const ingresos = salesMovements.reduce(
      (total, movement) => total + Number(movement.ingreso_total ?? 0),
      0
    );

    const costos = salesMovements.reduce(
      (total, movement) => total + Number(movement.costo_total ?? 0),
      0
    );

    const ganancia = ingresos - costos;
    const margen = ingresos > 0 ? (ganancia / ingresos) * 100 : 0;

    const ingresosHistoricos = allSalesMovements.reduce(
      (total, movement) => total + Number(movement.ingreso_total ?? 0),
      0
    );

    const costosHistoricos = allSalesMovements.reduce(
      (total, movement) => total + Number(movement.costo_total ?? 0),
      0
    );

    const gananciaHistorica = ingresosHistoricos - costosHistoricos;

    const inversionAcumulada = allIncomeMovements.reduce(
      (total, movement) => total + Number(movement.costo_total ?? 0),
      0
    );

    const capitalRecuperado = allSalesMovements.reduce(
      (total, movement) => total + Number(movement.costo_total ?? 0),
      0
    );

    const pendientePorRecuperar = Math.max(
      inversionAcumulada - capitalRecuperado,
      0
    );

    const porcentajeRecuperado =
      inversionAcumulada > 0 ? (capitalRecuperado / inversionAcumulada) * 100 : 0;

    const roiInventario =
      inversionAcumulada > 0
        ? (gananciaHistorica / inversionAcumulada) * 100
        : 0;

    const piezasVendidas = salesMovements.reduce(
      (total, movement) => total + Number(movement.quantity ?? 0),
      0
    );

    const piezasIngresadas = ingresoMovements.reduce(
      (total, movement) => total + Number(movement.quantity ?? 0),
      0
    );

    const ticketPromedio =
      salesMovements.length > 0 ? ingresos / salesMovements.length : 0;

    const precioPromedioPorPieza =
      piezasVendidas > 0 ? ingresos / piezasVendidas : 0;

    const ventaMasAlta = salesMovements.reduce(
      (max, movement) =>
        Math.max(max, Number(movement.ingreso_total ?? 0)),
      0
    );

    const productosConPerdida = productSales.filter(
      (item) => item.ganancia < 0
    );

    const productosMargenBajo = productSales.filter((item) => {
      if (item.ingresoTotal <= 0) return false;
      const margenProducto = (item.ganancia / item.ingresoTotal) * 100;
      return margenProducto > 0 && margenProducto < 20;
    });

    const slotsOcupados = products.length;
    const slotsTotales = locations.length;

    const stockChart: ChartItem[] = [
      {
        label: "Bajo",
        value: stockBajo.length,
        color: [220, 38, 38],
        hex: "#dc2626",
      },
      {
        label: "Normal",
        value: stockNormal.length,
        color: [5, 150, 105],
        hex: "#059669",
      },
      {
        label: "Alto",
        value: stockAlto.length,
        color: [37, 99, 235],
        hex: "#2563eb",
      },
    ];

    const caducidadChart: ChartItem[] = [
      {
        label: "Vencidos",
        value: vencidos.length,
        color: [220, 38, 38],
        hex: "#dc2626",
      },
      {
        label: "Por caducar",
        value: proximosCaducar.length,
        color: [245, 158, 11],
        hex: "#f59e0b",
      },
      {
        label: "Vigentes",
        value: vigentes.length,
        color: [5, 150, 105],
        hex: "#059669",
      },
      {
        label: "Sin fecha",
        value: sinCaducidad.length,
        color: [100, 116, 139],
        hex: "#64748b",
      },
    ];

    const financialChart: ChartItem[] = [
      {
        label: "Ingresos",
        value: ingresos,
        color: [5, 150, 105],
        hex: "#059669",
      },
      {
        label: "Costos",
        value: costos,
        color: [245, 158, 11],
        hex: "#f59e0b",
      },
      {
        label: "Ganancia",
        value: ganancia,
        color: ganancia >= 0 ? [37, 99, 235] : [220, 38, 38],
        hex: ganancia >= 0 ? "#2563eb" : "#dc2626",
      },
    ];

    const investmentChart: ChartItem[] = [
      {
        label: "Invertido",
        value: inversionAcumulada,
        color: [124, 58, 237],
        hex: "#7c3aed",
      },
      {
        label: "Recuperado",
        value: capitalRecuperado,
        color: [5, 150, 105],
        hex: "#059669",
      },
      {
        label: "Pendiente",
        value: pendientePorRecuperar,
        color: [245, 158, 11],
        hex: "#f59e0b",
      },
    ];

    const topSoldChart: ChartItem[] =
      productSales.length > 0
        ? productSales.slice(0, 6).map((item, index) => ({
            label: item.nombre,
            value: item.cantidadVendida,
            color: [
              [37, 99, 235],
              [14, 165, 233],
              [124, 58, 237],
              [5, 150, 105],
              [245, 158, 11],
              [220, 38, 38],
            ][index] as [number, number, number],
            hex: [
              "#2563eb",
              "#0ea5e9",
              "#7c3aed",
              "#059669",
              "#f59e0b",
              "#dc2626",
            ][index],
          }))
        : [
            {
              label: "Sin ventas",
              value: 0,
              color: [100, 116, 139],
              hex: "#64748b",
            },
          ];

    const movementByDayMap = new Map<
      string,
      {
        fecha: string;
        ingresos: number;
        egresos: number;
        movimientos: number;
        ventas: number;
        ganancia: number;
      }
    >();

    filteredMovements.forEach((movement) => {
      const fecha = new Date(movement.timestamp).toISOString().slice(0, 10);

      const current = movementByDayMap.get(fecha) ?? {
        fecha,
        ingresos: 0,
        egresos: 0,
        movimientos: 0,
        ventas: 0,
        ganancia: 0,
      };

      if (movement.action === "Ingreso") {
        current.ingresos += Number(movement.quantity ?? 0);
      }

      if (movement.action === "Egreso") {
        current.egresos += Number(movement.quantity ?? 0);
        current.ventas += Number(movement.ingreso_total ?? 0);
        current.ganancia += Number(movement.ganancia ?? 0);
      }

      current.movimientos += 1;

      movementByDayMap.set(fecha, current);
    });

    const movementByDay = Array.from(movementByDayMap.values()).sort((a, b) =>
      a.fecha.localeCompare(b.fecha)
    );

    const lessSoldProducts = [...productSales]
      .filter((item) => item.cantidadVendida > 0)
      .sort((a, b) => a.cantidadVendida - b.cantidadVendida);

    return {
      period,
      periodLabel: PERIOD_LABELS[period],
      filteredMovements,
      salesMovements,
      ingresoMovements,
      allSalesMovements,
      allIncomeMovements,
      productSales,
      allProductSales,
      lessSoldProducts,
      unsoldProductsInPeriod,
      movementByDay,
      stockBajo,
      stockNormal,
      stockAlto,
      vencidos,
      proximosCaducar,
      vigentes,
      sinCaducidad,
      productosConPerdida,
      productosMargenBajo,
      summary: {
        totalProductos,
        totalPiezas,
        valorInventario,
        ingresos,
        costos,
        ganancia,
        margen,
        piezasVendidas,
        piezasIngresadas,
        movimientos: filteredMovements.length,
        ventas: salesMovements.length,
        ingresosMovimiento: ingresoMovements.length,
        slotsOcupados,
        slotsTotales,
        stockBajo: stockBajo.length,
        stockNormal: stockNormal.length,
        stockAlto: stockAlto.length,
        vencidos: vencidos.length,
        proximosCaducar: proximosCaducar.length,
        vigentes: vigentes.length,
        sinCaducidad: sinCaducidad.length,
        productosVendidos: productSales.length,
        productosSinVentaPeriodo: unsoldProductsInPeriod.length,
        ticketPromedio,
        precioPromedioPorPieza,
        ventaMasAlta,
        ingresosHistoricos,
        costosHistoricos,
        gananciaHistorica,
        inversionAcumulada,
        capitalRecuperado,
        pendientePorRecuperar,
        porcentajeRecuperado,
        roiInventario,
        productosConPerdida: productosConPerdida.length,
        productosMargenBajo: productosMargenBajo.length,
      },
      charts: {
        stockChart,
        caducidadChart,
        financialChart,
        investmentChart,
        topSoldChart,
      },
    };
  };

  const downloadPDF = (period: ReportPeriod = "all") => {
    const report = getReportData(period);
    const { summary, charts } = report;

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 38, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("RackNova", 14, 16);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Reporte maestro completo de inventario, finanzas y operación", 14, 25);

    doc.setFontSize(9);
    doc.text(`Periodo: ${report.periodLabel}`, 14, 32);
    doc.text(`Generado: ${formatDateTime(new Date())}`, 82, 32);

    drawKpiCard(doc, 14, 46, 43, "Productos", String(summary.totalProductos), [
      37, 99, 235,
    ]);

    drawKpiCard(doc, 62, 46, 43, "Piezas actuales", String(summary.totalPiezas), [
      5, 150, 105,
    ]);

    drawKpiCard(doc, 110, 46, 43, "Valor inventario", shortMoney(summary.valorInventario), [
      124, 58, 237,
    ]);

    drawKpiCard(doc, 158, 46, 43, "Ingresos periodo", shortMoney(summary.ingresos), [
      5, 150, 105,
    ]);

    drawKpiCard(doc, 206, 46, 43, "Ganancia periodo", shortMoney(summary.ganancia), [
      summary.ganancia >= 0 ? 5 : 220,
      summary.ganancia >= 0 ? 150 : 38,
      summary.ganancia >= 0 ? 105 : 38,
    ]);

    drawKpiCard(doc, 254, 46, 30, "Margen", percent(summary.margen), [
      37, 99, 235,
    ]);

    drawPdfBarChart(doc, 14, 75, 62, 48, "Estado de stock", charts.stockChart);

    drawPdfBarChart(doc, 82, 75, 62, 48, "Caducidades", charts.caducidadChart);

    drawPdfBarChart(
      doc,
      150,
      75,
      62,
      48,
      "Finanzas periodo",
      charts.financialChart,
      shortMoney
    );

    drawPdfBarChart(
      doc,
      218,
      75,
      62,
      48,
      "Más vendidos",
      charts.topSoldChart
    );

    autoTable(doc, {
      startY: 132,
      head: [["Indicador", "Valor", "Indicador", "Valor", "Indicador", "Valor"]],
      body: [
        [
          "Periodo",
          report.periodLabel,
          "Movimientos periodo",
          summary.movimientos,
          "Ventas periodo",
          summary.ventas,
        ],
        [
          "Piezas vendidas",
          summary.piezasVendidas,
          "Piezas ingresadas",
          summary.piezasIngresadas,
          "Productos sin venta",
          summary.productosSinVentaPeriodo,
        ],
        [
          "Ingresos periodo",
          money(summary.ingresos),
          "Costos periodo",
          money(summary.costos),
          "Ganancia periodo",
          money(summary.ganancia),
        ],
        [
          "Margen periodo",
          percent(summary.margen),
          "Ticket promedio",
          money(summary.ticketPromedio),
          "Precio promedio pieza",
          money(summary.precioPromedioPorPieza),
        ],
        [
          "Stock bajo",
          summary.stockBajo,
          "Stock alto",
          summary.stockAlto,
          "Stock normal",
          summary.stockNormal,
        ],
        [
          "Vencidos",
          summary.vencidos,
          "Por caducar",
          summary.proximosCaducar,
          "Sin caducidad",
          summary.sinCaducidad,
        ],
        [
          "Inversión histórica",
          money(summary.inversionAcumulada),
          "Capital recuperado",
          money(summary.capitalRecuperado),
          "ROI inventario",
          percent(summary.roiInventario),
        ],
        [
          "Recuperación inventario",
          percent(summary.porcentajeRecuperado),
          "Pendiente recuperar",
          money(summary.pendientePorRecuperar),
          "Ganancia histórica",
          money(summary.gananciaHistorica),
        ],
      ],
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
      },
    });

    doc.addPage();

    doc.setFillColor(5, 150, 105);
    doc.rect(0, 0, pageWidth, 26, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(`Análisis financiero - ${report.periodLabel}`, 14, 16);

    drawKpiCard(doc, 14, 34, 45, "Ingresos", shortMoney(summary.ingresos), [
      5, 150, 105,
    ]);

    drawKpiCard(doc, 64, 34, 45, "Costos", shortMoney(summary.costos), [
      245, 158, 11,
    ]);

    drawKpiCard(doc, 114, 34, 45, "Ganancia", shortMoney(summary.ganancia), [
      summary.ganancia >= 0 ? 5 : 220,
      summary.ganancia >= 0 ? 150 : 38,
      summary.ganancia >= 0 ? 105 : 38,
    ]);

    drawKpiCard(doc, 164, 34, 45, "Ticket promedio", shortMoney(summary.ticketPromedio), [
      37, 99, 235,
    ]);

    drawKpiCard(doc, 214, 34, 45, "Venta más alta", shortMoney(summary.ventaMasAlta), [
      124, 58, 237,
    ]);

    drawPdfBarChart(
      doc,
      14,
      64,
      82,
      55,
      "Ingresos, costos y ganancia",
      charts.financialChart,
      shortMoney
    );

    drawPdfBarChart(
      doc,
      104,
      64,
      82,
      55,
      "Recuperación de inversión",
      charts.investmentChart,
      shortMoney
    );

    autoTable(doc, {
      startY: 130,
      head: [
        [
          "SKU",
          "Producto",
          "Vendido",
          "Ingreso",
          "Costo",
          "Ganancia",
          "Margen",
          "Última venta",
        ],
      ],
      body:
        report.productSales.length > 0
          ? report.productSales.map((item) => {
              const margenProducto =
                item.ingresoTotal > 0
                  ? (item.ganancia / item.ingresoTotal) * 100
                  : 0;

              return [
                item.sku,
                item.nombre,
                item.cantidadVendida,
                money(item.ingresoTotal),
                money(item.costoTotal),
                money(item.ganancia),
                percent(margenProducto),
                formatDateTime(item.ultimaVenta),
              ];
            })
          : [["Sin ventas", "Sin ventas en el periodo", 0, "$0", "$0", "$0", "0%", "-"]],
      theme: "striped",
      styles: {
        fontSize: 7,
        cellPadding: 1.7,
      },
      headStyles: {
        fillColor: [5, 150, 105],
        textColor: [255, 255, 255],
      },
    });

    doc.addPage();

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 26, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Análisis operativo tipo Reportes", 14, 16);

    autoTable(doc, {
      startY: 34,
      head: [["Sección", "SKU", "Producto", "Cantidad", "Ubicación", "Detalle"]],
      body: [
        ...report.productSales.slice(0, 10).map((item) => [
          "Más vendidos",
          item.sku,
          item.nombre,
          item.cantidadVendida,
          "-",
          `Ganancia: ${money(item.ganancia)}`,
        ]),
        ...report.lessSoldProducts.slice(0, 10).map((item) => [
          "Menos vendidos",
          item.sku,
          item.nombre,
          item.cantidadVendida,
          "-",
          `Ingreso: ${money(item.ingresoTotal)}`,
        ]),
        ...report.unsoldProductsInPeriod.slice(0, 15).map((product) => [
          "Sin venta periodo",
          product.sku,
          product.nombre,
          product.cantidad,
          getLocationText(product.locationId),
          getStockStatus(product),
        ]),
        ...report.stockBajo.slice(0, 15).map((product) => [
          "Stock bajo",
          product.sku,
          product.nombre,
          product.cantidad,
          getLocationText(product.locationId),
          `Mínimo: ${product.stock_minimo ?? 10}`,
        ]),
        ...report.stockAlto.slice(0, 15).map((product) => [
          "Stock alto",
          product.sku,
          product.nombre,
          product.cantidad,
          getLocationText(product.locationId),
          `Alto: ${product.stock_alto ?? 30}`,
        ]),
        ...report.vencidos.slice(0, 15).map((product) => [
          "Vencido",
          product.sku,
          product.nombre,
          product.cantidad,
          getLocationText(product.locationId),
          getExpirationStatus(product.caducidad),
        ]),
        ...report.proximosCaducar.slice(0, 15).map((product) => [
          "Por caducar",
          product.sku,
          product.nombre,
          product.cantidad,
          getLocationText(product.locationId),
          getExpirationStatus(product.caducidad),
        ]),
      ],
      theme: "striped",
      styles: {
        fontSize: 7,
        cellPadding: 1.7,
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
      },
    });

    doc.addPage();

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 26, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Inventario completo actual", 14, 16);

    autoTable(doc, {
      startY: 34,
      head: [
        [
          "Ubicación",
          "SKU",
          "Producto",
          "Descripción",
          "Cantidad",
          "Costo",
          "Precio sugerido",
          "Valor inventario",
          "Caducidad",
          "Estado caducidad",
          "Stock",
        ],
      ],
      body: [...products]
        .sort((a, b) => a.locationId.localeCompare(b.locationId))
        .map((product) => [
          getLocationText(product.locationId),
          product.sku,
          product.nombre,
          product.descripcion ?? "",
          product.cantidad,
          money(Number(product.costo_proveedor ?? 0)),
          money(Number(product.precio_venta_sugerido ?? 0)),
          money(
            Number(product.cantidad ?? 0) * Number(product.costo_proveedor ?? 0)
          ),
          formatDate(product.caducidad),
          getExpirationStatus(product.caducidad),
          getStockStatus(product),
        ]),
      theme: "striped",
      styles: {
        fontSize: 6.6,
        cellPadding: 1.5,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
    });

    doc.addPage();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 26, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(`Movimientos del periodo: ${report.periodLabel}`, 14, 16);

    autoTable(doc, {
      startY: 34,
      head: [
        [
          "Fecha",
          "Acción",
          "SKU",
          "Producto",
          "Cantidad",
          "Ubicación",
          "Usuario",
          "Precio venta",
          "Ingreso",
          "Costo",
          "Ganancia",
        ],
      ],
      body: [...report.filteredMovements]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .map((movement) => [
          formatDateTime(movement.timestamp),
          movement.action,
          movement.productSku,
          movement.productName,
          movement.quantity,
          movement.location,
          movement.user,
          money(Number(movement.precio_venta ?? 0)),
          money(Number(movement.ingreso_total ?? 0)),
          money(Number(movement.costo_total ?? 0)),
          money(Number(movement.ganancia ?? 0)),
        ]),
      theme: "striped",
      styles: {
        fontSize: 6.8,
        cellPadding: 1.5,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
      },
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `RackNova · Reporte maestro · Página ${doc.getNumberOfPages()}`,
          pageWidth - 84,
          pageHeight - 8
        );
      },
    });

    doc.save(getReportFileName("racknova-reporte-maestro", period, "pdf"));
  };

  const downloadExcel = async (period: ReportPeriod = "all") => {
    const report = getReportData(period);
    const { summary, charts } = report;

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "RackNova";
    workbook.created = new Date();
    workbook.modified = new Date();

    const addExcelImage = (
      worksheet: ExcelJS.Worksheet,
      imageBase64: string,
      range: {
        tl: { col: number; row: number };
        ext: { width: number; height: number };
      }
    ) => {
      if (!imageBase64) return;

      const imageId = workbook.addImage({
        base64: imageBase64,
        extension: "png",
      });

      worksheet.addImage(imageId, range);
    };

    const stockImage = createCanvasBarChart("Distribución de stock", charts.stockChart, {
      subtitle: "Inventario actual completo",
    });

    const caducidadImage = createCanvasBarChart("Estado de caducidades", charts.caducidadChart, {
      subtitle: "Inventario actual completo",
    });

    const financialImage = createCanvasBarChart(
      "Resumen financiero del periodo",
      charts.financialChart,
      {
        subtitle: report.periodLabel,
        valueFormatter: shortMoney,
      }
    );

    const investmentImage = createCanvasBarChart(
      "Recuperación de inversión histórica",
      charts.investmentChart,
      {
        subtitle: "Inversión, capital recuperado y pendiente",
        valueFormatter: shortMoney,
      }
    );

    const topSoldImage = createCanvasHorizontalChart(
      "Productos más vendidos del periodo",
      charts.topSoldChart,
      {
        subtitle: report.periodLabel,
      }
    );

    const resumenSheet = workbook.addWorksheet("Resumen maestro", {
      views: [{ showGridLines: false }],
    });

    resumenSheet.mergeCells("A1:H1");
    resumenSheet.getCell("A1").value = "RackNova - Reporte maestro completo";
    resumenSheet.getCell("A1").font = {
      size: 20,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    resumenSheet.getCell("A1").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    resumenSheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    resumenSheet.getRow(1).height = 34;

    resumenSheet.mergeCells("A2:H2");
    resumenSheet.getCell("A2").value = `Periodo: ${
      report.periodLabel
    } · Generado: ${formatDateTime(new Date())}`;
    resumenSheet.getCell("A2").alignment = {
      horizontal: "center",
    };
    resumenSheet.getCell("A2").font = {
      color: { argb: "FF64748B" },
    };

    resumenSheet.addRow([]);
    resumenSheet.addRow(["Métrica", "Valor", "Métrica", "Valor"]);
    resumenSheet.getRow(4).eachCell(styleHeaderCell);

    const kpis = [
      ["Productos activos", summary.totalProductos],
      ["Piezas actuales", summary.totalPiezas],
      ["Valor inventario", summary.valorInventario],
      ["Movimientos periodo", summary.movimientos],
      ["Ventas periodo", summary.ventas],
      ["Piezas vendidas", summary.piezasVendidas],
      ["Ingresos periodo", summary.ingresos],
      ["Costos periodo", summary.costos],
      ["Ganancia periodo", summary.ganancia],
      ["Margen periodo", summary.margen],
      ["Ticket promedio", summary.ticketPromedio],
      ["Precio promedio pieza", summary.precioPromedioPorPieza],
      ["Venta más alta", summary.ventaMasAlta],
      ["Productos vendidos", summary.productosVendidos],
      ["Productos sin venta", summary.productosSinVentaPeriodo],
      ["Productos con pérdida", summary.productosConPerdida],
      ["Productos margen bajo", summary.productosMargenBajo],
      ["Stock bajo", summary.stockBajo],
      ["Stock alto", summary.stockAlto],
      ["Vencidos", summary.vencidos],
      ["Por caducar", summary.proximosCaducar],
      ["Inversión histórica", summary.inversionAcumulada],
      ["Capital recuperado", summary.capitalRecuperado],
      ["Pendiente recuperar", summary.pendientePorRecuperar],
      ["Recuperación", summary.porcentajeRecuperado],
      ["ROI inventario", summary.roiInventario],
      ["Ganancia histórica", summary.gananciaHistorica],
      ["Slots ocupados", `${summary.slotsOcupados} / ${summary.slotsTotales}`],
    ];

    for (let i = 0; i < kpis.length; i += 2) {
      const row = resumenSheet.addRow([
        kpis[i][0],
        kpis[i][1],
        kpis[i + 1]?.[0] ?? "",
        kpis[i + 1]?.[1] ?? "",
      ]);

      row.eachCell(styleBodyCell);

      const metricA = String(kpis[i][0]);
      const metricB = String(kpis[i + 1]?.[0] ?? "");

      if (
        metricA.includes("Valor") ||
        metricA.includes("Ingresos") ||
        metricA.includes("Costos") ||
        metricA.includes("Ganancia") ||
        metricA.includes("Ticket") ||
        metricA.includes("Precio") ||
        metricA.includes("Venta") ||
        metricA.includes("Inversión") ||
        metricA.includes("Capital") ||
        metricA.includes("Pendiente")
      ) {
        row.getCell(2).numFmt = "$#,##0.00";
      }

      if (
        metricB.includes("Valor") ||
        metricB.includes("Ingresos") ||
        metricB.includes("Costos") ||
        metricB.includes("Ganancia") ||
        metricB.includes("Ticket") ||
        metricB.includes("Precio") ||
        metricB.includes("Venta") ||
        metricB.includes("Inversión") ||
        metricB.includes("Capital") ||
        metricB.includes("Pendiente")
      ) {
        row.getCell(4).numFmt = "$#,##0.00";
      }

      if (
        metricA.includes("Margen") ||
        metricA.includes("Recuperación") ||
        metricA.includes("ROI")
      ) {
        row.getCell(2).numFmt = "0.0%";
        if (typeof row.getCell(2).value === "number") {
          row.getCell(2).value = Number(row.getCell(2).value) / 100;
        }
      }

      if (
        metricB.includes("Margen") ||
        metricB.includes("Recuperación") ||
        metricB.includes("ROI")
      ) {
        row.getCell(4).numFmt = "0.0%";
        if (typeof row.getCell(4).value === "number") {
          row.getCell(4).value = Number(row.getCell(4).value) / 100;
        }
      }
    }

    resumenSheet.columns = [
      { width: 30 },
      { width: 18 },
      { width: 30 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
    ];

    addExcelImage(resumenSheet, stockImage, {
      tl: { col: 0, row: 19 },
      ext: { width: 490, height: 250 },
    });

    addExcelImage(resumenSheet, caducidadImage, {
      tl: { col: 5, row: 19 },
      ext: { width: 490, height: 250 },
    });

    addExcelImage(resumenSheet, financialImage, {
      tl: { col: 0, row: 34 },
      ext: { width: 490, height: 250 },
    });

    addExcelImage(resumenSheet, investmentImage, {
      tl: { col: 5, row: 34 },
      ext: { width: 490, height: 250 },
    });

    const finanzasSheet = workbook.addWorksheet("Finanzas", {
      views: [{ state: "frozen", ySplit: 6 }],
    });

    finanzasSheet.mergeCells("A1:H1");
    finanzasSheet.getCell("A1").value = `Finanzas - ${report.periodLabel}`;
    finanzasSheet.getCell("A1").font = {
      size: 18,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    finanzasSheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    finanzasSheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF059669" },
    };
    finanzasSheet.getRow(1).height = 30;

    finanzasSheet.addTable({
      name: "TablaFinanzasRackNova",
      ref: "A6",
      headerRow: true,
      totalsRow: false,
      style: {
        theme: "TableStyleMedium4",
        showRowStripes: true,
      },
      columns: [
        { name: "Indicador" },
        { name: "Valor" },
        { name: "Tipo" },
        { name: "Descripción" },
      ],
      rows: [
        ["Ingresos periodo", summary.ingresos, "Periodo", "Ventas registradas en el periodo seleccionado"],
        ["Costos periodo", summary.costos, "Periodo", "Costo asociado a salidas del periodo"],
        ["Ganancia periodo", summary.ganancia, "Periodo", "Ingresos menos costos"],
        ["Margen periodo", summary.margen / 100, "Periodo", "Ganancia / ingresos"],
        ["Ticket promedio", summary.ticketPromedio, "Periodo", "Ingreso promedio por venta"],
        ["Precio promedio por pieza", summary.precioPromedioPorPieza, "Periodo", "Ingreso promedio por pieza vendida"],
        ["Venta más alta", summary.ventaMasAlta, "Periodo", "Mayor ingreso registrado en una venta"],
        ["Inversión histórica", summary.inversionAcumulada, "Histórico", "Total invertido registrado por ingresos"],
        ["Capital recuperado", summary.capitalRecuperado, "Histórico", "Costo recuperado por ventas"],
        ["Pendiente recuperar", summary.pendientePorRecuperar, "Histórico", "Inversión aún no recuperada"],
        ["Recuperación", summary.porcentajeRecuperado / 100, "Histórico", "Capital recuperado / inversión"],
        ["ROI inventario", summary.roiInventario / 100, "Histórico", "Ganancia histórica / inversión"],
        ["Ganancia histórica", summary.gananciaHistorica, "Histórico", "Ganancia acumulada total"],
      ],
    });

    finanzasSheet.columns = [
      { width: 28 },
      { width: 18 },
      { width: 16 },
      { width: 60 },
    ];

    finanzasSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        styleBodyCell(cell);
        if (rowNumber === 6) styleHeaderCell(cell);
      });

      if (rowNumber > 6) {
        const indicador = String(row.getCell(1).value ?? "");

        if (
          indicador.includes("Margen") ||
          indicador.includes("Recuperación") ||
          indicador.includes("ROI")
        ) {
          row.getCell(2).numFmt = "0.0%";
        } else {
          row.getCell(2).numFmt = "$#,##0.00";
        }
      }
    });

    const reportesSheet = workbook.addWorksheet("Reportes operativos", {
      views: [{ state: "frozen", ySplit: 6 }],
    });

    reportesSheet.mergeCells("A1:F1");
    reportesSheet.getCell("A1").value = `Reportes operativos - ${report.periodLabel}`;
    reportesSheet.getCell("A1").font = {
      size: 18,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    reportesSheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    reportesSheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    reportesSheet.getRow(1).height = 30;

    reportesSheet.addTable({
      name: "TablaReportesOperativosRackNova",
      ref: "A6",
      headerRow: true,
      totalsRow: false,
      style: {
        theme: "TableStyleMedium2",
        showRowStripes: true,
      },
      columns: [
        { name: "Sección" },
        { name: "SKU" },
        { name: "Producto" },
        { name: "Cantidad" },
        { name: "Ubicación" },
        { name: "Detalle" },
      ],
      rows: [
        ...report.productSales.map((item) => [
          "Más vendidos",
          item.sku,
          item.nombre,
          item.cantidadVendida,
          "-",
          `Ganancia: ${money(item.ganancia)}`,
        ]),
        ...report.lessSoldProducts.map((item) => [
          "Menos vendidos",
          item.sku,
          item.nombre,
          item.cantidadVendida,
          "-",
          `Ingreso: ${money(item.ingresoTotal)}`,
        ]),
        ...report.unsoldProductsInPeriod.map((product) => [
          "Sin venta periodo",
          product.sku,
          product.nombre,
          product.cantidad,
          getLocationText(product.locationId),
          getStockStatus(product),
        ]),
        ...report.stockBajo.map((product) => [
          "Stock bajo",
          product.sku,
          product.nombre,
          product.cantidad,
          getLocationText(product.locationId),
          `Mínimo: ${product.stock_minimo ?? 10}`,
        ]),
        ...report.stockAlto.map((product) => [
          "Stock alto",
          product.sku,
          product.nombre,
          product.cantidad,
          getLocationText(product.locationId),
          `Alto: ${product.stock_alto ?? 30}`,
        ]),
        ...report.vencidos.map((product) => [
          "Vencido",
          product.sku,
          product.nombre,
          product.cantidad,
          getLocationText(product.locationId),
          getExpirationStatus(product.caducidad),
        ]),
        ...report.proximosCaducar.map((product) => [
          "Por caducar",
          product.sku,
          product.nombre,
          product.cantidad,
          getLocationText(product.locationId),
          getExpirationStatus(product.caducidad),
        ]),
        ...report.productosConPerdida.map((item) => [
          "Producto con pérdida",
          item.sku,
          item.nombre,
          item.cantidadVendida,
          "-",
          `Pérdida: ${money(item.ganancia)}`,
        ]),
        ...report.productosMargenBajo.map((item) => [
          "Margen bajo",
          item.sku,
          item.nombre,
          item.cantidadVendida,
          "-",
          `Margen menor a 20%`,
        ]),
      ],
    });

    reportesSheet.columns = [
      { width: 22 },
      { width: 18 },
      { width: 32 },
      { width: 14 },
      { width: 28 },
      { width: 40 },
    ];

    reportesSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        styleBodyCell(cell);
        if (rowNumber === 6) styleHeaderCell(cell);
      });
    });

    const productosSheet = workbook.addWorksheet("Inventario completo", {
      views: [{ state: "frozen", ySplit: 6 }],
    });

    productosSheet.mergeCells("A1:N1");
    productosSheet.getCell("A1").value = "Inventario completo actual";
    productosSheet.getCell("A1").font = {
      size: 18,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    productosSheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    productosSheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    productosSheet.getRow(1).height = 30;

    productosSheet.addTable({
      name: "TablaInventarioCompletoRackNova",
      ref: "A6",
      headerRow: true,
      totalsRow: false,
      style: {
        theme: "TableStyleMedium2",
        showRowStripes: true,
      },
      columns: [
        { name: "Ubicación" },
        { name: "Rack" },
        { name: "Nivel" },
        { name: "Slot" },
        { name: "SKU" },
        { name: "Nombre" },
        { name: "Descripción" },
        { name: "Cantidad" },
        { name: "Costo proveedor" },
        { name: "Precio sugerido" },
        { name: "Valor inventario" },
        { name: "Caducidad" },
        { name: "Estado caducidad" },
        { name: "Estado stock" },
      ],
      rows: [...products]
        .sort((a, b) => a.locationId.localeCompare(b.locationId))
        .map((product) => {
          const { rack, nivel, slot } = getLocationParts(product.locationId);

          return [
            getLocationText(product.locationId),
            rack,
            nivel,
            slot,
            product.sku,
            product.nombre,
            product.descripcion ?? "",
            Number(product.cantidad ?? 0),
            Number(product.costo_proveedor ?? 0),
            Number(product.precio_venta_sugerido ?? 0),
            Number(product.cantidad ?? 0) *
              Number(product.costo_proveedor ?? 0),
            product.caducidad ?? "",
            getExpirationStatus(product.caducidad),
            getStockStatus(product),
          ];
        }),
    });

    productosSheet.columns = [
      { width: 28 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 18 },
      { width: 30 },
      { width: 35 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 16 },
      { width: 24 },
      { width: 18 },
    ];

    productosSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        styleBodyCell(cell);
        if (rowNumber === 6) styleHeaderCell(cell);
      });

      if (rowNumber > 6) {
        row.getCell(9).numFmt = "$#,##0.00";
        row.getCell(10).numFmt = "$#,##0.00";
        row.getCell(11).numFmt = "$#,##0.00";
      }
    });

    const movimientosSheet = workbook.addWorksheet("Movimientos periodo", {
      views: [{ state: "frozen", ySplit: 6 }],
    });

    movimientosSheet.mergeCells("A1:L1");
    movimientosSheet.getCell("A1").value = `Movimientos - ${report.periodLabel}`;
    movimientosSheet.getCell("A1").font = {
      size: 18,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    movimientosSheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    movimientosSheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    movimientosSheet.getRow(1).height = 30;

    movimientosSheet.addTable({
      name: "TablaMovimientosPeriodoRackNova",
      ref: "A6",
      headerRow: true,
      totalsRow: false,
      style: {
        theme: "TableStyleMedium9",
        showRowStripes: true,
      },
      columns: [
        { name: "Fecha" },
        { name: "Acción" },
        { name: "SKU" },
        { name: "Producto" },
        { name: "Cantidad" },
        { name: "Ubicación" },
        { name: "Usuario" },
        { name: "Costo proveedor" },
        { name: "Precio venta" },
        { name: "Ingreso total" },
        { name: "Costo total" },
        { name: "Ganancia" },
      ],
      rows: [...report.filteredMovements]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .map((movement) => [
          formatDateTime(movement.timestamp),
          movement.action,
          movement.productSku,
          movement.productName,
          Number(movement.quantity ?? 0),
          movement.location,
          movement.user,
          Number(movement.costo_proveedor ?? 0),
          Number(movement.precio_venta ?? 0),
          Number(movement.ingreso_total ?? 0),
          Number(movement.costo_total ?? 0),
          Number(movement.ganancia ?? 0),
        ]),
    });

    movimientosSheet.columns = [
      { width: 24 },
      { width: 14 },
      { width: 18 },
      { width: 30 },
      { width: 12 },
      { width: 20 },
      { width: 24 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
    ];

    movimientosSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        styleBodyCell(cell);
        if (rowNumber === 6) styleHeaderCell(cell);
      });

      if (rowNumber > 6) {
        row.getCell(8).numFmt = "$#,##0.00";
        row.getCell(9).numFmt = "$#,##0.00";
        row.getCell(10).numFmt = "$#,##0.00";
        row.getCell(11).numFmt = "$#,##0.00";
        row.getCell(12).numFmt = "$#,##0.00";
      }
    });

    const ventasSheet = workbook.addWorksheet("Ventas por producto");

    ventasSheet.addTable({
      name: "TablaVentasPorProductoRackNova",
      ref: "A1",
      headerRow: true,
      totalsRow: true,
      style: {
        theme: "TableStyleMedium4",
        showRowStripes: true,
      },
      columns: [
        { name: "SKU" },
        { name: "Producto" },
        { name: "Cantidad vendida" },
        { name: "Ingreso total", totalsRowFunction: "sum" },
        { name: "Costo total", totalsRowFunction: "sum" },
        { name: "Ganancia", totalsRowFunction: "sum" },
        { name: "Margen" },
        { name: "Última venta" },
      ],
      rows: report.productSales.map((item) => {
        const margenProducto =
          item.ingresoTotal > 0 ? item.ganancia / item.ingresoTotal : 0;

        return [
          item.sku,
          item.nombre,
          item.cantidadVendida,
          item.ingresoTotal,
          item.costoTotal,
          item.ganancia,
          margenProducto,
          formatDateTime(item.ultimaVenta),
        ];
      }),
    });

    ventasSheet.columns = [
      { width: 18 },
      { width: 32 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 14 },
      { width: 24 },
    ];

    ventasSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        styleBodyCell(cell);
        if (rowNumber === 1) styleHeaderCell(cell);
      });

      if (rowNumber > 1) {
        row.getCell(4).numFmt = "$#,##0.00";
        row.getCell(5).numFmt = "$#,##0.00";
        row.getCell(6).numFmt = "$#,##0.00";
        row.getCell(7).numFmt = "0.0%";
      }
    });

    const sinVentaSheet = workbook.addWorksheet("Sin venta periodo");

    sinVentaSheet.addTable({
      name: "TablaProductosSinVentaRackNova",
      ref: "A1",
      headerRow: true,
      totalsRow: false,
      style: {
        theme: "TableStyleMedium7",
        showRowStripes: true,
      },
      columns: [
        { name: "SKU" },
        { name: "Producto" },
        { name: "Cantidad actual" },
        { name: "Ubicación" },
        { name: "Estado stock" },
        { name: "Caducidad" },
        { name: "Estado caducidad" },
      ],
      rows: report.unsoldProductsInPeriod.map((product) => [
        product.sku,
        product.nombre,
        Number(product.cantidad ?? 0),
        getLocationText(product.locationId),
        getStockStatus(product),
        product.caducidad ?? "",
        getExpirationStatus(product.caducidad),
      ]),
    });

    sinVentaSheet.columns = [
      { width: 18 },
      { width: 32 },
      { width: 16 },
      { width: 28 },
      { width: 18 },
      { width: 16 },
      { width: 24 },
    ];

    const movimientosDiaSheet = workbook.addWorksheet("Movimientos por día");

    movimientosDiaSheet.addTable({
      name: "TablaMovimientosPorDiaRackNova",
      ref: "A1",
      headerRow: true,
      totalsRow: true,
      style: {
        theme: "TableStyleMedium6",
        showRowStripes: true,
      },
      columns: [
        { name: "Fecha" },
        { name: "Piezas ingresadas", totalsRowFunction: "sum" },
        { name: "Piezas egresadas", totalsRowFunction: "sum" },
        { name: "Movimientos", totalsRowFunction: "sum" },
        { name: "Ventas", totalsRowFunction: "sum" },
        { name: "Ganancia", totalsRowFunction: "sum" },
      ],
      rows: report.movementByDay.map((item) => [
        item.fecha,
        item.ingresos,
        item.egresos,
        item.movimientos,
        item.ventas,
        item.ganancia,
      ]),
    });

    movimientosDiaSheet.columns = [
      { width: 16 },
      { width: 18 },
      { width: 18 },
      { width: 16 },
      { width: 18 },
      { width: 18 },
    ];

    movimientosDiaSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        styleBodyCell(cell);
        if (rowNumber === 1) styleHeaderCell(cell);
      });

      if (rowNumber > 1) {
        row.getCell(5).numFmt = "$#,##0.00";
        row.getCell(6).numFmt = "$#,##0.00";
      }
    });

    const graficasSheet = workbook.addWorksheet("Gráficas", {
      views: [{ showGridLines: false }],
    });

    graficasSheet.mergeCells("A1:H1");
    graficasSheet.getCell("A1").value = `Gráficas RackNova - ${report.periodLabel}`;
    graficasSheet.getCell("A1").font = {
      size: 20,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    graficasSheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    graficasSheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    graficasSheet.getRow(1).height = 34;

    addExcelImage(graficasSheet, stockImage, {
      tl: { col: 0, row: 3 },
      ext: { width: 540, height: 270 },
    });

    addExcelImage(graficasSheet, caducidadImage, {
      tl: { col: 6, row: 3 },
      ext: { width: 540, height: 270 },
    });

    addExcelImage(graficasSheet, financialImage, {
      tl: { col: 0, row: 20 },
      ext: { width: 540, height: 270 },
    });

    addExcelImage(graficasSheet, topSoldImage, {
      tl: { col: 6, row: 20 },
      ext: { width: 540, height: 270 },
    });

    addExcelImage(graficasSheet, investmentImage, {
      tl: { col: 0, row: 37 },
      ext: { width: 540, height: 270 },
    });

    workbook.eachSheet((worksheet) => {
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.alignment = {
            vertical: "middle",
            wrapText: true,
          };
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    saveAs(
      new Blob([buffer as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      getReportFileName("racknova-reporte-maestro", period, "xlsx")
    );
  };

  return {
    downloadPDF,
    downloadExcel,
    getReportData,
  };
}
