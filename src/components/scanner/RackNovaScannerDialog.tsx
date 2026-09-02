import { useEffect, useRef, useState } from "react";
import {
  Html5QrcodeScanner,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import { Barcode, Camera, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createRackNovaScanResult,
  emitRackNovaScan,
  type RackNovaScanResult,
} from "@/lib/racknovaScan";

type RackNovaScannerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (result: RackNovaScanResult) => void;
  title?: string;
  description?: string;
};

const READER_ID = "racknova-camera-reader";

const FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
];

export function RackNovaScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = "Escanear código",
  description = "Apunta la cámara al código de barras o QR.",
}: RackNovaScannerDialogProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const callbackRef = useRef(onScan);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    callbackRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!open) return;

    setCameraError(null);
    let disposed = false;
    let timer = 0;

    const stop = async () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;
      try {
        await scanner.clear();
      } catch {
        // The library can already be stopped after a successful read.
      }
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "La cámara no está disponible en este navegador. En celular, abre RackNova mediante HTTPS para permitir el acceso a la cámara."
      );
      return;
    }

    timer = window.setTimeout(() => {
      if (disposed) return;
      try {
        const scanner = new Html5QrcodeScanner(
          READER_ID,
          {
            fps: 12,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.333333,
            formatsToSupport: FORMATS,
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
          },
          false
        );
        scannerRef.current = scanner;

        scanner.render(
          (decodedText) => {
            if (disposed) return;
            const result = createRackNovaScanResult(decodedText, "camera");
            if (!result.code) return;

            emitRackNovaScan(result);
            callbackRef.current(result);
            void stop();
            onOpenChange(false);
          },
          () => {
            // "Not found" frames are expected while the camera is moving.
          }
        );
      } catch (error) {
        setCameraError(
          error instanceof Error
            ? error.message
            : "No se pudo iniciar la cámara."
        );
      }
    }, 80);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      void stop();
    };
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden rounded-3xl border-border/70 p-0">
        <DialogHeader className="border-b border-border/60 px-6 pb-5 pt-6">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Camera className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-black tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-5">
          {cameraError ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
              {cameraError}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-black/5 p-2 dark:bg-white/5">
              <div id={READER_ID} className="min-h-[280px] overflow-hidden rounded-xl" />
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl bg-secondary/45 p-3.5">
              <Barcode className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-bold">Códigos compatibles</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  QR, Code128, Code39, EAN, UPC e ITF.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-secondary/45 p-3.5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-bold">Lectura local</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  La cámara solo entrega el código al flujo activo de RackNova.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
