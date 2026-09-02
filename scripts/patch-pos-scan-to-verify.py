from pathlib import Path

path = Path('src/pages/PuntoVenta.tsx')
text = path.read_text(encoding='utf-8')

if 'RACKNOVA_POS_SCAN_TO_VERIFY_V1' in text:
    print('Scan-to-Verify already applied')
    raise SystemExit(0)

text = text.replace(
    '  Camera,\n  Boxes,',
    '  Camera,\n  CheckCircle2,\n  CircleAlert,\n  Boxes,',
    1,
)

old_cart_type = '''type CartItem = POSProducto & {\n  cantidadVenta: number;\n  cantidadInput: string;\n  descuentoPorcentaje: number;\n  descuentoInput: string;\n};'''
new_cart_type = '''type CartVerificationStatus = "pending" | "verified";\n\ntype CartItem = POSProducto & {\n  cantidadVenta: number;\n  cantidadInput: string;\n  descuentoPorcentaje: number;\n  descuentoInput: string;\n  verificationStatus: CartVerificationStatus;\n  verifiedCode: string | null;\n  verifiedAt: number | null;\n  verifiedSource: RackNovaScanResult["source"] | null;\n};'''
if old_cart_type not in text:
    raise SystemExit('CartItem marker not found')
text = text.replace(old_cart_type, new_cart_type, 1)

marker = '// RACKNOVA_POS_SIMPLE_PRO_V5_1'
helpers = '''// RACKNOVA_POS_SCAN_TO_VERIFY_V1\nconst normalizeProductIdentifier = (value?: string | null) =>\n  String(value ?? "").trim().toLowerCase();\n\nconst productMatchesScan = (product: POSProducto, code: string) => {\n  const normalizedCode = normalizeProductIdentifier(code);\n  if (!normalizedCode) return false;\n\n  return [product.codigo_barras, product.sku]\n    .map(normalizeProductIdentifier)\n    .filter(Boolean)\n    .includes(normalizedCode);\n};\n\n'''
if marker not in text:
    raise SystemExit('POS marker not found')
text = text.replace(marker, helpers + marker, 1)

start = text.index('  const addProduct = (product: POSProducto) => {')
end = text.index('  const updateQuantity = (sku: string, direction: -1 | 1) => {', start)
new_scan_block = r'''  const addProduct = (
    product: POSProducto,
    options?: { verified?: boolean; scan?: RackNovaScanResult | null }
  ) => {
    if (!sesion) {
      toast.error("Abre una caja antes de vender.");
      return;
    }

    const available = cantidadDisponibleVenta(product);
    const step = pasoVenta(product);
    const verified = Boolean(options?.verified);
    const scan = options?.scan ?? null;

    if (available <= 0) {
      toast.error(`${product.nombre} no tiene existencias.`);
      return;
    }
    if (product.precio_venta_sugerido <= 0) {
      toast.error(`${product.nombre} no tiene precio de venta configurado.`);
      return;
    }

    setCart((current) => {
      const existing = current.find((row) => row.sku === product.sku);

      if (existing) {
        const next = roundQuantity(existing.cantidadVenta + step);
        if (next > available + 0.000001) {
          toast.error(
            `Stock disponible: ${mostrarCantidad(available)} ${unidadVenta(product)}.`
          );
          return current;
        }
        return current.map((row) =>
          row.sku === product.sku
            ? {
                ...row,
                cantidadVenta: next,
                cantidadInput: String(next),
                verificationStatus:
                  verified || row.verificationStatus === "verified"
                    ? "verified"
                    : "pending",
                verifiedCode: verified
                  ? scan?.code ?? product.codigo_barras ?? product.sku
                  : row.verifiedCode,
                verifiedAt: verified ? scan?.scannedAt ?? Date.now() : row.verifiedAt,
                verifiedSource: verified ? scan?.source ?? null : row.verifiedSource,
              }
            : row
        );
      }

      const initial = roundQuantity(Math.min(1, available));
      return [
        ...current,
        {
          ...product,
          cantidadVenta: Math.max(initial, step),
          cantidadInput: String(Math.max(initial, step)),
          descuentoPorcentaje: 0,
          descuentoInput: "",
          verificationStatus: verified ? "verified" : "pending",
          verifiedCode: verified
            ? scan?.code ?? product.codigo_barras ?? product.sku
            : null,
          verifiedAt: verified ? scan?.scannedAt ?? Date.now() : null,
          verifiedSource: verified ? scan?.source ?? null : null,
        },
      ];
    });

    setQuery("");
    setResults([]);
    window.setTimeout(() => searchRef.current?.focus(), 50);
  };

  const verifyPendingProduct = (
    product: POSProducto,
    scan: RackNovaScanResult
  ) => {
    const pending = cart.filter(
      (item) => item.verificationStatus !== "verified"
    );

    if (pending.length === 0) return false;

    const target = pending.find((item) => item.sku === product.sku);
    if (!target) {
      const expected = pending[0];
      toast.error(
        `Producto incorrecto. Debes verificar ${expected.nombre} antes de continuar.`
      );
      return true;
    }

    setCart((current) =>
      current.map((item) =>
        item.sku === target.sku
          ? {
              ...item,
              verificationStatus: "verified",
              verifiedCode: scan.code,
              verifiedAt: scan.scannedAt,
              verifiedSource: scan.source,
            }
          : item
      )
    );
    setQuery("");
    setResults([]);
    toast.success(`${target.nombre} verificado correctamente.`);
    window.setTimeout(() => searchRef.current?.focus(), 50);
    return true;
  };

  const searchByValue = async (
    rawValue: string,
    source: RackNovaScanResult["source"] = "manual",
    scan?: RackNovaScanResult
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

      const exact = products.find((product) => productMatchesScan(product, value));

      if (source !== "manual") {
        if (!exact || !scan) {
          setResults([]);
          toast.error(
            "El código escaneado no coincide exactamente con el código de barras o SKU de un producto."
          );
          return;
        }

        if (verifyPendingProduct(exact, scan)) {
          return;
        }

        addProduct(exact, { verified: true, scan });
        toast.success(`${exact.nombre} agregado y verificado.`);
        return;
      }

      if (exact || products.length === 1) {
        addProduct(exact || products[0]);
        toast.message(
          `Escanea ${exact?.nombre || products[0].nombre} para verificar el producto físico.`
        );
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
    void searchByValue(result.code, result.source, result);
  };

  useRackNovaScanner({
    enabled:
      Boolean(sesion?.estado === "ABIERTA") &&
      workspacePanel === "sale" &&
      !cameraScannerOpen,
    onScan: handleRackNovaScan,
  });

'''
text = text[:start] + new_scan_block + text[end:]

