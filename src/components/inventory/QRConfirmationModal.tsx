import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Check, QrCode } from "lucide-react";
import QRCode from "qrcode";

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
  } | null;
}

export function QRConfirmationModal({
  isOpen,
  onClose,
  productData,
}: QRConfirmationModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (productData && isOpen) {
      generateQRCode();
    }
  }, [productData, isOpen]);

  const generateQRCode = async () => {
    if (!productData) return;

    const qrString =
      `SKU: ${productData.sku}\n` +
      `NOMBRE: ${productData.nombre}\n` +
      `UBICACIÓN: ${productData.rack}-${productData.nivel}-${productData.slot}\n` +
      `FECHA: ${productData.timestamp.toLocaleString("es-ES", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}`;

    try {
      const dataUrl = await QRCode.toDataURL(qrString, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const downloadQR = () => {
    if (!qrDataUrl || !productData) return;

    const link = document.createElement("a");
    link.download = `QR_${productData.sku}_${productData.nombre.replace(
      /\s+/g,
      "_"
    )}.png`;
    link.href = qrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!productData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Producto Agregado Exitosamente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 text-sm">
                <div>
                  <strong>SKU:</strong> {productData.sku}
                </div>
                <div>
                  <strong>Producto:</strong> {productData.nombre}
                </div>
                <div>
                  <strong>Ubicación:</strong> {productData.rack}-
                  {productData.nivel}-{productData.slot}
                </div>
                <div>
                  <strong>Fecha:</strong>{" "}
                  {productData.timestamp.toLocaleString("es-ES")}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QR Code */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-lg font-medium">
              <QrCode className="h-5 w-5" />
              Código QR Generado
            </div>
            {qrDataUrl && (
              <div className="flex justify-center">
                <img
                  src={qrDataUrl}
                  alt="Código QR del producto"
                  className="border rounded-lg shadow-sm"
                  style={{ width: "250px", height: "250px" }}
                />
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Imprime este código QR y pégalo en el producto o su empaque
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={downloadQR}
            disabled={!qrDataUrl}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Descargar QR
          </Button>
          <Button onClick={onClose}>Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
