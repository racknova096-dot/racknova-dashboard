import { useEffect, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { Barcode, Download, MapPin, Printer, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RackNovaLocationIdentity } from "@/lib/scanControl";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: RackNovaLocationIdentity | null;
  productName?: string | null;
};

const safeFile = (value: string) =>
  value
    .trim()
    .replace(/[^\w-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 70);

export function LocationLabelModal({
  open,
  onOpenChange,
  location,
  productName,
}: Props) {
  const [qrData, setQrData] = useState("");
  const [barcodeData, setBarcodeData] = useState("");

  useEffect(() => {
    if (!open || !location) {
      setQrData("");
      setBarcodeData("");
      return;
    }

    let cancelled = false;

    const generate = async () => {
      try {
        const qr = await QRCode.toDataURL(location.codigo_ubicacion, {
          width: 440,
          margin: 2,
          errorCorrectionLevel: "M",
        });

        const canvas = document.createElement("canvas");
        JsBarcode(canvas, location.codigo_ubicacion, {
          format: "CODE128",
          width: 2,
          height: 86,
          displayValue: true,
          fontSize: 15,
          margin: 12,
        });

        if (!cancelled) {
          setQrData(qr);
          setBarcodeData(canvas.toDataURL("image/png"));
        }
      } catch {
        if (!cancelled) {
          setQrData("");
          setBarcodeData("");
        }
      }
    };

    void generate();
    return () => {
      cancelled = true;
    };
  }, [location, open]);

  const download = (src: string, prefix: string) => {
    if (!src || !location) return;
    const link = document.createElement("a");
    link.href = src;
    link.download = `${prefix}_${safeFile(location.codigo_ubicacion)}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const print = () => {
    if (!location || !qrData || !barcodeData) return;
    const popup = window.open("", "_blank", "width=760,height=700");
    if (!popup) return;

    popup.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Ubicación RackNova</title>
<style>
@page{margin:7mm}
body{font-family:Arial,sans-serif;color:#0f172a;margin:0}
.label{max-width:680px;border:2px solid #cbd5e1;border-radius:18px;padding:24px}
.brand{font-size:24px;font-weight:900;color:#1d4ed8}
.title{font-size:28px;font-weight:900;margin-top:10px}
.subtitle{font-size:14px;color:#64748b;margin-top:4px}
.codes{display:grid;grid-template-columns:220px 1fr;gap:24px;align-items:center;margin-top:20px}
.qr{width:210px;height:210px}.barcode{max-width:100%;max-height:150px}
.code{font-family:monospace;font-size:11px;color:#64748b;word-break:break-all;margin-top:10px}
.note{font-size:12px;color:#64748b;margin-top:18px;border-top:1px solid #e2e8f0;padding-top:12px}
</style>
</head>
<body>
<div class="label">
  <div class="brand">RackNova</div>
  <div class="title">Punto de ubicación</div>
  <div class="subtitle">Etiqueta física universal</div>
  <div class="codes">
    <img class="qr" src="${qrData}" />
    <div>
      <img class="barcode" src="${barcodeData}" />
      <div class="code">${location.codigo_ubicacion}</div>
    </div>
  </div>
  <div class="note">Esta etiqueta identifica este lugar físico. No pertenece al rack ni al producto; RackNova administra la relación.</div>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script>
</body>
</html>`);
    popup.document.close();
  };

  if (!location) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden rounded-3xl">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
            <MapPin className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-black">
            Elige dónde guardarás el producto
          </DialogTitle>
          <DialogDescription className="text-sm leading-6">
            {productName ? (
              <>
                Coloca <strong>{productName}</strong> donde quieras y pega esta
                etiqueta exactamente en ese lugar. RackNova recordará esa ubicación
                para las próximas entradas.
              </>
            ) : (
              "Pega esta etiqueta en el lugar físico que quieras identificar."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 rounded-3xl border border-border/70 bg-secondary/20 p-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
          <div className="flex justify-center rounded-2xl bg-white p-2">
            {qrData ? (
              <img src={qrData} alt="QR de ubicación" className="h-52 w-52" />
            ) : (
              <QrCode className="h-20 w-20 text-muted-foreground/25" />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600">
              Ubicación libre RackNova
            </p>
            <p className="mt-2 text-lg font-black">{location.nombre}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Puede ir en un anaquel, refrigerador, cajón, tarima, pared, piso,
              contenedor o rack. Tú defines físicamente el lugar.
            </p>

            <div className="mt-4 rounded-2xl bg-white p-3 dark:bg-slate-950">
              {barcodeData ? (
                <img
                  src={barcodeData}
                  alt="Code128 de ubicación"
                  className="max-h-32 w-full object-contain"
                />
              ) : (
                <Barcode className="mx-auto h-14 w-14 text-muted-foreground/25" />
              )}
              <p className="mt-2 break-all text-center font-mono text-[10px] text-muted-foreground">
                {location.codigo_ubicacion}
              </p>
            </div>
          </div>
        </div>

        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-900 dark:text-emerald-100">
          La etiqueta representa <strong>el lugar</strong>, no el producto. Si algún día
          reubicas el artículo, RackNova podrá asociarlo a otro punto sin perder la
          trazabilidad anterior.
        </p>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => download(qrData, "QR_UBICACION")}
              disabled={!qrData}
            >
              <Download className="mr-2 h-4 w-4" />
              QR
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => download(barcodeData, "CODE128_UBICACION")}
              disabled={!barcodeData}
            >
              <Download className="mr-2 h-4 w-4" />
              Code128
            </Button>
          </div>
          <Button type="button" onClick={print} disabled={!qrData || !barcodeData}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir etiqueta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
