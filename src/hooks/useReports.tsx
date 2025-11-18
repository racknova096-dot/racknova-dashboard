import { useInventory } from '@/context/InventoryContext';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function useReports() {
  const { 
    locations, 
    getTotalProducts, 
    getLowStockProducts, 
    getProductByLocation 
  } = useInventory();
  const { toast } = useToast();

  const generateReportData = () => {
    // Get all products with their locations
    const allProducts = locations
      .map(location => {
        const product = getProductByLocation(location.id);
        return product ? {
          sku: product.sku,
          nombre: product.nombre,
          cantidad: product.cantidad,
          rack: location.rack,
          nivel: location.nivel,
          slot: location.slot,
          ubicacion: `${location.rack}-${location.nivel}-${location.slot}`,
          estado: product.cantidad <= 10 ? 'Stock Bajo' : 'Normal'
        } : null;
      })
      .filter(Boolean);

    const totalSlots = locations.length;
    const occupiedSlots = allProducts.length;
    const freeSlots = totalSlots - occupiedSlots;
    const lowStockProducts = getLowStockProducts();

    return {
      products: allProducts,
      summary: {
        totalProducts: getTotalProducts(),
        occupiedSlots,
        freeSlots,
        totalSlots,
        lowStockCount: lowStockProducts.length
      },
      lowStockProducts,
      reportDate: new Date().toLocaleString('es-ES')
    };
  };

  const downloadPDF = () => {
    try {
      const data = generateReportData();
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.text('Sistema de Inventario', 14, 22);
      doc.setFontSize(16);
      doc.text('Reporte de Inventario', 14, 32);
      
      // Date
      doc.setFontSize(10);
      doc.text(`Fecha del reporte: ${data.reportDate}`, 14, 42);

      // Summary section
      doc.setFontSize(12);
      doc.text('Resumen General', 14, 55);
      
      const summaryData = [
        ['Total de productos', data.summary.totalProducts.toString()],
        ['Slots ocupados', data.summary.occupiedSlots.toString()],
        ['Slots libres', data.summary.freeSlots.toString()],
        ['Total de slots', data.summary.totalSlots.toString()],
        ['Productos con stock bajo', data.summary.lowStockCount.toString()]
      ];

      autoTable(doc, {
        startY: 60,
        head: [['Métrica', 'Valor']],
        body: summaryData,
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [66, 139, 202] }
      });

      // Products table
      if (data.products.length > 0) {
        doc.addPage();
        doc.setFontSize(12);
        doc.text('Lista de Productos', 14, 22);

        const productsData = data.products.map(product => [
          product?.sku || '',
          product?.nombre || '',
          product?.cantidad?.toString() || '',
          product?.ubicacion || '',
          product?.estado || ''
        ]);

        autoTable(doc, {
          startY: 30,
          head: [['SKU', 'Nombre', 'Cantidad', 'Ubicación', 'Estado']],
          body: productsData,
          theme: 'grid',
          styles: { fontSize: 9 },
          headStyles: { fillColor: [66, 139, 202] },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 60 },
            2: { cellWidth: 25 },
            3: { cellWidth: 30 },
            4: { cellWidth: 30 }
          }
        });
      }

      // Low stock section
      if (data.lowStockProducts.length > 0) {
        doc.addPage();
        doc.setFontSize(12);
        doc.text('Productos con Stock Bajo (≤ 10)', 14, 22);

        const lowStockData = data.lowStockProducts.map(product => [
          product.sku,
          product.nombre,
          product.cantidad.toString()
        ]);

        autoTable(doc, {
          startY: 30,
          head: [['SKU', 'Nombre', 'Cantidad']],
          body: lowStockData,
          theme: 'grid',
          styles: { fontSize: 10 },
          headStyles: { fillColor: [220, 53, 69] }
        });
      }

      doc.save(`reporte-inventario-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "Reporte generado",
        description: "El reporte PDF se ha descargado exitosamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al generar el reporte PDF",
        variant: "destructive",
      });
    }
  };

  const downloadExcel = () => {
    try {
      const data = generateReportData();
      
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['Reporte de Inventario'],
        [`Fecha: ${data.reportDate}`],
        [''],
        ['Métrica', 'Valor'],
        ['Total de productos', data.summary.totalProducts],
        ['Slots ocupados', data.summary.occupiedSlots],
        ['Slots libres', data.summary.freeSlots],
        ['Total de slots', data.summary.totalSlots],
        ['Productos con stock bajo', data.summary.lowStockCount]
      ];

      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWS, 'Resumen');

      // Products sheet
      if (data.products.length > 0) {
        const productsData = [
          ['SKU', 'Nombre', 'Cantidad', 'Rack', 'Nivel', 'Slot', 'Ubicación', 'Estado'],
          ...data.products.map(product => [
            product?.sku || '',
            product?.nombre || '',
            product?.cantidad || '',
            product?.rack || '',
            product?.nivel || '',
            product?.slot || '',
            product?.ubicacion || '',
            product?.estado || ''
          ])
        ];

        const productsWS = XLSX.utils.aoa_to_sheet(productsData);
        XLSX.utils.book_append_sheet(wb, productsWS, 'Productos');
      }

      // Low stock sheet
      if (data.lowStockProducts.length > 0) {
        const lowStockData = [
          ['SKU', 'Nombre', 'Cantidad'],
          ...data.lowStockProducts.map(product => [
            product.sku,
            product.nombre,
            product.cantidad
          ])
        ];

        const lowStockWS = XLSX.utils.aoa_to_sheet(lowStockData);
        XLSX.utils.book_append_sheet(wb, lowStockWS, 'Stock Bajo');
      }

      XLSX.writeFile(wb, `reporte-inventario-${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast({
        title: "Reporte generado",
        description: "El reporte Excel se ha descargado exitosamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al generar el reporte Excel",
        variant: "destructive",
      });
    }
  };

  return {
    downloadPDF,
    downloadExcel,
    generateReportData
  };
}