change_marker = '  const change = useMemo(() => {'
verification_memo = '''  const pendingVerificationCount = useMemo(\n    () => cart.filter((item) => item.verificationStatus !== "verified").length,\n    [cart]\n  );\n  const verifiedProductCount = cart.length - pendingVerificationCount;\n\n'''
if change_marker not in text:
    raise SystemExit('change memo marker not found')
text = text.replace(change_marker, verification_memo + change_marker, 1)

checkout_marker = '''    if (cart.length === 0) {\n      toast.error("Agrega al menos un producto.");\n      return;\n    }'''
checkout_verification = checkout_marker + '''\n    if (pendingVerificationCount > 0) {\n      toast.error(\n        `Falta verificar ${pendingVerificationCount} producto(s). Escanea cada artículo antes de cobrar.`\n      );\n      return;\n    }'''
if checkout_marker not in text:
    raise SystemExit('checkout marker not found')
text = text.replace(checkout_marker, checkout_verification, 1)

sku_marker = '<p className="truncate text-[11px] text-muted-foreground">{item.sku}</p></div><Button'
verification_badge = '''<p className="truncate text-[11px] text-muted-foreground">{item.sku}</p>{item.verificationStatus === "verified" ? <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Verificado</span> : <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300"><ScanLine className="h-3.5 w-3.5" />Pendiente de escaneo</span>}</div><Button'''
if sku_marker not in text:
    raise SystemExit('cart sku marker not found')
text = text.replace(sku_marker, verification_badge, 1)

payment_marker = '<div className="mt-4 grid grid-cols-4 gap-1.5 rounded-2xl bg-background/70 p-1.5 ring-1 ring-border/60">'
verification_panel = '''{cart.length > 0 && <div className={`mt-3 rounded-2xl border p-3 ${pendingVerificationCount > 0 ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>{pendingVerificationCount > 0 ? <div className="flex items-start gap-2"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><div><p className="text-xs font-black text-amber-800 dark:text-amber-200">Verificación física pendiente</p><p className="mt-0.5 text-[11px] leading-4 text-amber-700/90 dark:text-amber-300">{pendingVerificationCount} producto(s) pendiente(s). Escanea el código de cada artículo para habilitar el cobro.</p></div></div> : <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><div><p className="text-xs font-black">Venta verificada</p><p className="text-[11px]">{verifiedProductCount} producto(s) confirmado(s) físicamente.</p></div></div>}</div>}\n              ''' + payment_marker
if payment_marker not in text:
    raise SystemExit('payment marker not found')
text = text.replace(payment_marker, verification_panel, 1)

old_button = '''<Button className="mt-4 h-14 w-full rounded-2xl text-base font-black shadow-lg shadow-primary/20" disabled={selling || quoting || !quote || Boolean(cartQuantityError) || cart.length === 0} onClick={checkout}>{selling ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : metodoPago === "efectivo" ? <Banknote className="mr-2 h-5 w-5" /> : <CreditCard className="mr-2 h-5 w-5" />}{quoting ? "Calculando..." : `Cobrar · ${money(totals.total)}`}</Button>'''
new_button = '''<Button className="mt-4 h-14 w-full rounded-2xl text-base font-black shadow-lg shadow-primary/20" disabled={selling || quoting || !quote || Boolean(cartQuantityError) || cart.length === 0 || pendingVerificationCount > 0} onClick={checkout}>{selling ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : pendingVerificationCount > 0 ? <ScanLine className="mr-2 h-5 w-5" /> : metodoPago === "efectivo" ? <Banknote className="mr-2 h-5 w-5" /> : <CreditCard className="mr-2 h-5 w-5" />}{quoting ? "Calculando..." : pendingVerificationCount > 0 ? `Verifica ${pendingVerificationCount} producto(s)` : `Cobrar · ${money(totals.total)}`}</Button>'''
if old_button not in text:
    raise SystemExit('checkout button marker not found')
text = text.replace(old_button, new_button, 1)

path.write_text(text, encoding='utf-8')
print('Applied RackNova POS Scan-to-Verify V1')
