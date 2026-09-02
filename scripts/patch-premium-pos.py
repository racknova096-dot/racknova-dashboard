from pathlib import Path

# POS product type: image slots ready for the next catalog update.
path = Path('src/lib/pos.ts')
text = path.read_text(encoding='utf-8')
marker = '  codigo_barras?: string | null;\n'
image_fields = (
    '  imagen_url?: string | null;\n'
    '  image_url?: string | null;\n'
    '  foto_url?: string | null;\n'
    '  imagen?: string | null;\n'
)
if '  imagen_url?: string | null;' not in text:
    if marker not in text:
        raise SystemExit('POSProducto marker not found')
    text = text.replace(marker, marker + image_fields, 1)
    path.write_text(text, encoding='utf-8')

# Shared premium primitives.
path = Path('src/components/ui/card.tsx')
text = path.read_text(encoding='utf-8')
text = text.replace(
    'rounded-lg border bg-card text-card-foreground shadow-sm',
    'rounded-2xl border border-border/70 bg-card text-card-foreground shadow-[0_1px_2px_hsl(222_47%_11%/0.04),0_14px_36px_hsl(222_47%_11%/0.035)]',
    1,
)
path.write_text(text, encoding='utf-8')

path = Path('src/components/ui/input.tsx')
text = path.read_text(encoding='utf-8')
text = text.replace(
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
    'flex h-11 w-full rounded-xl border border-input/90 bg-card/90 px-3.5 py-2 text-base shadow-sm ring-offset-background transition-[border-color,box-shadow,background-color] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
    1,
)
path.write_text(text, encoding='utf-8')

path = Path('src/components/ui/button.tsx')
text = path.read_text(encoding='utf-8')
text = text.replace(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    1,
)
text = text.replace('default: "bg-primary text-primary-foreground hover:bg-primary/90",', 'default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md",')
text = text.replace('outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",', 'outline: "border border-input/80 bg-card/90 shadow-sm hover:border-primary/25 hover:bg-secondary/70 hover:text-foreground",')
text = text.replace('sm: "h-9 rounded-md px-3",', 'sm: "h-9 rounded-xl px-3",')
text = text.replace('lg: "h-11 rounded-md px-8",', 'lg: "h-11 rounded-xl px-8",')
path.write_text(text, encoding='utf-8')

# Navigation: restrained RackNova blue instead of competing active gradients.
path = Path('src/components/layout/Navigation.tsx')
text = path.read_text(encoding='utf-8')
text = text.replace(
    'sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl',
    'sticky top-0 z-50 border-b border-border/60 bg-background/95 shadow-[0_1px_0_hsl(222_47%_11%/0.025)] backdrop-blur-2xl',
)
text = text.replace(
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary shadow-lg transition-transform group-hover:scale-105',
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 shadow-lg shadow-slate-950/15 transition-transform group-hover:scale-[1.03] dark:bg-white',
)
text = text.replace('<Package className="h-6 w-6 text-white" />', '<Package className="h-6 w-6 text-white dark:text-slate-950" />')
old_active = '''active
            ? `bg-gradient-to-r ${item.color} text-white shadow-md hover:opacity-95`
            : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"'''
new_active = '''active
            ? "bg-primary text-primary-foreground shadow-md shadow-primary/15 hover:bg-primary/90"
            : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"'''
text = text.replace(old_active, new_active, 1)
path.write_text(text, encoding='utf-8')

# POS imports and image helper.
path = Path('src/pages/PuntoVenta.tsx')
text = path.read_text(encoding='utf-8')
if '  ImageIcon,\n' not in text:
    text = text.replace('  History,\n', '  History,\n  ImageIcon,\n', 1)
if '  ScanLine,\n' not in text:
    text = text.replace('  Search,\n', '  Search,\n  ScanLine,\n', 1)
if '  Sparkles,\n' not in text:
    text = text.replace('  ShoppingCart,\n', '  ShoppingCart,\n  Sparkles,\n', 1)
