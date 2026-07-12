import { useInventory } from "@/context/InventoryContext";
import { Product } from "@/types/inventory";
import { MovementRecord } from "@/types/movement";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));

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

const getExpirationStatus = (caducidad?: string | null) => {
  if (!caducidad) return "Sin caducidad";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(`${caducidad.slice(0, 10)}T00:00:00`);
  expiration.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

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
  const today = new Date();

  const stamp = today
    .toISOString()
    .slice(0, 10);

  return `${base}-${stamp}.${extension}`;
};

export function useReports() {
  const { products, locations, movements } = useInventory();

  const getSummary = () => {
    const totalProductos = products.length;
    const totalPiezas = products.reduce(
      (total, product) => total + Number(product.cantidad || 0),
      0
    );

    const stockBajo = products.filter((product) => {
      const minimo = Number(product.stock_minimo ?? 10);
      return product.cantidad <= minimo;
    }).length;

    const stockAlto = products.filter((product) => {
      const minimo = Number(product.stock_minimo ?? 10);
      const alto = Number(product.stock_alto ?? minimo * 3);
      return product.cantidad >= alto;
    }).length;

    const vencidos = products.filter((product) => {
      if (!product.caducidad) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const expiration = new Date(`${product.caducidad.slice(0, 10)}T00:00:00`);
      expiration.setHours(0, 0, 0, 0);

      return expiration < today;
    }).length;

    const proximosCaducar = products.filter((product) => {
      if (!product.caducidad) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const expiration = new Date(`${product.caducidad.slice(0, 10)}T00:00:00`);
      expiration.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil(
        (expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return diffDays >= 0 && diffDays <= 30;
    }).length;

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
      stockAlto,
      vencidos,
      proximosCaducar,
      valorInventario,
      ingresos,
      costos,
      ganancia,
      slotsOcupados,
      slotsTotales,
    };
  };

  const downloadPDF = () => {
    const summary = getSummary();

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("RackNova", 14, 18);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Reporte general de inventario", 14, 26);

    doc.setFontSize(9);
    doc.text(`Generado: ${formatDateTime(new Date())}`, 14, 33);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Resumen general", 14, 45);

    autoTable(doc, {
      startY: 50,
      head: [["Métrica", "Valor", "Métrica", "Valor"]],
      body: [
        [
          "Productos activos",
          summary.totalProductos,
          "Piezas en inventario",
          summary.totalPiezas,
        ],
        [
          "Stock bajo",
          summary.stockBajo,
          "Stock alto",
          summary.stockAlto,
        ],
        [
          "Próximos a caducar",
          summary.proximosCaducar,
          "Vencidos",
          summary.vencidos,
        ],
        [
          "Slots ocupados",
          `${summary.slotsOcupados} / ${summary.slotsTotales}`,
          "Valor de inventario",
          money(summary.valorInventario),
        ],
        [
          "Ingresos por ventas",
          money(summary.ingresos),
          "Ganancia registrada",
          money(summary.ganancia),
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

    const productosOrdenados = [...products].sort((a, b) =>
      a.locationId.localeCompare(b.locationId)
    );

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
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
        cellPadding: 1.8,
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      didDrawPage: () => {
        const pageNumber = doc.getNumberOfPages();

        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `RackNova · Reporte de inventario · Página ${pageNumber}`,
          pageWidth - 85,
          doc.internal.pageSize.getHeight() - 8
        );
      },
    });

    const movimientosRecientes = [...movements]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 25);

    if (movimientosRecientes.length > 0) {
      doc.addPage();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Movimientos recientes", 14, 18);

      autoTable(doc, {
        startY: 25,
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

    doc.save(getReportFileName("racknova-reporte-inventario", "pdf"));
  };

  const downloadExcel = () => {
    const summary = getSummary();

    const workbook = XLSX.utils.book_new();

    const resumenData = [
      ["Reporte", "RackNova - Inventario"],
      ["Fecha de generación", formatDateTime(new Date())],
      [],
      ["Métrica", "Valor"],
      ["Productos activos", summary.totalProductos],
      ["Piezas en inventario", summary.totalPiezas],
      ["Stock bajo", summary.stockBajo],
      ["Stock alto", summary.stockAlto],
      ["Próximos a caducar", summary.proximosCaducar],
      ["Vencidos", summary.vencidos],
      ["Slots ocupados", summary.slotsOcupados],
      ["Slots totales", summary.slotsTotales],
      ["Valor de inventario", summary.valorInventario],
      ["Ingresos por ventas", summary.ingresos],
      ["Costos por ventas", summary.costos],
      ["Ganancia registrada", summary.ganancia],
    ];

    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(workbook, resumenSheet, "Resumen");

    const productosData = products.map((product) => ({
      Ubicación: getLocationText(product.locationId),
      SKU: product.sku,
      Nombre: product.nombre,
      Descripción: product.descripcion ?? "",
      Cantidad: product.cantidad,
      "Costo proveedor": Number(product.costo_proveedor ?? 0),
      "Precio sugerido": Number(product.precio_venta_sugerido ?? 0),
      Caducidad: product.caducidad ?? "",
      "Estado caducidad": getExpirationStatus(product.caducidad),
      "Stock mínimo": Number(product.stock_minimo ?? 10),
      "Stock alto": Number(product.stock_alto ?? 30),
      "Estado stock": getStockStatus(product),
      "Valor inventario":
        Number(product.cantidad ?? 0) * Number(product.costo_proveedor ?? 0),
    }));

    const productosSheet = XLSX.utils.json_to_sheet(productosData);
    XLSX.utils.book_append_sheet(workbook, productosSheet, "Productos");

    const movimientosData = movements
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .map((movement) => ({
        Fecha: formatDateTime(movement.timestamp),
        Acción: movement.action,
        SKU: movement.productSku,
        Producto: movement.productName,
        Cantidad: movement.quantity,
        Ubicación: movement.location,
        Usuario: movement.user,
        "Costo proveedor": Number(movement.costo_proveedor ?? 0),
        "Precio venta": Number(movement.precio_venta ?? 0),
        "Ingreso total": Number(movement.ingreso_total ?? 0),
        "Costo total": Number(movement.costo_total ?? 0),
        Ganancia: Number(movement.ganancia ?? 0),
      }));

    const movimientosSheet = XLSX.utils.json_to_sheet(movimientosData);
    XLSX.utils.book_append_sheet(workbook, movimientosSheet, "Movimientos");

    const stockBajoData = products
      .filter((product) => {
        const minimo = Number(product.stock_minimo ?? 10);
        return product.cantidad <= minimo;
      })
      .map((product) => ({
        SKU: product.sku,
        Producto: product.nombre,
        Cantidad: product.cantidad,
        "Stock mínimo": Number(product.stock_minimo ?? 10),
        "Stock alto": Number(product.stock_alto ?? 30),
        Ubicación: getLocationText(product.locationId),
      }));

    const stockBajoSheet = XLSX.utils.json_to_sheet(stockBajoData);
    XLSX.utils.book_append_sheet(workbook, stockBajoSheet, "Stock bajo");

    const caducidadesData = products
      .filter((product) => product.caducidad)
      .sort((a, b) =>
        String(a.caducidad).localeCompare(String(b.caducidad))
      )
      .map((product) => ({
        SKU: product.sku,
        Producto: product.nombre,
        Cantidad: product.cantidad,
        Caducidad: product.caducidad,
        Estado: getExpirationStatus(product.caducidad),
        Ubicación: getLocationText(product.locationId),
      }));

    const caducidadesSheet = XLSX.utils.json_to_sheet(caducidadesData);
    XLSX.utils.book_append_sheet(workbook, caducidadesSheet, "Caducidades");

    XLSX.writeFile(
      workbook,
      getReportFileName("racknova-reporte-inventario", "xlsx")
    );
  };

  return {
    downloadPDF,
    downloadExcel,
  };
}
