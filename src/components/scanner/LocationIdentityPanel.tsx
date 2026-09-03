import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import {
  Barcode,
  Download,
  Loader2,
  MapPin,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  crearUbicacionScan,
  listarUbicacionesScan,
  type RackNovaLocationIdentity,
} from "@/lib/scanControl";

type Props = {
  canManage: boolean;
};

const safeFile = (value: string) =>
  value.trim().replace(/[^\w-]+/g, "_").replace(/_+/g, "_").slice(0, 70);

export function LocationIdentityPanel({ canManage }: Props) {
  const [items, setItems] = useState<RackNovaLocationIdentity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rack, setRack] = useState("");
  const [nivel, setNivel] = useState("");
  const [posicion, setPosicion] = useState("");
  const [qrData, setQrData] = useState("");
  const [barcodeData, setBarcodeData] = useState("");

  const selected = useMemo(
    () => items.find((item) => item.id_ubicacion === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listarUbicacionesScan();
      setItems(rows);
      setSelectedId((current) =>
        current && rows.some((row) => row.id_ubicacion === current)
          ? current
          : rows[0]?.id_ubicacion ?? null
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudieron cargar las ubicaciones."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selected) {
      setQrData("");
      setBarcodeData("");
      return;
    }

    let cancelled = false;
    const generate = async () => {
      try {
        const qr = await QRCode.toDataURL(selected.codigo_ubicacion, {
          width: 420,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, selected.codigo_ubicacion, {
          format: "CODE128",
          width: 2,
          height: 82,
          displayValue: true,
          fontSize: 16,
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
  }, [selected]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    if (nombre.trim().length < 2) {
      toast.error("Escribe un nombre para la ubicación.");
      return;
    }
    setSaving(true);
    try {
      const created = await crearUbicacionScan({
        nombre: nombre.trim(),
        rack: rack.trim() || null,
        nivel: nivel.trim() || null,
        posicion: posicion.trim() || null,
      });
      setItems((current) => [...current, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setSelectedId(created.id_ubicacion);
      setNombre("");
      setRack("");
      setNivel("");
      setPosicion("");
      toast.success("Ubicación creada. Su código físico ya es estable.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la ubicación.");
    } finally {
      setSaving(false);
    }
  };

  const download = (src: string, prefix: string) => {
    if (!src || !selected) return;
    const link = document.createElement("a");
    link.href = src;
    link.download = `${prefix}_${safeFile(selected.nombre)}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const printLabel = () => {
    if (!selected || !qrData || !barcodeData) return;
    const popup = window.open("", "_blank", "width=760,height=700");
    if (!popup) {
      toast.error("Permite ventanas emergentes para imprimir la etiqueta.");
      return;
    }
    const detail = [selected.rack && `Rack ${selected.rack}`, selected.nivel && `Nivel ${selected.nivel}`, selected.posicion && `Posición ${selected.posicion}`]
      .filter(Boolean)
      .join(" · ");
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${selected.nombre}</title><style>@page{margin:8mm}body{font-family:Arial,sans-serif;color:#0f172a;margin:0}.label{border:2px solid #cbd5e1;border-radius:18px;padding:24px;max-width:680px}.brand{font-size:24px;font-weight:900;color:#1d4ed8}.name{font-size:30px;font-weight:900;margin-top:14px}.detail{font-size:16px;color:#475569;margin-top:6px}.codes{display:grid;grid-template-columns:220px 1fr;gap:24px;align-items:center;margin-top:22px}.qr{width:210px;height:210px}.barcode{max-width:100%;max-height:150px}.code{font-family:monospace;font-size:12px;color:#64748b;word-break:break-all;margin-top:12px}@media print{button{display:none}}</style></head><body><div class="label"><div class="brand">RackNova</div><div class="name">${selected.nombre}</div><div class="detail">${detail || "Ubicación física"}</div><div class="codes"><img class="qr" src="${qrData}"/><div><img class="barcode" src="${barcodeData}"/><div class="code">${selected.codigo_ubicacion}</div></div></div></div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`);
    popup.document.close();
  };

  return (
    <section className="rn-pos-surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black">Identidad de ubicaciones</h3>
              <Badge variant="secondary" className="rounded-full">Fase 3</Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
              Cada rack o posición recibe un código RNLOC permanente. El nombre visible puede cambiar sin tener que reemplazar la identidad física.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <form onSubmit={create} className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
            <div>
              <p className="text-sm font-black">Nueva ubicación</p>
              <p className="mt-1 text-xs text-muted-foreground">Ejemplo: Rack A · Nivel 2 · Posición 3.</p>
            </div>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre visible: Bebidas A3" disabled={!canManage} />
            <div className="grid grid-cols-3 gap-2">
              <Input value={rack} onChange={(e) => setRack(e.target.value)} placeholder="Rack" disabled={!canManage} />
              <Input value={nivel} onChange={(e) => setNivel(e.target.value)} placeholder="Nivel" disabled={!canManage} />
              <Input value={posicion} onChange={(e) => setPosicion(e.target.value)} placeholder="Posición" disabled={!canManage} />
            </div>
            <Button type="submit" className="w-full" disabled={!canManage || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Crear identidad
            </Button>
          </form>

          <div className="max-h-[390px] space-y-2 overflow-y-auto rounded-2xl border border-border/60 bg-background/70 p-2">
            {items.map((item) => (
              <button
                key={item.id_ubicacion}
                type="button"
                onClick={() => setSelectedId(item.id_ubicacion)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${selected?.id_ubicacion === item.id_ubicacion ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-secondary/50"}`}
              >
                <p className="truncate text-sm font-black">{item.nombre}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {[item.rack && `Rack ${item.rack}`, item.nivel && `Nivel ${item.nivel}`, item.posicion && `Pos. ${item.posicion}`].filter(Boolean).join(" · ") || "Ubicación física"}
                </p>
              </button>
            ))}
            {!loading && items.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Todavía no hay ubicaciones identificadas.</div>
            )}
          </div>
        </div>

        <div className="min-h-[430px] rounded-3xl border border-border/60 bg-gradient-to-br from-background to-secondary/25 p-5">
          {selected ? (
            <div className="mx-auto max-w-2xl">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Etiqueta RackNova</p>
                <h4 className="mt-2 text-2xl font-black">{selected.nombre}</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[selected.rack && `Rack ${selected.rack}`, selected.nivel && `Nivel ${selected.nivel}`, selected.posicion && `Posición ${selected.posicion}`].filter(Boolean).join(" · ") || "Ubicación física"}
                </p>
              </div>

              <div className="mt-6 grid items-center gap-5 rounded-3xl border border-border/70 bg-white p-5 shadow-sm sm:grid-cols-[220px_1fr] dark:bg-slate-950">
                <div className="flex justify-center">
                  {qrData ? <img src={qrData} alt={`QR ${selected.nombre}`} className="h-52 w-52 rounded-xl" /> : <QrCode className="h-20 w-20 text-muted-foreground/30" />}
                </div>
                <div>
                  {barcodeData ? <img src={barcodeData} alt={`Code128 ${selected.nombre}`} className="max-h-36 w-full object-contain" /> : <Barcode className="h-16 w-16 text-muted-foreground/30" />}
                  <p className="mt-3 break-all rounded-xl bg-secondary/55 p-3 font-mono text-[11px] text-muted-foreground">{selected.codigo_ubicacion}</p>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    QR para celular y Code128 para pistolas 1D. Ambos representan exactamente la misma ubicación.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" onClick={() => download(qrData, "QR_UBICACION")} disabled={!qrData}>
                  <Download className="mr-2 h-4 w-4" />QR
                </Button>
                <Button type="button" variant="outline" onClick={() => download(barcodeData, "CODE128_UBICACION")} disabled={!barcodeData}>
                  <Download className="mr-2 h-4 w-4" />Code128
                </Button>
                <Button type="button" onClick={printLabel} disabled={!qrData || !barcodeData}>
                  <Printer className="mr-2 h-4 w-4" />Imprimir etiqueta
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[390px] flex-col items-center justify-center text-center text-muted-foreground">
              <MapPin className="mb-3 h-12 w-12 opacity-25" />
              <p className="font-bold text-foreground">Crea tu primera ubicación</p>
              <p className="mt-1 max-w-sm text-sm">RackNova generará automáticamente su identidad física QR + Code128.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