helper_marker = 'const formatDate = (value?: string | null) => {\n'
helper = '''const productImageUrl = (product: POSProducto) =>
  product.imagen_url ||
  product.image_url ||
  product.foto_url ||
  product.imagen ||
  null;

'''
if 'const productImageUrl' not in text:
    if helper_marker not in text:
        raise SystemExit('formatDate marker not found')
    text = text.replace(helper_marker, helper + helper_marker, 1)

# Replace only the active-session render. All existing business logic remains above it.
start_marker = '  return (\n    <main className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">'
start = text.rfind(start_marker)
if start < 0:
    raise SystemExit('active POS return marker not found')

new_tail = r'''  return (
    <main className="racknova-pos-premium mx-auto max-w-[1680px] space-y-4 p-3 md:p-5">
      <section className="rn-pos-topbar flex flex-col gap-4 p-4 md:p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Store className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-[-0.03em] md:text-3xl">Punto de Venta</h1>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">Caja abierta</span>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{sesion.caja_nombre} · Sesión #{sesion.id_sesion} · {sesion.usuario}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-border/70 bg-secondary/45 p-1.5">
            <Button type="button" size="sm" variant={workspacePanel === "sale" ? "default" : "ghost"} onClick={() => { setWorkspacePanel("sale"); window.setTimeout(() => searchRef.current?.focus(), 50); }}><ShoppingCart className="mr-1 h-4 w-4" />Venta</Button>
            <Button type="button" size="sm" variant={workspacePanel === "cash" ? "default" : "ghost"} onClick={() => setWorkspacePanel("cash")}><CircleDollarSign className="mr-1 h-4 w-4" />Caja</Button>
            <Button type="button" size="sm" variant={workspacePanel === "history" ? "default" : "ghost"} onClick={() => setWorkspacePanel("history")}><History className="mr-1 h-4 w-4" />Historial</Button>
            <Button type="button" size="sm" variant={workspacePanel === "tools" ? "default" : "ghost"} onClick={() => setWorkspacePanel("tools")}><Boxes className="mr-1 h-4 w-4" />Herramientas</Button>
          </div>
          <Button type="button" size="icon" variant="outline" onClick={() => void refreshPOS()} aria-label="Actualizar POS"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </section>

      {workspacePanel === "sale" && (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
          <div className="min-w-0 space-y-4">
            <div className="rn-pos-surface p-4 md:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-primary"><Sparkles className="h-4 w-4" />Venta rápida</div>
                  <h2 className="mt-1 text-xl font-black tracking-tight md:text-2xl">Encuentra un producto</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Escanea el código o busca por nombre, SKU o código de barras.</p>
                </div>
                <div className="flex gap-2 text-[11px] font-semibold text-muted-foreground"><span className="rounded-full border bg-background/70 px-2.5 py-1">Código</span><span className="rounded-full border bg-background/70 px-2.5 py-1">SKU</span><span className="rounded-full border bg-background/70 px-2.5 py-1">Nombre</span></div>
              </div>
              <form onSubmit={search} className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input ref={searchRef} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar productos..." autoComplete="off" className="h-14 rounded-2xl border-border/70 bg-background pl-12 pr-16 text-base shadow-none" />
                <Button type="submit" size="icon" disabled={searching} className="absolute right-1.5 top-1/2 h-11 w-11 -translate-y-1/2 rounded-xl" aria-label="Buscar o escanear">{searching ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanLine className="h-5 w-5" />}</Button>
              </form>
            </div>

            <div className="rn-pos-surface min-h-[510px] p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-bold">Catálogo</p><p className="text-xs text-muted-foreground">{results.length > 0 ? `${results.length} coincidencia(s)` : "Los resultados aparecerán aquí"}</p></div>{results.length > 0 && <Badge variant="secondary" className="rounded-full px-3">Selecciona para agregar</Badge>}</div>
              {results.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {results.map((product) => {
                    const imageUrl = productImageUrl(product);
                    return (
                      <button key={product.id_producto} type="button" onClick={() => addProduct(product)} className="rn-pos-product-card group text-left">
                        <div className="rn-pos-product-media">
                          {imageUrl ? <img src={imageUrl} alt={product.nombre} className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.035]" /> : <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground/65"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-background/80 shadow-sm"><ImageIcon className="h-6 w-6" /></div><span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Imagen del producto</span></div>}
                          <span className="absolute right-2.5 top-2.5 rounded-full border border-white/80 bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-950/90 dark:text-slate-300">{mostrarCantidad(cantidadDisponibleVenta(product))} {unidadVenta(product)}</span>
                        </div>
                        <div className="p-3.5"><p className="line-clamp-2 min-h-10 text-sm font-bold leading-5">{product.nombre}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{product.sku} · {product.ubicacion}</p><div className="mt-3 flex items-end justify-between gap-2"><strong className="text-lg font-black tracking-tight">{money(product.precio_venta_sugerido)}</strong><span className="text-[10px] font-semibold text-muted-foreground">/{unidadVenta(product)}</span></div></div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-secondary/20 px-6 text-center"><div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary/10 text-primary ring-1 ring-primary/10"><ImageIcon className="h-9 w-9" /></div><h3 className="text-lg font-black">Catálogo visual preparado</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Busca un producto para mostrarlo aquí. El espacio de imagen ya está listo para la próxima actualización de fotografías.</p></div>
              )}
            </div>
          </div>

          <aside className="rn-pos-sale-panel overflow-hidden xl:sticky xl:top-20">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Venta actual</p><h2 className="mt-1 text-xl font-black">{cart.length} producto(s)</h2></div><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShoppingCart className="h-5 w-5" /></div></div>
            <div className="max-h-[430px] min-h-[250px] overflow-y-auto px-4 py-3">
              {cart.length === 0 ? <div className="flex min-h-[230px] flex-col items-center justify-center px-5 text-center text-muted-foreground"><ShoppingCart className="mb-3 h-9 w-9 opacity-30" /><p className="font-semibold text-foreground">Tu venta está vacía</p><p className="mt-1 text-xs leading-5">Selecciona un producto del catálogo para comenzar.</p></div> : (
                <div className="space-y-2.5">{cart.map((item) => { const quoteItem = quote?.items.find((row) => row.sku === item.sku); const finalUnit = quoteItem?.final_unit ?? item.precio_venta_sugerido * (1 - item.descuentoPorcentaje / 100); const imageUrl = productImageUrl(item); return (
                  <div key={item.sku} className="rn-pos-cart-item"><div className="flex gap-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-secondary/40">{imageUrl ? <img src={imageUrl} alt={item.nombre} className="h-full w-full object-contain p-1.5" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground/50"><ImageIcon className="h-5 w-5" /></div>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.nombre}</p><p className="truncate text-[11px] text-muted-foreground">{item.sku}</p></div><Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setCart((current) => current.filter((row) => row.sku !== item.sku))}><Trash2 className="h-4 w-4" /></Button></div><div className="mt-2 flex items-center justify-between gap-2"><div className="inline-flex items-center rounded-xl border border-border/70 bg-background p-0.5"><Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => updateQuantity(item.sku, -1)}><Minus className="h-3.5 w-3.5" /></Button><Input className="h-7 w-14 border-0 bg-transparent px-1 text-center text-xs font-black shadow-none focus-visible:ring-0" type="number" min={pasoVenta(item)} max={cantidadDisponibleVenta(item)} step={pasoVenta(item)} value={item.cantidadInput} onChange={(event) => setProductQuantityInput(item.sku, event.target.value)} /><Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => updateQuantity(item.sku, 1)}><Plus className="h-3.5 w-3.5" /></Button></div><strong className="text-sm font-black">{money(round2(finalUnit * item.cantidadVenta))}</strong></div><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] text-muted-foreground">{money(finalUnit)} / {unidadVenta(item)}</span><label className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">Desc.<Input type="number" min="0" max={isAdmin ? 100 : 10} step="0.01" value={item.descuentoInput} onChange={(event) => setDiscountInput(item.sku, event.target.value)} className="h-7 w-14 rounded-lg px-1.5 text-center text-[11px] shadow-none" placeholder="0" />%</label></div>{quoteItem?.promotion_name && <p className="mt-2 rounded-lg bg-emerald-500/10 px-2 py-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{quoteItem.promotion_name} · -{money(quoteItem.automatic_discount)}</p>}</div></div></div>
                ); })}</div>
              )}
            </div>
            <div className="border-t border-border/60 bg-secondary/20 p-4">
              <div className="space-y-2 text-sm"><div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>{(totals.automaticDiscount + totals.manualDiscount) > 0 && <div className="flex justify-between text-emerald-700 dark:text-emerald-300"><span>Descuentos</span><span>-{money(totals.automaticDiscount + totals.manualDiscount)}</span></div>}<div className="flex items-end justify-between border-t border-border/60 pt-3"><span className="font-bold">Total</span><strong className="text-3xl font-black tracking-[-0.04em]">{money(totals.total)}</strong></div>{quoteError && <p className="rounded-xl bg-destructive/10 p-2 text-xs text-destructive">{quoteError}</p>}</div>
              <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-2xl bg-background/70 p-1.5 ring-1 ring-border/60">{(["efectivo", "tarjeta", "transferencia", "mixto"] as MetodoPago[]).map((method) => <button key={method} type="button" onClick={() => setMetodoPago(method)} className={`rounded-xl px-1.5 py-2 text-[10px] font-bold capitalize transition ${metodoPago === method ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary"}`}>{method === "transferencia" ? "Transfer." : method}</button>)}</div>
              {metodoPago === "mixto" && <div className="mt-3 grid grid-cols-3 gap-2"><Input type="number" min="0" step="0.01" placeholder="Efectivo" value={montoEfectivoMixto} onChange={(event) => setMontoEfectivoMixto(event.target.value)} className="h-9 text-xs" /><Input type="number" min="0" step="0.01" placeholder="Tarjeta" value={montoTarjetaMixto} onChange={(event) => setMontoTarjetaMixto(event.target.value)} className="h-9 text-xs" /><Input type="number" min="0" step="0.01" placeholder="Transfer." value={montoTransferenciaMixto} onChange={(event) => setMontoTransferenciaMixto(event.target.value)} className="h-9 text-xs" /></div>}
              {(metodoPago === "tarjeta" || metodoPago === "transferencia" || metodoPago === "mixto") && <Input className="mt-3 h-9" placeholder="Referencia opcional" value={referencia} onChange={(event) => setReferencia(event.target.value)} />}
              {(metodoPago === "efectivo" || metodoPago === "mixto") && <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3"><div><label className="text-[11px] font-bold text-muted-foreground">Efectivo recibido</label><Input type="number" min="0" step="0.01" value={efectivoRecibido} onChange={(event) => setEfectivoRecibido(event.target.value)} placeholder="0.00" className="mt-1 h-10" /></div><div className="pb-1 text-right"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Cambio</p><p className="text-lg font-black">{money(change)}</p></div></div>}
              <Button className="mt-4 h-14 w-full rounded-2xl text-base font-black shadow-lg shadow-primary/20" disabled={selling || quoting || !quote || Boolean(cartQuantityError) || cart.length === 0} onClick={checkout}>{selling ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : metodoPago === "efectivo" ? <Banknote className="mr-2 h-5 w-5" /> : <CreditCard className="mr-2 h-5 w-5" />}{quoting ? "Calculando..." : `Cobrar · ${money(totals.total)}`}</Button>
            </div>
          </aside>
        </section>
      )}

      {workspacePanel === "cash" && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card><CardContent className="p-4"><p className="text-xs font-semibold text-muted-foreground">Fondo inicial</p><p className="mt-1 text-2xl font-black">{money(sesion.fondo_inicial)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs font-semibold text-muted-foreground">Ventas del turno</p><p className="mt-1 text-2xl font-black">{money(sesion.total_ventas)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs font-semibold text-muted-foreground">Efectivo esperado</p><p className="mt-1 text-2xl font-black">{money(sesion.efectivo_esperado)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs font-semibold text-muted-foreground">Operaciones</p><p className="mt-1 text-2xl font-black">{sesion.ventas_completadas}</p></CardContent></Card></div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><CircleDollarSign className="h-5 w-5 text-primary" />Movimiento de efectivo</CardTitle></CardHeader><CardContent className="space-y-3"><select className="h-11 w-full rounded-xl border border-input/90 bg-card px-3" value={cashType} onChange={(event) => setCashType(event.target.value)}><option value="ENTRADA">Entrada</option><option value="RETIRO">Retiro</option><option value="GASTO">Gasto</option><option value="DEPOSITO">Depósito / entrega</option>{isAdmin && <option value="AJUSTE_ENTRADA">Ajuste de entrada</option>}{isAdmin && <option value="AJUSTE_SALIDA">Ajuste de salida</option>}</select><Input type="number" min="0" step="0.01" placeholder="Monto" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} /><Input placeholder="Motivo obligatorio" value={cashReason} onChange={(event) => setCashReason(event.target.value)} /><Button className="w-full" variant="outline" disabled={cashSaving} onClick={saveCashMovement}>{cashSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar movimiento</Button></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><LockKeyhole className="h-5 w-5 text-primary" />Cierre de caja</CardTitle></CardHeader><CardContent className="space-y-3"><Input type="number" min="0" step="0.01" placeholder="Efectivo contado" value={cashCounted} onChange={(event) => setCashCounted(event.target.value)} /><Input placeholder="Observaciones del cierre" value={closeNotes} onChange={(event) => setCloseNotes(event.target.value)} /><div className="rounded-2xl bg-secondary/50 p-4 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Efectivo esperado</span><strong>{money(sesion.efectivo_esperado)}</strong></div></div><Button className="w-full" variant="outline" disabled={closingCash} onClick={closeCash}>{closingCash && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cerrar caja</Button></CardContent></Card>
          </div>
          {renderCurrentSessionActivity()}
          {renderTeamBoxes()}
          <Card><CardHeader><CardTitle className="text-xl">Movimientos de efectivo del turno</CardTitle></CardHeader><CardContent>{sesion.movimientos_efectivo.length === 0 ? <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No hay movimientos manuales.</p> : <div className="divide-y divide-border/60">{sesion.movimientos_efectivo.map((movement) => <div key={movement.id_movimiento} className="flex items-center justify-between gap-4 py-3"><div><p className="font-bold">{movement.tipo}</p><p className="text-xs text-muted-foreground">{movement.motivo} · {formatDate(movement.fecha)}</p></div><strong>{money(movement.monto)}</strong></div>)}</div>}</CardContent></Card>
        </section>
      )}

      {workspacePanel === "history" && (
        <section className="space-y-4">
          <Card><CardHeader className="border-b border-border/60"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><CardTitle className="flex items-center gap-2 text-xl"><History className="h-5 w-5 text-primary" />Historial de ventas</CardTitle><p className="mt-1 text-sm text-muted-foreground">Consulta tickets, cancela ventas autorizadas o registra devoluciones.</p></div><Button variant="outline" size="sm" onClick={() => void loadSales()} disabled={loadingSales}>{loadingSales && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button></div></CardHeader><CardContent className="space-y-4 pt-5"><div className="relative max-w-xl"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" value={salesSearch} onChange={(event) => setSalesSearch(event.target.value)} placeholder="Buscar por folio, cajero, cliente o estado" /></div><div className="overflow-x-auto rounded-2xl border border-border/60"><table className="w-full min-w-[900px] text-sm"><thead className="bg-secondary/45 text-left text-xs text-muted-foreground"><tr><th className="p-3">Folio</th><th className="p-3">Fecha</th><th className="p-3">Cajero</th><th className="p-3">Cliente</th><th className="p-3">Estado</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-border/60">{filteredSales.map((sale) => <tr key={sale.id_venta} className="transition hover:bg-secondary/25"><td className="p-3 font-bold">{sale.folio}</td><td className="p-3">{formatDate(sale.fecha)}</td><td className="p-3">{sale.usuario}</td><td className="p-3">{sale.cliente_nombre || "Público general"}</td><td className="p-3"><Badge variant={sale.estado === "COMPLETADA" ? "default" : "destructive"}>{sale.estado}</Badge></td><td className="p-3 text-right font-black">{money(sale.total)}</td><td className="p-3"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => void openSale(sale.id_venta)}>Ver</Button>{isAdmin && sale.estado === "COMPLETADA" && <Button size="sm" variant="outline" onClick={() => void beginReturn(sale)}><RotateCcw className="mr-1 h-4 w-4" />Devolver</Button>}{isAdmin && sale.estado === "COMPLETADA" && <Button size="sm" variant="destructive" onClick={() => void cancelSale(sale)}><XCircle className="mr-1 h-4 w-4" />Cancelar</Button>}</div></td></tr>)}</tbody></table></div>{filteredSales.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">No se encontraron ventas.</div>}</CardContent></Card>
        </section>
      )}

      {workspacePanel === "tools" && <section className="space-y-4"><div className="rn-pos-surface flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-bold text-primary">Administración comercial</p><h2 className="mt-1 text-2xl font-black">Herramientas</h2><p className="mt-1 text-sm text-muted-foreground">Clientes, crédito, promociones, mayoreo, precios y reportes fuera del flujo principal de cobro.</p></div>{isAdmin && <Button variant="outline" onClick={togglePOS}>Desactivar POS</Button>}</div><POSFase3Panel /></section>}

      {ticket && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setTicket(null); }}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/10 bg-background shadow-2xl"><div className="flex items-start justify-between border-b border-border/60 p-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">Ticket de venta</p><h2 className="mt-1 text-2xl font-black">{ticket.folio}</h2><p className="text-sm text-muted-foreground">{formatDate(ticket.fecha)} · {ticket.usuario}</p></div><Button size="icon" variant="ghost" onClick={() => setTicket(null)}><XCircle className="h-5 w-5" /></Button></div><div className="space-y-4 p-5"><div className="divide-y divide-border/60 rounded-2xl border border-border/60">{ticket.items.map((item) => <div key={item.id_detalle} className="flex items-center justify-between gap-4 p-3.5"><div><p className="font-bold">{item.nombre}</p><p className="text-xs text-muted-foreground">{mostrarCantidad(item.cantidad)} {unidadVenta(item)} · {item.sku}</p></div><strong>{money(item.subtotal)}</strong></div>)}</div><div className="rounded-2xl bg-secondary/45 p-4"><div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span>{money(ticket.subtotal)}</span></div><div className="mt-2 flex justify-between text-sm text-muted-foreground"><span>Descuentos</span><span>-{money(ticket.descuento_total)}</span></div><div className="mt-3 flex justify-between border-t border-border/60 pt-3 text-xl"><span className="font-bold">Total</span><strong>{money(ticket.total)}</strong></div></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setTicket(null)}>Cerrar</Button><Button onClick={() => printTicket(ticket)}><Printer className="mr-2 h-4 w-4" />Imprimir ticket</Button></div></div></div></div>}

      {returnSale && <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-background shadow-2xl"><div className="flex items-start justify-between border-b border-border/60 p-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-600">Registrar devolución</p><h2 className="mt-1 text-2xl font-black">Venta {returnSale.folio}</h2><p className="text-sm text-muted-foreground">Selecciona únicamente lo que regresó el cliente.</p></div><Button size="icon" variant="ghost" onClick={() => setReturnSale(null)}><XCircle className="h-5 w-5" /></Button></div><div className="space-y-4 p-5"><div className="space-y-2.5">{returnSale.items.map((item) => { const available = maxReturn(item); const factor = Number(item.factor_inventario || 1); const step = factor > 1 ? 1 / factor : 1; return <div key={item.id_detalle} className="grid gap-3 rounded-2xl border border-border/60 p-4 sm:grid-cols-[1fr_170px] sm:items-end"><div><p className="font-bold">{item.nombre}</p><p className="text-xs text-muted-foreground">{item.sku} · disponibles para devolver {available}</p></div><div><label className="text-xs font-bold text-muted-foreground">Cantidad</label><Input type="number" min="0" max={available} step={step} disabled={available <= 0} value={returnQuantities[item.id_detalle] || ""} onChange={(event) => { const raw = event.target.value; setReturnQuantities((current) => ({ ...current, [item.id_detalle]: raw === "" ? "" : String(Math.min(Math.max(Number(raw), 0), available)) })); }} placeholder={available > 0 ? `Máximo ${available}` : "Sin disponibles"} /></div></div>; })}</div><div className="grid gap-3 md:grid-cols-2"><div><label className="text-xs font-bold text-muted-foreground">Motivo</label><Input className="mt-1" placeholder="Ejemplo: producto dañado" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} /></div><div><label className="text-xs font-bold text-muted-foreground">Reembolso</label><select className="mt-1 h-11 w-full rounded-xl border border-input/90 bg-card px-3" value={refundMethod} onChange={(event) => setRefundMethod(event.target.value as MetodoReembolso)}><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option></select></div></div><div className="flex items-center justify-between rounded-2xl bg-secondary/50 p-4"><div><p className="font-bold">Total a reembolsar</p><p className="text-xs text-muted-foreground">El inventario se restaurará al confirmar.</p></div><strong className="text-2xl font-black">{money(returnTotal)}</strong></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setReturnSale(null)}>Cancelar</Button><Button disabled={returning || returnTotal <= 0 || returnReason.trim().length < 3} onClick={submitReturn}>{returning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar devolución</Button></div></div></div></div>}

      {renderCashSummary()}
    </main>
  );
}
'''
text = text[:start] + new_tail
path.write_text(text, encoding='utf-8')

