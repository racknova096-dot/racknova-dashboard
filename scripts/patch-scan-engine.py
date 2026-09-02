from pathlib import Path

path = Path("src/pages/PuntoVenta.tsx")
text = path.read_text(encoding="utf-8")

# Imports.
if "  Camera,\n" not in text:
    text = text.replace("  Barcode,\n  Boxes,", "  Barcode,\n  Camera,\n  Boxes,", 1)

if 'import { RackNovaScannerDialog } from "@/components/scanner/RackNovaScannerDialog";' not in text:
    text = text.replace(
        'import { Badge } from "@/components/ui/badge";\n',
        'import { Badge } from "@/components/ui/badge";\nimport { RackNovaScannerDialog } from "@/components/scanner/RackNovaScannerDialog";\n',
        1,
    )

if 'import { useRackNovaScanner } from "@/hooks/useRackNovaScanner";' not in text:
    text = text.replace(
        'import { Input } from "@/components/ui/input";\n',
        'import { Input } from "@/components/ui/input";\nimport { useRackNovaScanner } from "@/hooks/useRackNovaScanner";\n',
        1,
    )

if 'import type { RackNovaScanResult } from "@/lib/racknovaScan";' not in text:
    text = text.replace(
        'import POSFase3Panel from "@/components/pos/POSFase3Panel";\n',
        'import POSFase3Panel from "@/components/pos/POSFase3Panel";\nimport type { RackNovaScanResult } from "@/lib/racknovaScan";\n',
        1,
    )

# Scanner state.
state_marker = '  const [workspacePanel, setWorkspacePanel] = useState<POSWorkspacePanel>("sale");\n'
state_add = '''  const [workspacePanel, setWorkspacePanel] = useState<POSWorkspacePanel>("sale");
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [lastScanSource, setLastScanSource] = useState<RackNovaScanResult["source"] | null>(null);
'''
if "cameraScannerOpen" not in text:
    if state_marker not in text:
        raise SystemExit("workspace state marker not found")
    text = text.replace(state_marker, state_add, 1)

# Replace the old single-purpose search with a reusable scan/search path.
old_search = '''  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (!sesion) {
      toast.error("Abre una caja antes de buscar productos.");
      return;
    }
    setSearching(true);
    try {
      const products = await buscarProductosPOS(value);
      if (products.length === 0) {
        setResults([]);
        toast.error("Producto no encontrado.");
        return;
      }
      const exact = products.find(
        (product) =>
          product.sku.toLowerCase() === value.toLowerCase() ||
          product.codigo_barras === value
      );
      if (exact || products.length === 1) {
        addProduct(exact || products[0]);
      } else {
        setResults(products);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo buscar el producto."
      );
    } finally {
      setSearching(false);
    }
  };
'''
new_search = '''  const searchByValue = async (
    rawValue: string,
    source: RackNovaScanResult["source"] = "manual"
  ) => {
    const value = rawValue.trim();
    if (!value) return;
    if (!sesion) {
      toast.error("Abre una caja antes de buscar productos.");
      return;
    }

    if (source !== "manual") {
      setLastScanSource(source);
    }
    setQuery(value);
    setSearching(true);
    try {
      const products = await buscarProductosPOS(value);
      if (products.length === 0) {
        setResults([]);
        toast.error(
          source === "manual"
            ? "Producto no encontrado."
            : `El código ${value} no corresponde a un producto registrado.`
        );
        return;
      }
      const exact = products.find(
        (product) =>
          product.sku.toLowerCase() === value.toLowerCase() ||
          product.codigo_barras === value
      );
      if (exact || products.length === 1) {
        addProduct(exact || products[0]);
      } else {
        setResults(products);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo buscar el producto."
      );
    } finally {
      setSearching(false);
    }
  };

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    await searchByValue(query, "manual");
  };

  const handleRackNovaScan = (result: RackNovaScanResult) => {
    if (result.kind === "location") {
      toast.error(
        "Escaneaste una ubicación de RackNova. En Venta se espera el código de un producto."
      );
      return;
    }
    if (result.kind !== "product") {
      toast.error("No se pudo reconocer el código escaneado.");
      return;
    }
    void searchByValue(result.code, result.source);
  };

  useRackNovaScanner({
    enabled:
      Boolean(sesion?.estado === "ABIERTA") &&
      workspacePanel === "sale" &&
      !cameraScannerOpen,
    onScan: handleRackNovaScan,
  });
'''
if "const searchByValue = async" not in text:
    if old_search not in text:
        raise SystemExit("search block not found")
    text = text.replace(old_search, new_search, 1)

