import { useInventory } from "@/context/InventoryContext";
import { Product } from "@/types/inventory";
import { MovementRecord } from "@/types/movement";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

type ChartItem = {
  label: string;
  value: number;
  color: [number, number, number];
  hex: string;
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

const formatDate = (value?: string | Date | null) => {
  if (!value) return "Sin fecha";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "Sin fecha";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(`${caducidad.slice(0, 10)}T00:00:00`);
  expiration.setHours(0, 0, 0, 0);

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

const getLocationText = (locationId: string) => {
  const [rack, nivel, slot] = locationId.split("-");

  return `Rack ${rack} / Nivel ${nivel} / Slot ${slot}`;
};

const getReportFileName = (base: string, extension: string) => {
  const stamp = new Date().toISOString().slice(0, 10);

  return `${base}-${stamp}.${extension}`;
};

const getTopSoldProducts = (movements: MovementRecord[]) => {
  const map = new Map<
    string,
    {
      sku: string;
      nombre: string;
      cantidad: number;
    }
  >();

  movements
    .filter((movement) => movement.action === "Egreso")
    .forEach((movement) => {
      const current = map.get(movement.productSku) ?? {
        sku: movement.productSku,
        nombre: movement.productName,
        cantidad: 0,
      };

      current.cantidad += Number(movement.quantity ?? 0);
      map.set(movement.productSku, current);
    });

  return Array.from(map.values())
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 6);
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

  if (!ctx) {
    return "";
  }

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

  if (!ctx) {
    return "";
  }

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

  const chartX = 280;
  const chartY = 115;
  const chartW = 720;
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
      item.label.length > 24 ? `${item.label.slice(0, 24)}...` : item.label;

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

  const getSummary = () => {
    const totalProductos = products.length;

    const totalPiezas = products.reduce(
      (total, product) => total + Number(product.cantidad || 0),
      0
    );

    const stockBajo = products.filter(
      (product) => getStockStatus(product) === "Stock bajo"
    ).length;

    const stockNormal = products.filter(
      (product) => getStockStatus(product) === "Stock normal"
    ).length;

    const stockAlto = products.filter(
      (product) => getStockStatus(product) === "Stock alto"
    ).length;

    const vencidos = products.filter((product) => {
      const days = getExpirationDays(product.caducidad);
      return days !== null && days < 0;
    }).length;

    const proximosCaducar = products.filter((product) => {
      const days = getExpirationDays(product.caducidad);
      return days !== null && days >= 0 && days <= 30;
    }).length;

    const vigentes = products.filter((product) => {
      const days = getExpirationDays(product.caducidad);
      return days !== null && days > 30;
    }).length;

    const sinCaducidad = products.filter((product) => !product.caducidad).length;

    const valorInventario = products.reduce(
      (total, product) =>
        total +
        Number(product.cantidad || 0) * Number(product.costo_proveedor || 0),
      0
    );

    const ventas = movements.filter((movement) => movement.action === "Egreso");

    const ingresos = ventas.reduce(
      (total, movement) => total + Number(movement.ingreso_total ?? 0),
      0
    );

    const costos = ventas.reduce(
      (total, movement) => total + Number(movement.costo_total ?? 0),
      0
    );

    const ganancia = ingresos - costos;

    const slotsOcupados = products.length;
    const slotsTotales = locations.length;

    return {
      totalProductos,
      totalPiezas,
      stockBajo,
      stockNormal,
      stockAlto,
      vencidos,
      proximosCaducar,
      vigentes,
      sinCaducidad,
      valorInventario,
      ingresos,
      costos,
      ganancia,
      slotsOcupados,
      slotsTotales,
    };
  };

  const getChartData = () => {
    const summary = getSummary();

    const stockChart: ChartItem[] = [
      {
        label: "Bajo",
        value: summary.stockBajo,
        color: [220, 38, 38],
        hex: "#dc2626",
      },
      {
        label: "Normal",
        value: summary.stockNormal,
        color: [5, 150, 105],
        hex: "#059669",
      },
      {
        label: "Alto",
        value: summary.stockAlto,
        color: [37, 99, 235],
        hex: "#2563eb",
      },
    ];

    const caducidadChart: ChartItem[] = [
      {
        label: "Vencidos",
        value: summary.vencidos,
        color: [220, 38, 38],
        hex: "#dc2626",
      },
      {
        label: "Por caducar",
        value: summary.proximosCaducar,
        color: [245, 158, 11],
        hex: "#f59e0b",
      },
      {
        label: "Vigentes",
        value: summary.vigentes,
        color: [5, 150, 105],
        hex: "#059669",
      },
      {
        label: "Sin fecha",
        value: summary.sinCaducidad,
        color: [100, 116, 139],
        hex: "#64748b",
      },
    ];

    const financialChart: ChartItem[] = [
      {
        label: "Ingresos",
        value: summary.ingresos,
        color: [5, 150, 105],
        hex: "#059669",
      },
      {
        label: "Costos",
        value: summary.costos,
        color: [245, 158, 11],
        hex: "#f59e0b",
      },
      {
        label: "Ganancia",
        value: summary.ganancia,
        color: summary.ganancia >= 0 ? [37, 99, 235] : [220, 38, 38],
        hex: summary.ganancia >= 0 ? "#2563eb" : "#dc2626",
      },
    ];

    const topSold = getTopSoldProducts(movements);

    const topSoldChart: ChartItem[] =
      topSold.length > 0
        ? topSold.map((item, index) => ({
            label: item.nombre,
            value: item.cantidad,
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

    return {
      stockChart,
      caducidadChart,
      financialChart,
      topSoldChart,
    };
  };

  const downloadPDF = () => {
    const summary = getSummary();
    const charts = getChartData();

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
    doc.text("Reporte profesional de inventario", 14, 25);

    doc.setFontSize(9);
    doc.text(`Generado: ${formatDateTime(new Date())}`, 14, 32);

    drawKpiCard(
      doc,
      14,
      46,
      48,
      "Productos",
      String(summary.totalProductos),
      [37, 99, 235]
    );

    drawKpiCard(
      doc,
      68,
      46,
      48,
      "Piezas",
      String(summary.totalPiezas),
      [5, 150, 105]
    );

    drawKpiCard(
      doc,
      122,
      46,
      48,
      "Stock bajo",
      String(summary.stockBajo),
      [245, 158, 11]
    );

    drawKpiCard(
      doc,
      176,
      46,
      48,
      "Valor inventario",
      shortMoney(summary.valorInventario),
      [124, 58, 237]
    );

    drawKpiCard(
      doc,
      230,
      46,
      48,
      "Ganancia",
      shortMoney(summary.ganancia),
      summary.ganancia >= 0 ? [5, 150, 105] : [220, 38, 38]
    );

    drawPdfBarChart(
      doc,
      14,
      75,
      62,
      48,
      "Estado de stock",
      charts.stockChart
    );

    drawPdfBarChart(
      doc,
      82,
      75,
      62,
      48,
      "Caducidades",
      charts.caducidadChart
    );

    drawPdfBarChart(
      doc,
      150,
      75,
      62,
      48,
      "Finanzas",
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

    const productosOrdenados = [...products].sort((a, b) =>
      a.locationId.localeCompare(b.locationId)
    );

    autoTable(doc, {
      startY: 132,
      head: [
        [
          "Ubicación",
          "SKU",
          "Producto",
          "Cantidad",
          "Costo",
          "Precio sugerido",
          "Caducidad",
          "Estado caducidad",
          "Stock",
        ],
      ],
      body: productosOrdenados.map((product) => [
        getLocationText(product.locationId),
        product.sku,
        product.nombre,
        product.cantidad,
        money(Number(product.costo_proveedor ?? 0)),
        money(Number(product.precio_venta_sugerido ?? 0)),
        formatDate(product.caducidad),
        getExpirationStatus(product.caducidad),
        getStockStatus(product),
      ]),
      theme: "striped",
      styles: {
        fontSize: 7,
        cellPadding: 1.6,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `RackNova · Reporte de inventario · Página ${doc.getNumberOfPages()}`,
          pageWidth - 88,
          pageHeight - 8
        );
      },
    });

    const movimientosRecientes = [...movements]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 30);

    if (movimientosRecientes.length > 0) {
      doc.addPage();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 26, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("Movimientos recientes", 14, 16);

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
            "Ingreso",
            "Costo",
            "Ganancia",
          ],
        ],
        body: movimientosRecientes.map((movement) => [
          formatDateTime(movement.timestamp),
          movement.action,
          movement.productSku,
          movement.productName,
          movement.quantity,
          movement.location,
          movement.user,
          money(Number(movement.ingreso_total ?? 0)),
          money(Number(movement.costo_total ?? 0)),
          money(Number(movement.ganancia ?? 0)),
        ]),
        theme: "striped",
        styles: {
          fontSize: 7,
          cellPadding: 1.8,
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
        },
      });
    }

    doc.save(getReportFileName("racknova-reporte-profesional", "pdf"));
  };

  const downloadExcel = async () => {
    const summary = getSummary();
    const charts = getChartData();

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "RackNova";
    workbook.created = new Date();
    workbook.modified = new Date();

    const resumenSheet = workbook.addWorksheet("Resumen", {
      views: [{ showGridLines: false }],
    });

    resumenSheet.mergeCells("A1:H1");
    resumenSheet.getCell("A1").value = "RackNova - Reporte profesional";
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
    resumenSheet.getCell("A2").value = `Generado: ${formatDateTime(new Date())}`;
    resumenSheet.getCell("A2").font = {
      color: { argb: "FF64748B" },
    };
    resumenSheet.getCell("A2").alignment = {
      horizontal: "center",
    };

    const kpis = [
      ["Productos activos", summary.totalProductos],
      ["Piezas en inventario", summary.totalPiezas],
      ["Stock bajo", summary.stockBajo],
      ["Stock alto", summary.stockAlto],
      ["Próximos a caducar", summary.proximosCaducar],
      ["Vencidos", summary.vencidos],
      ["Valor de inventario", summary.valorInventario],
      ["Ganancia registrada", summary.ganancia],
    ];

    resumenSheet.addRow([]);
    resumenSheet.addRow(["Métrica", "Valor", "Métrica", "Valor"]);

    resumenSheet.getRow(4).eachCell(styleHeaderCell);

    for (let i = 0; i < kpis.length; i += 2) {
      const row = resumenSheet.addRow([
        kpis[i][0],
        kpis[i][1],
        kpis[i + 1]?.[0] ?? "",
        kpis[i + 1]?.[1] ?? "",
      ]);

      row.eachCell(styleBodyCell);

      row.getCell(2).numFmt =
        typeof kpis[i][1] === "number" && String(kpis[i][0]).includes("Valor")
          ? "$#,##0.00"
          : "0";

      row.getCell(4).numFmt =
        typeof kpis[i + 1]?.[1] === "number" &&
        String(kpis[i + 1]?.[0]).includes("Ganancia")
          ? "$#,##0.00"
          : "0";
    }

    resumenSheet.columns = [
      { width: 26 },
      { width: 18 },
      { width: 26 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
    ];

    const stockImage = createCanvasBarChart(
      "Distribución de stock",
      charts.stockChart,
      {
        subtitle: "Cantidad de productos por estado de inventario",
      }
    );

    const caducidadImage = createCanvasBarChart(
      "Estado de caducidades",
      charts.caducidadChart,
      {
        subtitle: "Productos vencidos, próximos a caducar y vigentes",
      }
    );

    const financialImage = createCanvasBarChart(
      "Resumen financiero",
      charts.financialChart,
      {
        subtitle: "Ingresos, costos y ganancia acumulada",
        valueFormatter: shortMoney,
      }
    );

    const topSoldImage = createCanvasHorizontalChart(
      "Productos más vendidos",
      charts.topSoldChart,
      {
        subtitle: "Piezas vendidas por producto",
      }
    );

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

    addExcelImage(resumenSheet, stockImage, {
      tl: { col: 0, row: 10 },
      ext: { width: 490, height: 250 },
    });

    addExcelImage(resumenSheet, caducidadImage, {
      tl: { col: 5, row: 10 },
      ext: { width: 490, height: 250 },
    });

    addExcelImage(resumenSheet, financialImage, {
      tl: { col: 0, row: 25 },
      ext: { width: 490, height: 250 },
    });

    addExcelImage(resumenSheet, topSoldImage, {
      tl: { col: 5, row: 25 },
      ext: { width: 490, height: 250 },
    });

    const productosSheet = workbook.addWorksheet("Productos", {
      views: [{ state: "frozen", ySplit: 6 }],
    });

    productosSheet.mergeCells("A1:M1");
    productosSheet.getCell("A1").value = "Productos en inventario";
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
      name: "TablaProductosRackNova",
      ref: "A6",
      headerRow: true,
      totalsRow: false,
      style: {
        theme: "TableStyleMedium2",
        showRowStripes: true,
      },
      columns: [
        { name: "Ubicación" },
        { name: "SKU" },
        { name: "Nombre" },
        { name: "Descripción" },
        { name: "Cantidad" },
        { name: "Costo proveedor" },
        { name: "Precio sugerido" },
        { name: "Caducidad" },
        { name: "Estado caducidad" },
        { name: "Stock mínimo" },
        { name: "Stock alto" },
        { name: "Estado stock" },
        { name: "Valor inventario" },
      ],
      rows: products.map((product) => [
        getLocationText(product.locationId),
        product.sku,
        product.nombre,
        product.descripcion ?? "",
        Number(product.cantidad ?? 0),
        Number(product.costo_proveedor ?? 0),
        Number(product.precio_venta_sugerido ?? 0),
        product.caducidad ?? "",
        getExpirationStatus(product.caducidad),
        Number(product.stock_minimo ?? 10),
        Number(product.stock_alto ?? 30),
        getStockStatus(product),
        Number(product.cantidad ?? 0) * Number(product.costo_proveedor ?? 0),
      ]),
    });

    productosSheet.columns = [
      { width: 28 },
      { width: 18 },
      { width: 28 },
      { width: 35 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 16 },
      { width: 24 },
      { width: 14 },
      { width: 14 },
      { width: 18 },
      { width: 18 },
    ];

    productosSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        styleBodyCell(cell);

        if (rowNumber === 6) {
          styleHeaderCell(cell);
        }
      });

      if (rowNumber > 6) {
        row.getCell(6).numFmt = "$#,##0.00";
        row.getCell(7).numFmt = "$#,##0.00";
        row.getCell(13).numFmt = "$#,##0.00";

        const estadoStock = String(row.getCell(12).value ?? "");
        const estadoCaducidad = String(row.getCell(9).value ?? "");

        if (estadoStock === "Stock bajo") {
          row.getCell(12).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEE2E2" },
          };
          row.getCell(12).font = {
            bold: true,
            color: { argb: "FF991B1B" },
          };
        }

        if (estadoStock === "Stock alto") {
          row.getCell(12).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDBEAFE" },
          };
          row.getCell(12).font = {
            bold: true,
            color: { argb: "FF1D4ED8" },
          };
        }

        if (estadoStock === "Stock normal") {
          row.getCell(12).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD1FAE5" },
          };
          row.getCell(12).font = {
            bold: true,
            color: { argb: "FF047857" },
          };
        }

        if (estadoCaducidad.includes("Vencido")) {
          row.getCell(9).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEE2E2" },
          };
          row.getCell(9).font = {
            bold: true,
            color: { argb: "FF991B1B" },
          };
        }

        if (
          estadoCaducidad.includes("Caduca") ||
          estadoCaducidad.includes("Vence")
        ) {
          row.getCell(9).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF3C7" },
          };
          row.getCell(9).font = {
            bold: true,
            color: { argb: "FF92400E" },
          };
        }
      }
    });

    const movimientosSheet = workbook.addWorksheet("Movimientos", {
      views: [{ state: "frozen", ySplit: 6 }],
    });

    movimientosSheet.mergeCells("A1:L1");
    movimientosSheet.getCell("A1").value = "Historial de movimientos";
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

    const movimientosOrdenados = [...movements].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    movimientosSheet.addTable({
      name: "TablaMovimientosRackNova",
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
      rows: movimientosOrdenados.map((movement) => [
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
      { width: 28 },
      { width: 12 },
      { width: 18 },
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

        if (rowNumber === 6) {
          styleHeaderCell(cell);
        }
      });

      if (rowNumber > 6) {
        row.getCell(8).numFmt = "$#,##0.00";
        row.getCell(9).numFmt = "$#,##0.00";
        row.getCell(10).numFmt = "$#,##0.00";
        row.getCell(11).numFmt = "$#,##0.00";
        row.getCell(12).numFmt = "$#,##0.00";

        const accion = String(row.getCell(2).value ?? "");

        if (accion === "Ingreso") {
          row.getCell(2).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD1FAE5" },
          };
          row.getCell(2).font = {
            bold: true,
            color: { argb: "FF047857" },
          };
        }

        if (accion === "Egreso") {
          row.getCell(2).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEE2E2" },
          };
          row.getCell(2).font = {
            bold: true,
            color: { argb: "FF991B1B" },
          };
        }

        if (accion === "Edición") {
          row.getCell(2).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDBEAFE" },
          };
          row.getCell(2).font = {
            bold: true,
            color: { argb: "FF1D4ED8" },
          };
        }
      }
    });

    const graficasSheet = workbook.addWorksheet("Gráficas", {
      views: [{ showGridLines: false }],
    });

    graficasSheet.mergeCells("A1:H1");
    graficasSheet.getCell("A1").value = "Gráficas RackNova";
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

    const stockBajoSheet = workbook.addWorksheet("Stock bajo");

    stockBajoSheet.addTable({
      name: "TablaStockBajoRackNova",
      ref: "A1",
      headerRow: true,
      totalsRow: false,
      style: {
        theme: "TableStyleMedium4",
        showRowStripes: true,
      },
      columns: [
        { name: "SKU" },
        { name: "Producto" },
        { name: "Cantidad" },
        { name: "Stock mínimo" },
        { name: "Stock alto" },
        { name: "Ubicación" },
      ],
      rows: products
        .filter((product) => getStockStatus(product) === "Stock bajo")
        .map((product) => [
          product.sku,
          product.nombre,
          product.cantidad,
          Number(product.stock_minimo ?? 10),
          Number(product.stock_alto ?? 30),
          getLocationText(product.locationId),
        ]),
    });

    stockBajoSheet.columns = [
      { width: 18 },
      { width: 30 },
      { width: 14 },
      { width: 16 },
      { width: 16 },
      { width: 30 },
    ];

    const caducidadesSheet = workbook.addWorksheet("Caducidades");

    caducidadesSheet.addTable({
      name: "TablaCaducidadesRackNova",
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
        { name: "Cantidad" },
        { name: "Caducidad" },
        { name: "Estado" },
        { name: "Ubicación" },
      ],
      rows: products
        .filter((product) => product.caducidad)
        .sort((a, b) => String(a.caducidad).localeCompare(String(b.caducidad)))
        .map((product) => [
          product.sku,
          product.nombre,
          product.cantidad,
          product.caducidad,
          getExpirationStatus(product.caducidad),
          getLocationText(product.locationId),
        ]),
    });

    caducidadesSheet.columns = [
      { width: 18 },
      { width: 30 },
      { width: 14 },
      { width: 18 },
      { width: 26 },
      { width: 30 },
    ];

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
  getReportFileName("racknova-reporte-profesional", "xlsx")
);
  };

  return {
    downloadPDF,
    downloadExcel,
  };
}