# Premium POS styles.
path = Path('src/index.css')
text = path.read_text(encoding='utf-8')
if 'RACKNOVA_PREMIUM_POS_V1' not in text:
    text += r'''

/* RACKNOVA_PREMIUM_POS_V1 */
.racknova-pos-premium {
  --rn-pos-shadow: 0 18px 50px hsl(222 47% 11% / 0.055);
  --rn-pos-shadow-strong: 0 28px 70px hsl(222 47% 11% / 0.10);
}
.rn-pos-topbar,
.rn-pos-surface,
.rn-pos-sale-panel {
  border: 1px solid hsl(var(--border) / 0.68);
  background: hsl(var(--card) / 0.94);
  backdrop-filter: blur(18px);
}
.rn-pos-topbar,
.rn-pos-surface {
  border-radius: 24px;
  box-shadow: var(--rn-pos-shadow);
}
.rn-pos-sale-panel {
  border-radius: 28px;
  box-shadow: var(--rn-pos-shadow-strong);
}
.rn-pos-product-card {
  position: relative;
  overflow: hidden;
  border: 1px solid hsl(var(--border) / 0.68);
  border-radius: 20px;
  background: hsl(var(--card));
  box-shadow: 0 1px 2px hsl(222 47% 11% / 0.03);
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}
.rn-pos-product-card:hover {
  transform: translateY(-2px);
  border-color: hsl(var(--primary) / 0.28);
  box-shadow: 0 18px 38px hsl(222 47% 11% / 0.08);
}
.rn-pos-product-card:active { transform: translateY(0) scale(0.99); }
.rn-pos-product-media {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-bottom: 1px solid hsl(var(--border) / 0.55);
  background: radial-gradient(circle at 20% 15%, hsl(var(--primary) / 0.08), transparent 35%), linear-gradient(145deg, hsl(var(--secondary) / 0.62), hsl(var(--background)));
}
.rn-pos-cart-item {
  border: 1px solid hsl(var(--border) / 0.62);
  border-radius: 18px;
  background: hsl(var(--card));
  padding: 12px;
  animation: rn-pos-cart-in 180ms ease-out;
}
@keyframes rn-pos-cart-in {
  from { opacity: 0; transform: translateY(5px) scale(0.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.dark .rn-pos-topbar,
.dark .rn-pos-surface,
.dark .rn-pos-sale-panel {
  background: hsl(var(--card) / 0.90);
  box-shadow: 0 20px 55px hsl(222 84% 2% / 0.35);
}
@media (max-width: 1279px) { .rn-pos-sale-panel { position: static; } }
@media (prefers-reduced-motion: reduce) { .rn-pos-product-card, .rn-pos-cart-item { transition: none; animation: none; } }
'''
    path.write_text(text, encoding='utf-8')
