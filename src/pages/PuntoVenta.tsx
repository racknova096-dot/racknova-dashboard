import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Barcode,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Printer,
  ReceiptText,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buscarProductosPOS,
  cambiarEstadoPOS,
  crearVentaPOS,
  listarVentasPOS,
  obtenerEstadoPOS,
  obtenerVentaPOS,
} from "@/lib/pos";
import type {
  POSEstado,
  POSProducto,
  POSVentaDetalle,
  POSVentaResumen,
} from "@/lib/pos";

type CartItem = POSProducto & {
  cantidadVenta: number;
  descuentoPorcentaje: number;
};

type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "mixto";

const round2 = (value: number) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));

const getRole = () => (localStorage.getItem("rol") || "viewer").toLowerCase();

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

export default function PuntoVenta() {
  const [estado, setEstado] = useState<POSEstado | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<POSProducto[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [efectivoRecibido, setEfectivoRecibido] = useState("");
  const [montoEfectivoMixto, setMontoEfectivoMixto] = useState("");
  const [montoTarjetaMixto, setMontoTarjetaMixto] = useState("");
  const [montoTransferenciaMixto, setMontoTransferenciaMixto] = useState("");
  const [referencia, setReferencia] = useState("");
  const [selling, setSelling] = useState(false);
  const [ticket, setTicket] = useState<POSVentaDetalle | null>(null);
  const [ventas, setVentas] = useState<POSVentaResumen[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const role = getRole();
  const isAdmin = role === "admin";

  const loadState = useCallback(async () => {
    setLoadingState(true);
    try {
      const response = await obtenerEstadoPOS();
      setEstado(response);
    } catch (error) {
      setEstado(null);
      toast.error(error instanceof Error ? error.message : "No se pudo consultar el POS.");
    } finally {
      setLoadingState(false);
    }
  }, []);

  const loadSales = useCallback(async () => {
    if (!estado?.habilitado) return;
    setLoadingSales(true);
    try {
      setVentas(await listarVentasPOS(30));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el historial.");
    } finally {
      setLoadingSales(false);
    }
  }, [estado?.habilitado]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (estado?.habilitado) {
      void loadSales();
      window.setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [estado?.habilitado, loadSales]);

  const totals = useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        const priceList = round2(item.precio_venta_sugerido);
        const discountUnit = round2(
          priceList * (item.descuentoPorcentaje / 100)
        );
        const finalUnit = round2(priceList - discountUnit);
        const list = round2(priceList * item.cantidadVenta);
        const lineTotal = round2(finalUnit * item.cantidadVenta);
        acc.subtotal = round2(acc.subtotal + list);
        acc.discount = round2(acc.discount + (list - lineTotal));
        acc.total = round2(acc.total + lineTotal);
        return acc;
      },
      { subtotal: 0, discount: 0, total: 0 }
    );
  }, [cart]);

  const change = useMemo(() => {
    const received = Number(efectivoRecibido || 0);
    const cashDue =
      metodoPago === "efectivo"
        ? totals.total
        : metodoPago === "mixto"
          ? Number(montoEfectivoMixto || 0)
          : 0;
    return Math.max(received - cashDue, 0);
  }, [efectivoRecibido, metodoPago, montoEfectivoMixto, totals.total]);

  const addProduct = (product: POSProducto) => {
    if (product.cantidad <= 0) {
      toast.error(`${product.nombre} no tiene existencias.`);
      return;
    }
    if (product.precio_venta_sugerido <= 0) {
      toast.error(`${product.nombre} no tiene precio de venta configurado.`);
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.sku === product.sku);
      if (existing) {
        if (existing.cantidadVenta >= product.cantidad) {
          toast.error("No hay más unidades disponibles.");
          return current;
        }
        return current.map((item) =>
          item.sku === product.sku
            ? { ...item, cantidadVenta: item.cantidadVenta + 1 }
            : item
        );
      }
      return [
        ...current,
        { ...product, cantidadVenta: 1, descuentoPorcentaje: 0 },
      ];
    });
    setQuery("");
    setResults([]);
    window.setTimeout(() => searchRef.current?.focus(), 50);
  };

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = query.trim();
    if (!value) return;

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
      toast.error(error instanceof Error ? error.message : "No se pudo buscar el producto.");
    } finally {
      setSearching(false);
    }
  };

  const updateQuantity = (sku: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) => {
          if (item.sku !== sku) return item;
          const next = item.cantidadVenta + delta;
          if (next > item.cantidad) {
            toast.error(`Stock disponible: ${item.cantidad}.`);
            return item;
          }
          return { ...item, cantidadVenta: next };
        })
        .filter((item) => item.cantidadVenta > 0)
    );
  };

  const setDiscount = (sku: string, value: number) => {
    const max = isAdmin ? 100 : 10;
    const safe = Math.min(Math.max(Number(value || 0), 0), max);
    setCart((current) =>
      current.map((item) =>
        item.sku === sku ? { ...item, descuentoPorcentaje: safe } : item
      )
    );
  };

  const buildPayments = () => {
    if (metodoPago === "efectivo") {
      return [{ metodo: "efectivo" as const, monto: totals.total }];
    }
    if (metodoPago === "tarjeta") {
      return [
        {
          metodo: "tarjeta" as const,
          monto: totals.total,
          referencia: referencia.trim() || null,
        },
      ];
    }
    if (metodoPago === "transferencia") {
      return [
        {
          metodo: "transferencia" as const,
          monto: totals.total,
          referencia: referencia.trim() || null,
        },
      ];
    }

    const payments = [];
    const cash = Number(montoEfectivoMixto || 0);
    const card = Number(montoTarjetaMixto || 0);
    const transfer = Number(montoTransferenciaMixto || 0);
    if (cash > 0) payments.push({ metodo: "efectivo" as const, monto: cash });
    if (card > 0) {
      payments.push({
        metodo: "tarjeta" as const,
        monto: card,
        referencia: referencia.trim() || null,
      });
    }
    if (transfer > 0) {
      payments.push({
        metodo: "transferencia" as const,
        monto: transfer,
        referencia: referencia.trim() || null,
      });
    }
    return payments;
  };

  const checkout = async () => {
    if (cart.length === 0) {
      toast.error("Agrega al menos un producto.");
      return;
    }

    const payments = buildPayments();
    const paid = payments.reduce((sum, payment) => sum + payment.monto, 0);
    if (Math.abs(paid - totals.total) > 0.01) {
      toast.error(`Los pagos deben sumar ${money(totals.total)}.`);
      return;
    }

    const cashDue = payments
      .filter((payment) => payment.metodo === "efectivo")
      .reduce((sum, payment) => sum + payment.monto, 0);
    const received = Number(efectivoRecibido || cashDue);
    if (cashDue > 0 && received < cashDue) {
      toast.error("El efectivo recibido es insuficiente.");
      return;
    }

    setSelling(true);
    try {
      const response = await crearVentaPOS({
        items: cart.map((item) => ({
          sku: item.sku,
          cantidad: item.cantidadVenta,
          descuento_porcentaje: item.descuentoPorcentaje,
        })),
        pagos: payments,
        efectivo_recibido: cashDue > 0 ? received : null,
      });

      setTicket(response);
      setCart([]);
      setResults([]);
      setQuery("");
      setEfectivoRecibido("");
      setMontoEfectivoMixto("");
      setMontoTarjetaMixto("");
      setMontoTransferenciaMixto("");
      setReferencia("");
      toast.success(`Venta ${response.folio} completada.`);
      await loadSales();
      window.setTimeout(() => searchRef.current?.focus(), 100);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar la venta.");
    } finally {
      setSelling(false);
    }
  };

  const printTicket = (sale: POSVentaDetalle) => {
    const popup = window.open("", "_blank", "width=420,height=720");
    if (!popup) {
      toast.error("El navegador bloqueó la ventana de impresión.");
      return;
    }

    const items = sale.items
      .map(
        (item) => `
          <tr>
            <td>${item.cantidad} × ${item.nombre}<br><small>${item.sku}</small></td>
            <td style="text-align:right">${money(item.subtotal)}</td>
          </tr>`
      )
      .join("");

    const payments = sale.pagos
      .map(
        (payment) => `
          <div style="display:flex;justify-content:space-between">
            <span>${payment.metodo}</span><span>${money(payment.monto)}</span>
          </div>`
      )
      .join("");

    popup.document.write(`
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${sale.folio}</title>
        <style>
          body{font-family:Arial,sans-serif;margin:24px;color:#111}
          h1,p{margin:4px 0;text-align:center}
          table{width:100%;border-collapse:collapse;margin:18px 0}
          td{padding:7px 0;border-bottom:1px dashed #bbb;vertical-align:top}
          .row{display:flex;justify-content:space-between;margin:6px 0}
          .total{font-size:20px;font-weight:700;border-top:2px solid #111;padding-top:10px}
          small{color:#555}
        </style>
      </head>
      <body>
        <h1>RackNova</h1>
        <p>Punto de Venta</p>
        <p><strong>${sale.folio}</strong></p>
        <p>${formatDate(sale.fecha)}</p>
        <p>Cajero: ${sale.usuario}</p>
        <table>${items}</table>
        <div class="row"><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>
        <div class="row"><span>Descuento</span><span>-${money(sale.descuento_total)}</span></div>
        <div class="row total"><span>Total</span><span>${money(sale.total)}</span></div>
        <div style="margin-top:14px">${payments}</div>
        ${sale.efectivo_recibido > 0 ? `<div class="row"><span>Recibido</span><span>${money(sale.efectivo_recibido)}</span></div>` : ""}
        ${sale.cambio > 0 ? `<div class="row"><span>Cambio</span><span>${money(sale.cambio)}</span></div>` : ""}
        <p style="margin-top:28px">Gracias por su compra</p>
        <script>window.onload=()=>{window.print();}</script>
      </body>
      </html>
    `);
    popup.document.close();
  };

  const openSale = async (id: number) => {
    try {
      setTicket(await obtenerVentaPOS(id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir la venta.");
    }
  };

  const togglePOS = async () => {
    if (!estado || !isAdmin) return;
    try {
      const response = await cambiarEstadoPOS(!estado.config_habilitado);
      setEstado(response);
      window.dispatchEvent(
        new CustomEvent("racknova:pos-state-changed", { detail: response })
      );
      toast.success(response.mensaje);
      if (!response.habilitado) {
        setCart([]);
        setResults([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar el estado.");
    }
  };

  if (loadingState) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    );
  }

  if (!estado?.habilitado) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <Card className="mt-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WifiOff className="h-5 w-5" /> Punto de Venta desactivado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              El inventario, catálogo, reportes, IA y MQTT continúan funcionando normalmente.
            </p>
            {!estado?.env_habilitado && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                Para habilitarlo, agrega <strong>POS_ENABLED=true</strong> en Render y vuelve a desplegar el backend.
              </p>
            )}
            {estado?.env_habilitado && isAdmin && (
              <Button onClick={togglePOS}>Activar Punto de Venta</Button>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight">
            <Store className="h-8 w-8" /> Punto de Venta
          </h1>
          <p className="text-muted-foreground">
            Escanea o busca productos, cobra y descuenta inventario con FEFO.
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={togglePOS}>
            Desactivar POS
          </Button>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Barcode className="h-5 w-5" /> Escanear o buscar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={search} className="flex gap-2">
                <Input
                  ref={searchRef}
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Código de barras, SKU o nombre"
                  autoComplete="off"
                />
                <Button type="submit" disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </form>

              {results.length > 0 && (
                <div className="mt-4 grid gap-2">
                  {results.map((product) => (
                    <button
                      type="button"
                      key={product.id_producto}
                      onClick={() => addProduct(product)}
                      className="flex items-center justify-between rounded-xl border p-3 text-left transition hover:bg-secondary"
                    >
                      <div>
                        <p className="font-semibold">{product.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.sku} · {product.ubicacion} · Stock {product.cantidad}
                        </p>
                      </div>
                      <strong>{money(product.precio_venta_sugerido)}</strong>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Carrito
                <Badge variant="secondary">{cart.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                  Escanea o busca un producto para comenzar.
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => {
                    const finalUnit =
                      item.precio_venta_sugerido *
                      (1 - item.descuentoPorcentaje / 100);
                    return (
                      <div key={item.sku} className="rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">{item.nombre}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.sku} · {item.ubicacion} · Disponible {item.cantidad}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setCart((current) => current.filter((row) => row.sku !== item.sku))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Cantidad</label>
                            <div className="mt-1 flex items-center gap-2">
                              <Button size="icon" variant="outline" onClick={() => updateQuantity(item.sku, -1)}>
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="min-w-8 text-center font-bold">{item.cantidadVenta}</span>
                              <Button size="icon" variant="outline" onClick={() => updateQuantity(item.sku, 1)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-muted-foreground">
                              Descuento % {isAdmin ? "" : "(máx. 10)"}
                            </label>
                            <Input
                              type="number"
                              min="0"
                              max={isAdmin ? 100 : 10}
                              step="0.01"
                              value={item.descuentoPorcentaje}
                              onChange={(event) => setDiscount(item.sku, Number(event.target.value))}
                            />
                          </div>

                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">{money(finalUnit)} c/u</p>
                            <p className="text-lg font-black">{money(finalUnit * item.cantidadVenta)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5" /> Cobro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 rounded-xl bg-secondary/60 p-4">
                <div className="flex justify-between"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
                <div className="flex justify-between text-emerald-600"><span>Descuento</span><span>-{money(totals.discount)}</span></div>
                <div className="flex justify-between border-t pt-3 text-2xl font-black"><span>Total</span><span>{money(totals.total)}</span></div>
              </div>

              <div>
                <label className="text-sm font-semibold">Forma de pago</label>
                <select
                  value={metodoPago}
                  onChange={(event) => setMetodoPago(event.target.value as MetodoPago)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="mixto">Pago mixto</option>
                </select>
              </div>

              {metodoPago === "mixto" && (
                <div className="grid gap-3">
                  <Input type="number" min="0" step="0.01" placeholder="Monto en efectivo" value={montoEfectivoMixto} onChange={(e) => setMontoEfectivoMixto(e.target.value)} />
                  <Input type="number" min="0" step="0.01" placeholder="Monto en tarjeta" value={montoTarjetaMixto} onChange={(e) => setMontoTarjetaMixto(e.target.value)} />
                  <Input type="number" min="0" step="0.01" placeholder="Monto por transferencia" value={montoTransferenciaMixto} onChange={(e) => setMontoTransferenciaMixto(e.target.value)} />
                </div>
              )}

              {(metodoPago === "tarjeta" || metodoPago === "transferencia" || metodoPago === "mixto") && (
                <Input placeholder="Referencia opcional" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
              )}

              {(metodoPago === "efectivo" || metodoPago === "mixto") && (
                <div>
                  <label className="text-sm font-semibold">Efectivo recibido</label>
                  <Input type="number" min="0" step="0.01" value={efectivoRecibido} onChange={(e) => setEfectivoRecibido(e.target.value)} placeholder="0.00" />
                  <div className="mt-2 flex justify-between rounded-lg bg-secondary p-3 font-bold">
                    <span>Cambio</span><span>{money(change)}</span>
                  </div>
                </div>
              )}

              <Button className="h-12 w-full text-base" disabled={selling || cart.length === 0} onClick={checkout}>
                {selling ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : metodoPago === "efectivo" ? <Banknote className="mr-2 h-5 w-5" /> : <CreditCard className="mr-2 h-5 w-5" />}
                Cobrar {money(totals.total)}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Últimas ventas</span>
            <Button variant="outline" size="sm" onClick={() => void loadSales()} disabled={loadingSales}>
              {loadingSales && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Actualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">Folio</th><th className="p-3">Fecha</th><th className="p-3">Cajero</th><th className="p-3">Estado</th><th className="p-3 text-right">Total</th><th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((sale) => (
                  <tr key={sale.id_venta} className="border-b">
                    <td className="p-3 font-mono text-xs">{sale.folio}</td>
                    <td className="p-3">{formatDate(sale.fecha)}</td>
                    <td className="p-3">{sale.usuario}</td>
                    <td className="p-3"><Badge>{sale.estado}</Badge></td>
                    <td className="p-3 text-right font-bold">{money(sale.total)}</td>
                    <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => void openSale(sale.id_venta)}>Ver</Button></td>
                  </tr>
                ))}
                {ventas.length === 0 && !loadingSales && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Todavía no hay ventas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {ticket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => setTicket(null)}>
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <CardTitle>Venta {ticket.folio}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">{formatDate(ticket.fecha)} · {ticket.usuario}</div>
              <div className="space-y-2">
                {ticket.items.map((item) => (
                  <div key={item.id_detalle} className="flex justify-between gap-4 border-b pb-2">
                    <span>{item.cantidad} × {item.nombre}</span><strong>{money(item.subtotal)}</strong>
                  </div>
                ))}
              </div>
              <div className="space-y-2 rounded-xl bg-secondary p-4">
                <div className="flex justify-between"><span>Subtotal</span><span>{money(ticket.subtotal)}</span></div>
                <div className="flex justify-between"><span>Descuento</span><span>-{money(ticket.descuento_total)}</span></div>
                <div className="flex justify-between text-xl font-black"><span>Total</span><span>{money(ticket.total)}</span></div>
                {ticket.cambio > 0 && <div className="flex justify-between"><span>Cambio</span><span>{money(ticket.cambio)}</span></div>}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => printTicket(ticket)}><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
                <Button variant="outline" onClick={() => setTicket(null)}>Cerrar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
