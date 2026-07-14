import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import {
  Check,
  Copy,
  Download,
  FileDown,
  Package,
  QrCode,
  ScanBarcode,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatDateDDMMYYYY,
  formatDateTimeDDMMYYYY,
} from "@/lib/dateFormat";

interface QRConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  productData: {
    sku: string;
    nombre: string;
    rack: string;
    nivel: number;
    slot: number;
    timestamp: Date;

    descripcion?: string | null;
    cantidad?: number;
    costoProveedor?: number;
    precioVentaSugerido?: number;
    caducidad?: string | null;
  } | null;
}

type ViewMode = "qr" | "barcode";

const money = (value?: number | null) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

export function QRConfirmationModal({
  isOpen,
  onClose,
  productData,
}: QRConfirmationModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("qr");

  const barcodeRef = useRef<SVGSVGElement | null>(null);

  const ubicacionTexto = useMemo(() => {
    if (!productData) return "";

    return `Rack ${productData.rack} / Nivel ${productData.nivel} / Slot ${productData.slot}`;
  }, [productData]);

  const readableQRText = useMemo(() => {
    if (!productData) return "";

    const lines = [
      "RackNova - Producto",
      "",
      `SKU: ${productData.sku}`,
      `Producto: ${productData.nombre}`,
      productData.descripcion
        ? `Descripción: ${productData.descripcion}`
        : null,
      `Ubicación: ${ubicacionTexto}`,
      productData.cantidad !== undefined
        ? `Cantidad registrada: ${productData.cantidad}`
        : null,
      productData.costoProveedor !== undefined
        ? `Costo proveedor: ${money(productData.costoProveedor)}`
        : null,
      productData.precioVentaSugerido !== undefined
        ? `Precio sugerido: ${money(productData.precioVentaSugerido)}`
        : null,
      productData.caducidad
        ? `Caducidad: ${formatDateDDMMYYYY(productData.caducidad)}`
        : "Caducidad: No aplica",
      `Generado: ${formatDateTimeDDMMYYYY(productData.timestamp)}`,
    ];

    return lines.filter(Boolean).join("\n");
  }, [productData, ubicacionTexto]);

  useEffect(() => {
    const generateQRCode = async () => {
      if (!productData || !isOpen) return;

      try {
        const dataUrl = await QRCode.toDataURL(readableQRText, {
          width: 420,
          margin: 2,
          errorCorrectionLevel: "M",
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        });

        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error("Error generating QR code:", error);
        setQrDataUrl("");
      }
    };

    generateQRCode();
  }, [productData, isOpen, readableQRText]);

  useEffect(() => {
    if (!productData || !isOpen || !barcodeRef.current) return;

    try {
      JsBarcode(barcodeRef.current, productData.sku, {
        format: "CODE128",
        lineColor: "#0f172a",
        background: "#ffffff",
        width: 2,
        height: 78,
        displayValue: true,
        fontSize: 18,
        margin: 10,
      });
    } catch (error) {
      console.error("Error generating barcode:", error);
    }
  }, [productData, isOpen]);

  const copyQRText = async () => {
    try {
      await navigator.clipboard.writeText(readableQRText);
    } catch (error) {
      console.error("No se pudo copiar el texto del QR:", error);
    }
  };

  const downloadQR = () => {
    if (!qrDataUrl || !productData) return;

    const link = document.createElement("a");

    link.download = `QR_${sanitizeFileName(productData.sku)}_${sanitizeFileName(
      productData.nombre
    )}.png`;
    link.href = qrDataUrl;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadBarcode = () => {
    if (!barcodeRef.current || !productData) return;

    const svg = barcodeRef.current;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);

    const blob = new Blob([source], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.download = `BARCODE_${sanitizeFileName(productData.sku)}.svg`;
    link.href = url;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const downloadLabel = async () => {
    if (!productData || !qrDataUrl || !barcodeRef.current) return;

    try {
      const serializer = new XMLSerializer();
      const barcodeSvg = serializer.serializeToString(barcodeRef.current);
      const barcodeDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        barcodeSvg
      )}`;

      const [qrImage, barcodeImage] = await Promise.all([
        loadImage(qrDataUrl),
        loadImage(barcodeDataUrl),
      ]);

      const canvas = document.createElement("canvas");
      canvas.width = 1100;
      canvas.height = 680;

      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(20, 20, canvas.width - 40, 90);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 38px Arial";
      ctx.fillText("RackNova", 55, 75);

      ctx.font = "20px Arial";
      ctx.fillText("Etiqueta de identificación de producto", 300, 75);

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 30px Arial";
      ctx.fillText(productData.nombre, 55, 160);

      ctx.font = "bold 24px Arial";
      ctx.fillText(`SKU: ${productData.sku}`, 55, 205);

      ctx.font = "20px Arial";
      ctx.fillText(`Ubicación: ${ubicacionTexto}`, 55, 250);

      if (productData.cantidad !== undefined) {
        ctx.fillText(`Cantidad registrada: ${productData.cantidad}`, 55, 290);
      }

      if (productData.costoProveedor !== undefined) {
        ctx.fillText(
          `Costo proveedor: ${money(productData.costoProveedor)}`,
          55,
          330
        );
      }

      if (productData.precioVentaSugerido !== undefined) {
        ctx.fillText(
          `Precio sugerido: ${money(productData.precioVentaSugerido)}`,
          55,
          370
        );
      }

      ctx.fillText(
        `Caducidad: ${
          productData.caducidad
            ? formatDateDDMMYYYY(productData.caducidad)
            : "No aplica"
        }`,
        55,
        410
      );

      ctx.fillStyle = "#64748b";
      ctx.font = "18px Arial";
      ctx.fillText(
        `Generado: ${formatDateTimeDDMMYYYY(productData.timestamp)}`,
        55,
        455
      );

      ctx.drawImage(qrImage, 760, 135, 250, 250);

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 18px Arial";
      ctx.fillText("Código QR", 835, 410);

      ctx.drawImage(barcodeImage, 85, 505, 560, 120);

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 18px Arial";
      ctx.fillText("Código de barras SKU", 260, 650);

      const labelUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");

      link.download = `ETIQUETA_${sanitizeFileName(
        productData.sku
      )}_${sanitizeFileName(productData.nombre)}.png`;
      link.href = labelUrl;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error descargando etiqueta:", error);
    }
  };

  if (!productData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Producto agregado exitosamente
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold">Información del producto</h3>
                </div>

                <div className="grid gap-3 text-sm">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">SKU</p>
                    <p className="font-semibold">{productData.sku}</p>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Producto</p>
                    <p className="font-semibold">{productData.nombre}</p>
                  </div>

                  {productData.descripcion && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">
                        Descripción
                      </p>
                      <p className="font-semibold">{productData.descripcion}</p>
                    </div>
                  )}

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Ubicación</p>
                    <p className="font-semibold">{ubicacionTexto}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">
                        Caducidad
                      </p>
                      <p className="font-semibold">
                        {productData.caducidad
                          ? formatDateDDMMYYYY(productData.caducidad)
                          : "No aplica"}
                      </p>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">
                        Generado
                      </p>
                      <p className="font-semibold">
                        {formatDateTimeDDMMYYYY(productData.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">Contenido del QR</h3>

                <pre className="max-h-52 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
                  {readableQRText}
                </pre>

                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={copyQRText}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar datos del QR
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={viewMode === "qr" ? "default" : "outline"}
                  onClick={() => setViewMode("qr")}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  QR
                </Button>

                <Button
                  variant={viewMode === "barcode" ? "default" : "outline"}
                  onClick={() => setViewMode("barcode")}
                >
                  <ScanBarcode className="h-4 w-4 mr-2" />
                  Barras
                </Button>
              </div>

              <div className="rounded-xl border bg-white p-4 min-h-[320px] flex items-center justify-center">
                {viewMode === "qr" ? (
                  qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR ${productData.sku}`}
                      className="h-72 w-72 object-contain"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Generando QR...
                    </p>
                  )
                ) : (
                  <div className="w-full overflow-x-auto">
                    <svg ref={barcodeRef} className="mx-auto" />
                  </div>
                )}
              </div>

              <p className="text-center text-xs text-muted-foreground">
                El QR contiene datos en formato legible. El código de barras usa
                el SKU del producto.
              </p>

              <div className="grid gap-2">
                <Button
                  variant="outline"
                  onClick={viewMode === "qr" ? downloadQR : downloadBarcode}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar {viewMode === "qr" ? "QR" : "código de barras"}
                </Button>

                <Button onClick={downloadLabel}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Descargar etiqueta completa
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