# Premium search controls: marked input for HID scanner + camera button.
old_form = '''              <form onSubmit={search} className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input ref={searchRef} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar productos..." autoComplete="off" className="h-14 rounded-2xl border-border/70 bg-background pl-12 pr-16 text-base shadow-none" />
                <Button type="submit" size="icon" disabled={searching} className="absolute right-1.5 top-1/2 h-11 w-11 -translate-y-1/2 rounded-xl" aria-label="Buscar o escanear">{searching ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanLine className="h-5 w-5" />}</Button>
              </form>
'''
new_form = '''              <form onSubmit={search} className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  autoFocus
                  data-racknova-scan-input="true"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar o escanear producto..."
                  autoComplete="off"
                  className="h-14 rounded-2xl border-border/70 bg-background pl-12 pr-28 text-base shadow-none"
                />
                <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-1.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-11 w-11 rounded-xl bg-background"
                    onClick={() => setCameraScannerOpen(true)}
                    aria-label="Escanear con cámara"
                    title="Escanear con cámara"
                  >
                    <Camera className="h-5 w-5" />
                  </Button>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={searching}
                    className="h-11 w-11 rounded-xl"
                    aria-label="Buscar producto"
                  >
                    {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                  </Button>
                </div>
              </form>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
                  <ScanLine className="h-3.5 w-3.5" /> Pistola USB / Bluetooth lista
                </span>
                <span>
                  {lastScanSource === "camera"
                    ? "Última lectura: cámara"
                    : lastScanSource === "hardware"
                      ? "Última lectura: pistola"
                      : "Puedes escanear aunque el buscador no tenga el foco"}
                </span>
              </div>
'''
if 'data-racknova-scan-input="true"' not in text:
    if old_form not in text:
        raise SystemExit("premium search form not found")
    text = text.replace(old_form, new_form, 1)

# Camera scanner lives at the page level so it can be reused by future POS verification.
scanner_marker = '      {ticket && <div className="fixed inset-0 z-[80]'
scanner_component = '''      <RackNovaScannerDialog
        open={cameraScannerOpen}
        onOpenChange={setCameraScannerOpen}
        onScan={handleRackNovaScan}
        title="Escanear producto"
        description="Usa la cámara para leer el código de barras o QR del producto."
      />

      {ticket && <div className="fixed inset-0 z-[80]'''
if "<RackNovaScannerDialog" not in text:
    if scanner_marker not in text:
        raise SystemExit("ticket marker not found")
    text = text.replace(scanner_marker, scanner_component, 1)

path.write_text(text, encoding="utf-8")

# Keep the third-party camera UI visually consistent with RackNova.
css = Path("src/index.css")
css_text = css.read_text(encoding="utf-8")
marker = "/* RACKNOVA_SCAN_ENGINE_V1 */"
if marker not in css_text:
    css_text += r'''

/* RACKNOVA_SCAN_ENGINE_V1 */
#racknova-camera-reader {
  border: 0 !important;
  color: hsl(var(--foreground));
}
#racknova-camera-reader > div:first-child {
  border: 0 !important;
}
#racknova-camera-reader video {
  border-radius: 14px;
  object-fit: cover;
}
#racknova-camera-reader button,
#racknova-camera-reader select {
  min-height: 40px;
  border-radius: 12px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 8px 12px;
  font-weight: 700;
}
#racknova-camera-reader a {
  color: hsl(var(--primary));
  font-weight: 700;
}
'''
    css.write_text(css_text, encoding="utf-8")
