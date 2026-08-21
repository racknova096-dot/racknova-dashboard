import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  Boxes,
  Download,
  FileCheck2,
  Gift,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  UserRound,
  Users,
  WalletCards,
  Printer,
  ReceiptText,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  actualizarClientePOS,
  actualizarPromocionPOS,
  buscarProductosPOS,
  cerrarReporteDiarioPOS,
  cotizarVentaPOS,
  crearClientePOS,
  crearPromocionPOS,
  crearVentaPOS,
  descargarReportePOS,
  guardarConfiguracionProductoPOS,
  listarClientesPOS,
  listarConfiguracionesProductoPOS,
  listarCreditosPOS,
  listarPromocionesPOS,
  obtenerEstadoCuentaPOS,
  obtenerReporteDiarioPOS,
  registrarAbonoPOS,
  eliminarMayoreoMenudeoPOS,
  eliminarPromocionPOSV4,
  guardarMayoreoMenudeoPOS,
  listarMayoreoMenudeoPOS,
  obtenerReporteDiarioPOSV4,
  POSReglaMayoreo,
  POSReporteDiarioV4,
  obtenerReporteDiarioPOSV5,
  POSReporteDiarioV5,
} from "@/lib/pos";
import type {
  POSCliente,
  POSClientePayload,
  POSCotizacion,
  POSCredito,
  POSProducto,
  POSProductoConfiguracion,
  POSPromocion,
  POSPromocionPayload,
  POSReporteDiario,
  POSVentaDetalle,
} from "@/lib/pos";

type TabKey = "venta" | "clientes" | "promociones" | "productos" | "reportes";
type PaymentMethod = "efectivo" | "tarjeta" | "transferencia";
type SaleType = "CONTADO" | "CREDITO" | "PARCIAL";

type AdvancedCartItem = POSProducto & {
  cantidadVenta: number;
  cantidadInput: string;
  descuentoPorcentaje: number;
  descuentoInput: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));

const today = () => new Date().toISOString().slice(0, 10);

const createOperationId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rn-v3-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

// RACKNOVA_INPUTS_LIBRES_FASE3
const emptyClient: POSClientePayload = {
  nombre: "",
  telefono: "",
  email: "",
  rfc: "",
  direccion: "",
  limite_credito: 0,
  dias_credito: 0,
  notas: "",
  activo: true,
};

const emptyPromotion: POSPromocionPayload = {
  nombre: "",
  tipo: "PORCENTAJE",
  sku: "",
  porcentaje: 0,
  precio_fijo: 0,
  cantidad_minima: 1,
  compra_cantidad: 0,
  paga_cantidad: 0,
  fecha_inicio: null,
  fecha_fin: null,
  prioridad: 0,
  activa: true,
};

const emitInventoryUpdated = () => {
  window.dispatchEvent(
    new CustomEvent("racknova:inventory-updated", {
      detail: { source: "pos-fase3", at: Date.now() },
    })
  );
};

export default function POSFase3Panel() {
  const [tab, setTab] = useState<TabKey>("clientes");
  const role = (localStorage.getItem("rol") || "viewer").toLowerCase();
  const isAdmin = role === "admin";

  const [clients, setClients] = useState<POSCliente[]>([]);
  const [credits, setCredits] = useState<POSCredito[]>([]);
  const [promotions, setPromotions] = useState<POSPromocion[]>([]);
  const [loadingBase, setLoadingBase] = useState(false);

  const loadBase = useCallback(async () => {
    setLoadingBase(true);
    try {
      const [clientRows, creditRows, promoRows] = await Promise.all([
        listarClientesPOS(),
        listarCreditosPOS(),
        listarPromocionesPOS(true),
      ]);
      setClients(clientRows);
      setCredits(creditRows);
      setPromotions(promoRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se cargó la Fase 3.");
    } finally {
      setLoadingBase(false);
    }
  }, []);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  return (
    <section className="space-y-4">
      <Card className="rounded-3xl border-slate-200 bg-white shadow-lg shadow-slate-200/30 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <BadgeDollarSign className="h-5 w-5" />
              Herramientas comerciales
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => void loadBase()} disabled={loadingBase}>
              {loadingBase ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Actualizar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <TabButton active={tab === "venta"} onClick={() => setTab("venta")} icon={<ShoppingCart className="h-4 w-4" />} label="Venta avanzada" />
            <TabButton active={tab === "clientes"} onClick={() => setTab("clientes")} icon={<Users className="h-4 w-4" />} label="Clientes y crédito" />
            {isAdmin && (
              <>
                <TabButton active={tab === "promociones"} onClick={() => setTab("promociones")} icon={<Gift className="h-4 w-4" />} label="Promociones" />
                <TabButton active={tab === "productos"} onClick={() => setTab("productos")} icon={<Boxes className="h-4 w-4" />} label="Mayoreo y menudeo" />
                <TabButton active={tab === "reportes"} onClick={() => setTab("reportes")} icon={<BarChart3 className="h-4 w-4" />} label="Reporte diario" />
              </>
            )}
          </div>
        </CardHeader>
      </Card>

      {tab === "venta" && <AdvancedSale clients={clients} onCompleted={loadBase} />}
      {tab === "clientes" && (
        <ClientsAndCredit
          clients={clients}
          credits={credits}
          onChanged={loadBase}
        />
      )}
      {isAdmin && tab === "promociones" && (
        <PromotionsPanel promotions={promotions} isAdmin={isAdmin} onChanged={loadBase} />
      )}
      {isAdmin && tab === "productos" && (
        <WholesaleRetailPanel isAdmin={isAdmin} />
      )}
      {isAdmin && tab === "reportes" && (
        <ReportsPanel isAdmin={isAdmin} />
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Button type="button" variant={active ? "default" : "outline"} size="sm" onClick={onClick}>
      <span className="mr-2">{icon}</span>
      {label}
    </Button>
  );
}

function AdvancedSale({
  clients,
  onCompleted,
}: {
  clients: POSCliente[];
  onCompleted: () => Promise<void>;
}) {
  const [clientId, setClientId] = useState("");
  const [saleType, setSaleType] = useState<SaleType>("CONTADO");
  const [dueDate, setDueDate] = useState(today());
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<POSProducto[]>([]);
  const [cart, setCart] = useState<AdvancedCartItem[]>([]);
  const [quote, setQuote] = useState<POSCotizacion | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [reference, setReference] = useState("");
  const [selling, setSelling] = useState(false);
  const [completedSale, setCompletedSale] = useState<POSVentaDetalle | null>(null);
  // RACKNOVA_TICKET_FASE3

  const selectedClient = clients.find((item) => String(item.id_cliente) === clientId);
  const total = quote?.total || 0;

  // RACKNOVA_FIX_TDZ_ADVANCED_QUANTITY
  const advancedQuantityError = useMemo(() => {
    for (const item of cart) {
      const raw = item.cantidadInput.trim();

      if (raw === "") {
        return `Captura la cantidad de ${item.nombre}.`;
      }

      const value = Number(raw);
      const available =
        item.cantidad_disponible_venta ?? item.cantidad;
      const factor = Number(item.factor_inventario || 1);

      if (!Number.isFinite(value) || value <= 0) {
        return `La cantidad de ${item.nombre} debe ser mayor a cero.`;
      }

      if (value > available + 0.000001) {
        return `La cantidad de ${item.nombre} supera la existencia disponible.`;
      }

      if (
        Math.abs(value * factor - Math.round(value * factor)) >
        0.000001
      ) {
        return `La cantidad de ${item.nombre} tiene demasiados decimales.`;
      }
    }

    return null;
  }, [cart]);

  const quotePayload = useMemo(
    () => ({
      operacion_id: createOperationId(),
      items: cart.map((item) => ({
        sku: item.sku,
        cantidad: item.cantidadVenta,
        descuento_porcentaje: item.descuentoPorcentaje,
      })),
      pagos: [],
      id_cliente: clientId ? Number(clientId) : null,
      tipo_venta: saleType,
      fecha_vencimiento: saleType === "CONTADO" ? null : dueDate,
    }),
    [cart, clientId, saleType, dueDate]
  );

  useEffect(() => {
    if (cart.length === 0 || advancedQuantityError) {
      setQuote(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      setQuoting(true);
      try {
        setQuote(await cotizarVentaPOS(quotePayload));
      } catch (error) {
        setQuote(null);
        toast.error(error instanceof Error ? error.message : "No se pudo cotizar.");
      } finally {
        setQuoting(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [advancedQuantityError, cart, quotePayload]);

  useEffect(() => {
    if (saleType === "CONTADO" && total > 0) {
      setPaymentAmount(String(total));
    }
    if (saleType === "CREDITO") {
      setPaymentAmount("");
    }
  }, [saleType, total]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const rows = await buscarProductosPOS(query.trim(), clientId ? Number(clientId) : null);
      setResults(rows);
      if (rows.length === 1) add(rows[0]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se encontró el producto.");
    } finally {
      setSearching(false);
    }
  };

  const add = (product: POSProducto) => {
    const available = product.cantidad_disponible_venta ?? product.cantidad;
    if (available <= 0) {
      toast.error("El producto no tiene existencia.");
      return;
    }
    const step = product.permite_fraccion ? 1 / Number(product.factor_inventario || 1) : 1;
    setCart((current) => {
      const found = current.find((item) => item.sku === product.sku);
      if (found) {
        return current.map((item) =>
          item.sku === product.sku
            ? {
                ...item,
                cantidadVenta: Math.min(
                  item.cantidadVenta + step,
                  available
                ),
                cantidadInput: String(
                  Math.min(item.cantidadVenta + step, available)
                ),
              }
            : item
        );
      }
      const initialQuantity = Math.min(1, available);

      return [
        ...current,
        {
          ...product,
          cantidadVenta: initialQuantity,
          cantidadInput: String(initialQuantity),
          descuentoPorcentaje: 0,
          descuentoInput: "",
        },
      ];
    });
    setResults([]);
    setQuery("");
  };

  const updateQuantity = (sku: string, raw: string) => {
    setCart((current) =>
      current.map((item) => {
        if (item.sku !== sku) return item;

        if (raw === "") {
          return {
            ...item,
            cantidadInput: "",
            cantidadVenta: 0,
          };
        }

        const parsed = Number(raw);
        return {
          ...item,
          cantidadInput: raw,
          cantidadVenta: Number.isFinite(parsed) ? parsed : 0,
        };
      })
    );
  };

  const updateAdvancedDiscount = (sku: string, raw: string) => {
    setCart((current) =>
      current.map((item) => {
        if (item.sku !== sku) return item;

        if (raw === "") {
          return {
            ...item,
            descuentoInput: "",
            descuentoPorcentaje: 0,
          };
        }

        const parsed = Number(raw);
        const safe = Number.isFinite(parsed)
          ? Math.min(Math.max(parsed, 0), 100)
          : 0;

        return {
          ...item,
          descuentoInput: parsed > 100 ? "100" : raw,
          descuentoPorcentaje: safe,
        };
      })
    );
  };



  const printCompletedSale = (sale: POSVentaDetalle) => {
    const popup = window.open("", "_blank", "width=430,height=760");

    if (!popup) {
      toast.error("El navegador bloqueó la ventana de impresión.");
      return;
    }

    const escapeHtml = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const items = sale.items
      .map(
        (item) => `
          <tr>
            <td>
              ${escapeHtml(item.cantidad)} ${escapeHtml(
                item.unidad_venta || "pieza"
              )} × ${escapeHtml(item.nombre)}
              <br><small>${escapeHtml(item.sku)}</small>
              ${
                item.promocion_nombre
                  ? `<br><small>Promoción: ${escapeHtml(
                      item.promocion_nombre
                    )}</small>`
                  : ""
              }
            </td>
            <td style="text-align:right">${money(item.subtotal)}</td>
          </tr>`
      )
      .join("");

    const payments = sale.pagos
      .map(
        (payment) => `
          <div class="row">
            <span>${escapeHtml(payment.metodo)}</span>
            <span>${money(payment.monto)}</span>
          </div>`
      )
      .join("");

    popup.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(sale.folio)}</title>
          <style>
            body{font-family:Arial,sans-serif;margin:24px;color:#111}
            h1,p{margin:4px 0;text-align:center}
            table{width:100%;border-collapse:collapse;margin:18px 0}
            td{padding:7px 0;border-bottom:1px dashed #bbb;vertical-align:top}
            .row{display:flex;justify-content:space-between;margin:7px 0}
            .total{font-size:20px;font-weight:700;border-top:1px solid #111;padding-top:8px}
          </style>
        </head>
        <body>
          <h1>RackNova</h1>
          <p>${escapeHtml(sale.folio)}</p>
          <p>${new Date(sale.fecha).toLocaleString("es-MX")}</p>
          <p>Cajero: ${escapeHtml(sale.usuario)}</p>
          <p>Cliente: ${escapeHtml(
            sale.cliente_nombre || "Público general"
          )}</p>
          <table>${items}</table>
          <div class="row"><span>Subtotal</span><span>${money(
            sale.subtotal
          )}</span></div>
          <div class="row"><span>Descuento</span><span>-${money(
            sale.descuento_total
          )}</span></div>
          <div class="row total"><span>Total</span><span>${money(
            sale.total
          )}</span></div>
          ${payments}
          <div class="row"><span>Cambio</span><span>${money(
            sale.cambio
          )}</span></div>
          <p style="margin-top:28px">Gracias por su compra</p>
          <script>window.onload=()=>window.print();</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  const checkout = async () => {
    if (advancedQuantityError) {
      toast.error(advancedQuantityError);
      return;
    }

    if (cart.length === 0 || !quote) return;
    if (saleType !== "CONTADO" && !clientId) {
      toast.error("Selecciona el cliente para vender a crédito.");
      return;
    }
    const amount = Number(paymentAmount || 0);
    if (saleType === "PARCIAL" && (amount <= 0 || amount >= total)) {
      toast.error("El pago parcial debe ser mayor a cero y menor al total.");
      return;
    }
    const payments = amount > 0
      ? [
          {
            metodo: paymentMethod,
            monto: amount,
            referencia: reference.trim() || null,
          },
        ]
      : [];
    setSelling(true);
    try {
      const sale = await crearVentaPOS({
        operacion_id: createOperationId(),
        items: cart.map((item) => ({
          sku: item.sku,
          cantidad: item.cantidadVenta,
          descuento_porcentaje: item.descuentoPorcentaje,
        })),
        pagos: payments,
        efectivo_recibido:
          paymentMethod === "efectivo" && amount > 0
            ? Number(cashReceived || amount)
            : null,
        id_cliente: clientId ? Number(clientId) : null,
        tipo_venta: saleType,
        fecha_vencimiento: saleType === "CONTADO" ? null : dueDate,
      });
      setCompletedSale(sale);
      toast.success(`Venta ${sale.folio} registrada.`);
      setCart([]);
      setQuote(null);
      setPaymentAmount("");
      setCashReceived("");
      setReference("");
      emitInventoryUpdated();
      await onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se registró la venta.");
    } finally {
      setSelling(false);
    }
  };

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="space-y-5">
        <Card>
          <CardHeader><CardTitle>Cliente y modalidad</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Cliente</label>
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={clientId} onChange={(event) => setClientId(event.target.value)}>
                <option value="">Público general</option>
                {clients.filter((item) => item.activo).map((item) => (
                  <option key={item.id_cliente} value={item.id_cliente}>{item.nombre} · saldo {money(item.saldo)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Tipo de venta</label>
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={saleType} onChange={(event) => setSaleType(event.target.value as SaleType)}>
                <option value="CONTADO">Contado</option>
                <option value="CREDITO">Crédito / fiado</option>
                <option value="PARCIAL">Pago parcial</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Vencimiento</label>
              <Input type="date" disabled={saleType === "CONTADO"} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            {selectedClient && (
              <div className="md:col-span-3 rounded-lg bg-secondary p-3 text-sm">
                Límite: <strong>{money(selectedClient.limite_credito)}</strong> · disponible: <strong>{money(selectedClient.credito_disponible)}</strong> · vencido: <strong>{money(selectedClient.vencido)}</strong>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Buscar producto</CardTitle></CardHeader>
          <CardContent>
            <form className="flex gap-2" onSubmit={search}>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, SKU o nombre" />
              <Button type="submit" disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
            </form>
            {results.length > 0 && (
              <div className="mt-3 divide-y rounded-lg border">
                {results.map((product) => (
                  <button key={product.id_producto} type="button" className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted" onClick={() => add(product)}>
                    <div>
                      <p className="font-semibold">{product.nombre}</p>
                      <p className="text-sm text-muted-foreground">{product.sku} · disponible {product.cantidad_disponible_venta ?? product.cantidad} {product.unidad_venta || "pieza"}</p>
                    </div>
                    <strong>{money(product.precio_venta_sugerido)}</strong>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Carrito avanzado</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Agrega productos para vender por pieza, peso, volumen o longitud.</p>}
            {cart.map((item, index) => {
              const quoteItem = quote?.items[index];
              const step = item.permite_fraccion ? 1 / Number(item.factor_inventario || 1) : 1;
              return (
                <div key={item.sku} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_150px_140px_auto] md:items-end">
                  <div>
                    <p className="font-semibold">{item.nombre}</p>
                    <p className="text-sm text-muted-foreground">{item.sku} · {item.unidad_venta || "pieza"}{quoteItem?.promotion_name ? ` · ${quoteItem.promotion_name}` : ""}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Cantidad</label>
                    <Input
                      type="number"
                      min={step}
                      step={step}
                      max={
                        item.cantidad_disponible_venta ??
                        item.cantidad
                      }
                      placeholder="Cantidad"
                      value={item.cantidadInput}
                      aria-invalid={
                        item.cantidadInput.trim() === ""
                      }
                      onChange={(event) =>
                        updateQuantity(
                          item.sku,
                          event.target.value
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Descuento manual %</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="Ejemplo: 10"
                      value={item.descuentoInput}
                      onChange={(event) =>
                        updateAdvancedDiscount(
                          item.sku,
                          event.target.value
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <strong>{quoteItem ? money(quoteItem.final_total) : "—"}</strong>
                    <Button size="sm" variant="ghost" onClick={() => setCart((current) => current.filter((row) => row.sku !== item.sku))}>Quitar</Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" /> Cobro avanzado</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-secondary p-4">
            <div className="flex justify-between"><span>Total</span><strong className="text-xl">{quoting ? "Calculando..." : money(total)}</strong></div>
            <div className="mt-1 flex justify-between text-sm text-muted-foreground"><span>Promociones</span><span>-{money(quote?.items.reduce((sum, item) => sum + item.automatic_discount, 0) || 0)}</span></div>
          </div>
          <div>
            <label className="text-sm font-medium">Método aplicado</label>
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Monto pagado ahora</label>
            <Input type="number" min="0" step="0.01" disabled={saleType === "CREDITO"} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
          </div>
          {paymentMethod === "efectivo" && Number(paymentAmount || 0) > 0 && (
            <div>
              <label className="text-sm font-medium">Efectivo recibido</label>
              <Input type="number" min="0" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} />
            </div>
          )}
          {paymentMethod !== "efectivo" && (
            <Input placeholder="Referencia" value={reference} onChange={(event) => setReference(event.target.value)} />
          )}
          <Button className="w-full" disabled={selling || !quote || Boolean(advancedQuantityError) || cart.length === 0} onClick={checkout}>
            {selling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar venta {money(total)}
          </Button>
        </CardContent>
      </Card>
      </div>

      {completedSale && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Resumen de la venta ${completedSale.folio}`}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-background shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background/95 p-5 backdrop-blur">
              <div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <ReceiptText className="h-6 w-6" />
                  <span className="font-semibold">Venta completada</span>
                </div>
                <h2 className="mt-1 text-2xl font-black">
                  Ticket {completedSale.folio}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {new Date(completedSale.fecha).toLocaleString("es-MX")}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCompletedSale(null)}
                aria-label="Cerrar ticket"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 rounded-xl bg-secondary p-4 sm:grid-cols-4">
                <div>
                  <span className="text-xs text-muted-foreground">Cajero</span>
                  <p className="font-semibold">{completedSale.usuario}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Cliente</span>
                  <p className="font-semibold">
                    {completedSale.cliente_nombre || "Público general"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Modalidad</span>
                  <p className="font-semibold">
                    {completedSale.tipo_venta || "CONTADO"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Estado</span>
                  <p className="font-semibold">{completedSale.estado}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border">
                <div className="border-b bg-muted/50 px-4 py-3 font-semibold">
                  Productos
                </div>
                <div className="divide-y">
                  {completedSale.items.map((item) => (
                    <div
                      key={item.id_detalle}
                      className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <p className="font-semibold">{item.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.cantidad} {item.unidad_venta || "pieza"} ×{" "}
                          {money(item.precio_unitario_final)}
                        </p>
                        {item.promocion_nombre && (
                          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                            Promoción: {item.promocion_nombre}
                          </p>
                        )}
                      </div>
                      <strong>{money(item.subtotal)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="mb-3 font-semibold">Pagos</p>
                  <div className="space-y-2">
                    {completedSale.pagos.map((payment) => (
                      <div
                        key={payment.id_pago}
                        className="flex justify-between text-sm"
                      >
                        <span className="capitalize">
                          {payment.metodo}
                          {payment.referencia
                            ? ` · ${payment.referencia}`
                            : ""}
                        </span>
                        <strong>{money(payment.monto)}</strong>
                      </div>
                    ))}
                    {completedSale.pagos.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Sin pago inicial.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 rounded-xl bg-secondary p-4">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <strong>{money(completedSale.subtotal)}</strong>
                  </div>
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                    <span>Promociones</span>
                    <strong>
                      -{money(completedSale.descuento_promociones || 0)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Descuento total</span>
                    <strong>
                      -{money(completedSale.descuento_total)}
                    </strong>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-xl">
                    <span>Total</span>
                    <strong>{money(completedSale.total)}</strong>
                  </div>
                  {completedSale.efectivo_recibido > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Efectivo recibido</span>
                        <strong>
                          {money(completedSale.efectivo_recibido)}
                        </strong>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Cambio</span>
                        <strong>{money(completedSale.cambio)}</strong>
                      </div>
                    </>
                  )}
                  {Number(completedSale.saldo_pendiente || 0) > 0 && (
                    <div className="flex justify-between border-t pt-2 text-amber-700 dark:text-amber-300">
                      <span>Saldo pendiente</span>
                      <strong>
                        {money(completedSale.saldo_pendiente || 0)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCompletedSale(null)}
                >
                  Nueva venta
                </Button>
                <Button
                  type="button"
                  onClick={() => printCompletedSale(completedSale)}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir ticket
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function ClientsAndCredit({
  clients,
  credits,
  onChanged,
}: {
  clients: POSCliente[];
  credits: POSCredito[];
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState<POSClientePayload>(emptyClient);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [statement, setStatement] = useState<Awaited<ReturnType<typeof obtenerEstadoCuentaPOS>> | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [abonoCreditId, setAbonoCreditId] = useState("");
  const [abonoAmount, setAbonoAmount] = useState("");
  const [abonoMethod, setAbonoMethod] = useState<PaymentMethod>("efectivo");
  const [abonoReference, setAbonoReference] = useState("");
  const [savingAbono, setSavingAbono] = useState(false);

  const saveClient = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await actualizarClientePOS(editingId, form);
        toast.success("Cliente actualizado.");
      } else {
        await crearClientePOS(form);
        toast.success("Cliente creado.");
      }
      setForm(emptyClient);
      setEditingId(null);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se guardó el cliente.");
    } finally {
      setSaving(false);
    }
  };

  const selectClient = async (client: POSCliente) => {
    setSelectedClientId(client.id_cliente);
    setLoadingStatement(true);
    try {
      const data = await obtenerEstadoCuentaPOS(client.id_cliente);
      setStatement(data);
      const open = data.creditos.find((item) => item.estado !== "PAGADO" && item.estado !== "CANCELADO");
      setAbonoCreditId(open ? String(open.id_credito) : "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se cargó el estado de cuenta.");
    } finally {
      setLoadingStatement(false);
    }
  };

  const saveInstallment = async () => {
    const amount = Number(abonoAmount || 0);
    if (!abonoCreditId || amount <= 0) return;
    setSavingAbono(true);
    try {
      await registrarAbonoPOS(Number(abonoCreditId), {
        monto: amount,
        metodo: abonoMethod,
        referencia: abonoReference.trim() || null,
      });
      toast.success("Abono registrado.");
      setAbonoAmount("");
      setAbonoReference("");
      await onChanged();
      const client = clients.find((item) => item.id_cliente === selectedClientId);
      if (client) await selectClient(client);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se registró el abono.");
    } finally {
      setSavingAbono(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" /> {editingId ? "Editar cliente" : "Nuevo cliente"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Nombre" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Teléfono" value={form.telefono || ""} onChange={(event) => setForm({ ...form, telefono: event.target.value })} />
            <Input placeholder="Correo" value={form.email || ""} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Input placeholder="RFC opcional" value={form.rfc || ""} onChange={(event) => setForm({ ...form, rfc: event.target.value })} />
            <Input type="number" min="0" step="0.01" placeholder="Límite de crédito" value={form.limite_credito || ""} onChange={(event) => setForm({ ...form, limite_credito: Number(event.target.value || 0) })} />
            <Input type="number" min="0" placeholder="Días de crédito" value={form.dias_credito || ""} onChange={(event) => setForm({ ...form, dias_credito: Number(event.target.value || 0) })} />
          </div>
          <Input placeholder="Dirección" value={form.direccion || ""} onChange={(event) => setForm({ ...form, direccion: event.target.value })} />
          <textarea className="min-h-20 w-full rounded-md border bg-background p-3 text-sm" placeholder="Notas" value={form.notas || ""} onChange={(event) => setForm({ ...form, notas: event.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={(event) => setForm({ ...form, activo: event.target.checked })} /> Cliente activo</label>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={saving} onClick={saveClient}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingId ? "Guardar cambios" : "Crear cliente"}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(emptyClient); }}>Cancelar</Button>}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader><CardTitle>Clientes</CardTitle></CardHeader>
          <CardContent className="max-h-[420px] overflow-auto">
            <div className="space-y-2">
              {clients.map((client) => (
                <div key={client.id_cliente} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <button type="button" className="text-left" onClick={() => void selectClient(client)}>
                    <p className="font-semibold">{client.nombre}</p>
                    <p className="text-sm text-muted-foreground">Saldo {money(client.saldo)} · vencido {money(client.vencido)}</p>
                  </button>
                  <div className="flex gap-2">
                    <Badge variant={client.activo ? "default" : "secondary"}>{client.activo ? "Activo" : "Inactivo"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditingId(client.id_cliente);
                      setForm({
                        nombre: client.nombre,
                        telefono: client.telefono || "",
                        email: client.email || "",
                        rfc: client.rfc || "",
                        direccion: client.direccion || "",
                        limite_credito: client.limite_credito,
                        dias_credito: client.dias_credito,
                        notas: client.notas || "",
                        activo: client.activo,
                      });
                    }}>Editar</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Estado de cuenta y abonos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {loadingStatement && <Loader2 className="h-5 w-5 animate-spin" />}
            {!statement && !loadingStatement && <p className="text-sm text-muted-foreground">Selecciona un cliente para revisar sus créditos.</p>}
            {statement && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="Saldo" value={money(statement.cliente.saldo)} />
                  <Metric label="Vencido" value={money(statement.cliente.vencido)} />
                  <Metric label="Disponible" value={money(statement.cliente.credito_disponible)} />
                </div>
                <div className="space-y-2">
                  {statement.creditos.map((credit) => (
                    <div key={credit.id_credito} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div><p className="font-semibold">{credit.folio_venta || `Crédito ${credit.id_credito}`}</p><p className="text-sm text-muted-foreground">Vence {credit.fecha_vencimiento}</p></div>
                        <div className="text-right"><Badge>{credit.estado}</Badge><p className="mt-1 font-bold">{money(credit.saldo)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <select className="h-10 rounded-md border bg-background px-3" value={abonoCreditId} onChange={(event) => setAbonoCreditId(event.target.value)}>
                    <option value="">Selecciona crédito</option>
                    {statement.creditos.filter((item) => item.estado !== "PAGADO" && item.estado !== "CANCELADO").map((item) => <option key={item.id_credito} value={item.id_credito}>{item.folio_venta} · {money(item.saldo)}</option>)}
                  </select>
                  <Input type="number" min="0" step="0.01" placeholder="Monto" value={abonoAmount} onChange={(event) => setAbonoAmount(event.target.value)} />
                  <select className="h-10 rounded-md border bg-background px-3" value={abonoMethod} onChange={(event) => setAbonoMethod(event.target.value as PaymentMethod)}><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option></select>
                  <Button disabled={savingAbono} onClick={saveInstallment}>{savingAbono && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Abonar</Button>
                </div>
                {abonoMethod !== "efectivo" && <Input placeholder="Referencia del abono" value={abonoReference} onChange={(event) => setAbonoReference(event.target.value)} />}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cartera general</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Créditos abiertos" value={String(credits.filter((item) => !["PAGADO", "CANCELADO"].includes(item.estado)).length)} />
              <Metric label="Saldo total" value={money(credits.reduce((sum, item) => sum + (item.estado === "CANCELADO" ? 0 : item.saldo), 0))} />
              <Metric label="Vencidos" value={String(credits.filter((item) => item.estado !== "PAGADO" && item.estado !== "CANCELADO" && item.fecha_vencimiento < today()).length)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PromotionsPanel({
  promotions,
  isAdmin,
  onChanged,
}: {
  promotions: POSPromocion[];
  isAdmin: boolean;
  onChanged: () => Promise<void>;
}) {
  const deletePromotionV4 = async (promotion: any) => {
    const id = Number(promotion?.id_promocion ?? promotion?.id);
    if (!id || !window.confirm("¿Eliminar esta promoción? Esta acción no se puede deshacer.")) return;
    await eliminarPromocionPOSV4(id);
    await onChanged();
  };

  // RACKNOVA_PROMOCIONES_FORM_V2
  const initialPromotion = (): POSPromocionPayload => ({
    ...emptyPromotion,
    nombre: "",
    sku: "",
    cantidad_minima: 1,
    fecha_inicio: null,
    fecha_fin: null,
    activa: true,
  });

  const [form, setForm] = useState<POSPromocionPayload>(
    initialPromotion
  );
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<POSProducto[]>([]);
  const [searchingProduct, setSearchingProduct] = useState(false);

  const targetLabel = form.sku?.trim()
    ? `Solo el producto con SKU ${form.sku.trim()}`
    : "Todos los productos";

  const searchProduct = async () => {
    const value = productQuery.trim();
    if (!value) return;

    setSearchingProduct(true);
    try {
      setProductResults(await buscarProductosPOS(value));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo buscar el producto."
      );
    } finally {
      setSearchingProduct(false);
    }
  };

  const selectProduct = (product: POSProducto) => {
    setForm((current) => ({ ...current, sku: product.sku }));
    setProductQuery(`${product.nombre} · ${product.sku}`);
    setProductResults([]);
  };

  const promotionDescription = () => {
    const minimum = Math.max(Number(form.cantidad_minima || 1), 1);

    if (form.tipo === "PORCENTAJE") {
      return `${Number(form.porcentaje || 0)}% de descuento desde ${minimum} unidad(es).`;
    }

    if (form.tipo === "PRECIO_FIJO") {
      return `Precio promocional de ${money(
        Number(form.precio_fijo || 0)
      )} desde ${minimum} unidad(es).`;
    }

    return `Compra ${Number(form.compra_cantidad || 0)} y paga ${Number(
      form.paga_cantidad || 0
    )}.`;
  };

  const save = async () => {
    if (!isAdmin) return;

    if (form.nombre.trim().length < 2) {
      toast.error("Escribe un nombre para identificar la promoción.");
      return;
    }

    if (
      form.tipo === "PORCENTAJE" &&
      Number(form.porcentaje || 0) <= 0
    ) {
      toast.error("Indica un porcentaje mayor a cero.");
      return;
    }

    if (
      form.tipo === "PRECIO_FIJO" &&
      Number(form.precio_fijo || 0) <= 0
    ) {
      toast.error("Indica el precio promocional.");
      return;
    }

    if (
      form.tipo === "NXM" &&
      !(
        Number(form.compra_cantidad || 0) > 0 &&
        Number(form.paga_cantidad || 0) >= 0 &&
        Number(form.paga_cantidad || 0) <
          Number(form.compra_cantidad || 0)
      )
    ) {
      toast.error(
        "En N por M, la cantidad pagada debe ser menor a la comprada."
      );
      return;
    }

    if (
      form.fecha_inicio &&
      form.fecha_fin &&
      new Date(form.fecha_fin) <= new Date(form.fecha_inicio)
    ) {
      toast.error(
        "La fecha de finalización debe ser posterior al inicio."
      );
      return;
    }

    setSaving(true);
    try {
      await crearPromocionPOS({
        ...form,
        sku: form.sku?.trim() || null,
        cantidad_minima: Math.max(
          Number(form.cantidad_minima || 1),
          1
        ),
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        prioridad: Number(form.prioridad || 0),
      });

      toast.success(
        `Promoción creada. Se aplicará a: ${targetLabel}.`
      );
      setForm(initialPromotion());
      setProductQuery("");
      setProductResults([]);
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se guardó la promoción."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (promotion: POSPromocion) => {
    try {
      await actualizarPromocionPOS(promotion.id_promocion, {
        nombre: promotion.nombre,
        tipo: promotion.tipo,
        sku: promotion.sku || null,
        porcentaje: promotion.porcentaje,
        precio_fijo: promotion.precio_fijo,
        cantidad_minima: promotion.cantidad_minima,
        compra_cantidad: promotion.compra_cantidad,
        paga_cantidad: promotion.paga_cantidad,
        fecha_inicio: promotion.fecha_inicio || null,
        fecha_fin: promotion.fecha_fin || null,
        prioridad: promotion.prioridad,
        activa: !promotion.activa,
      });
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se actualizó la promoción."
      );
    }
  };

  const configuredDescription = (promotion: POSPromocion) => {
    if (promotion.tipo === "PORCENTAJE") {
      return `${promotion.porcentaje}% de descuento`;
    }

    if (promotion.tipo === "PRECIO_FIJO") {
      return `Precio fijo ${money(promotion.precio_fijo)}`;
    }

    return `${promotion.compra_cantidad} × ${promotion.paga_cantidad}`;
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Nueva promoción</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {!isAdmin && (
            <p className="rounded-lg bg-secondary p-3 text-sm">
              Solo el administrador puede crear promociones.
            </p>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold">
              Nombre de la promoción
            </label>
            <Input
              placeholder="Ejemplo: 15% aceite de agosto"
              value={form.nombre}
              onChange={(event) =>
                setForm({ ...form, nombre: event.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">
              Tipo de promoción
            </label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={form.tipo}
              onChange={(event) =>
                setForm({
                  ...form,
                  tipo: event.target
                    .value as POSPromocionPayload["tipo"],
                  porcentaje: 0,
                  precio_fijo: 0,
                  compra_cantidad: 0,
                  paga_cantidad: 0,
                })
              }
            >
              <option value="PORCENTAJE">
                Descuento porcentual
              </option>
              <option value="PRECIO_FIJO">
                Precio fijo por unidad
              </option>
              <option value="NXM">N por M / 3 × 2</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">
              Producto al que se aplicará
            </label>

            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nombre o SKU"
                value={productQuery}
                onChange={(event) => {
                  setProductQuery(event.target.value);
                  if (!event.target.value.trim()) {
                    setForm((current) => ({
                      ...current,
                      sku: "",
                    }));
                    setProductResults([]);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchProduct();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void searchProduct()}
                disabled={searchingProduct}
              >
                {searchingProduct ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {productResults.length > 0 && (
              <div className="divide-y rounded-lg border">
                {productResults.map((product) => (
                  <button
                    key={product.id_producto}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted"
                    onClick={() => selectProduct(product)}
                  >
                    <span>
                      <span className="block font-semibold">
                        {product.nombre}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {product.sku} · {product.ubicacion}
                      </span>
                    </span>
                    <span className="text-xs text-primary">
                      Seleccionar
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="font-semibold">Aplicará a:</p>
              <p>{targetLabel}</p>
              {form.sku?.trim() && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 px-2"
                  onClick={() => {
                    setForm((current) => ({
                      ...current,
                      sku: "",
                    }));
                    setProductQuery("");
                  }}
                >
                  Cambiar a todos los productos
                </Button>
              )}
            </div>
          </div>

          {form.tipo === "PORCENTAJE" && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">
                Porcentaje de descuento
              </label>
              <Input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                placeholder="Ejemplo: 15"
                value={form.porcentaje || ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    porcentaje: Number(event.target.value || 0),
                  })
                }
              />
            </div>
          )}

          {form.tipo === "PRECIO_FIJO" && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">
                Precio promocional por unidad
              </label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Ejemplo: 99.90"
                value={form.precio_fijo || ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    precio_fijo: Number(event.target.value || 0),
                  })
                }
              />
            </div>
          )}

          {form.tipo === "NXM" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold">
                  Cantidad que compra
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Ejemplo: 3"
                  value={form.compra_cantidad || ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      compra_cantidad: Number(
                        event.target.value || 0
                      ),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">
                  Cantidad que paga
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Ejemplo: 2"
                  value={form.paga_cantidad || ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      paga_cantidad: Number(
                        event.target.value || 0
                      ),
                    })
                  }
                />
              </div>
            </div>
          )}

          {form.tipo !== "NXM" && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">
                Cantidad mínima para activar
              </label>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                placeholder="Ejemplo: 1"
                value={form.cantidad_minima || ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    cantidad_minima: Number(
                      event.target.value || 1
                    ),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                En productos a granel se interpreta en kg o litros;
                en productos normales, en piezas.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold">
                Fecha y hora de inicio
              </label>
              <Input
                type="datetime-local"
                value={form.fecha_inicio?.slice(0, 16) || ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    fecha_inicio: event.target.value || null,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Vacío: comienza inmediatamente.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">
                Fecha y hora de finalización
              </label>
              <Input
                type="datetime-local"
                value={form.fecha_fin?.slice(0, 16) || ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    fecha_fin: event.target.value || null,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Vacío: no tiene vencimiento.
              </p>
            </div>
          </div>

          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              Opciones avanzadas
            </summary>

            <div className="mt-3 space-y-2">
              <label className="text-sm font-semibold">
                Prioridad
              </label>
              <Input
                type="number"
                step="1"
                placeholder="Opcional; por defecto 0"
                value={form.prioridad || ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    prioridad: Number(event.target.value || 0),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Solo sirve para ordenar promociones con condiciones
                similares. RackNova aplica automáticamente la opción
                más conveniente.
              </p>
            </div>
          </details>

          <div className="rounded-xl bg-secondary p-4 text-sm">
            <p className="font-semibold">Resumen antes de guardar</p>
            <p className="mt-1">{promotionDescription()}</p>
            <p className="mt-1">{targetLabel}.</p>
          </div>

          <Button
            className="w-full"
            disabled={!isAdmin || saving}
            onClick={save}
          >
            {saving && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Crear promoción
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promociones configuradas</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {promotions.length === 0 && (
            <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No hay promociones configuradas.
            </p>
          )}

          {promotions.map((promotion) => (
            <div
              key={promotion.id_promocion}
              className="rounded-xl border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{promotion.nombre}</p>
                  <p className="mt-1 text-sm">
                    {configuredDescription(promotion)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Aplica a:{" "}
                    <strong>
                      {promotion.sku
                        ? `SKU ${promotion.sku}`
                        : "Todos los productos"}
                    </strong>
                    {promotion.tipo !== "NXM" &&
                      ` · mínimo ${promotion.cantidad_minima || 1}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {promotion.fecha_inicio
                      ? `Inicia: ${new Date(
                          promotion.fecha_inicio
                        ).toLocaleString("es-MX")}`
                      : "Inicio inmediato"}
                    {" · "}
                    {promotion.fecha_fin
                      ? `Termina: ${new Date(
                          promotion.fecha_fin
                        ).toLocaleString("es-MX")}`
                      : "Sin vencimiento"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      promotion.activa ? "default" : "secondary"
                    }
                  >
                    {promotion.activa ? "Activa" : "Inactiva"}
                  </Badge>

                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void toggle(promotion)}
                    >
                      {promotion.activa
                        ? "Desactivar"
                        : "Activar"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}


function WholesaleRetailPanel({ isAdmin }: { isAdmin: boolean }) {
  const [rules, setRules] = useState<POSReglaMayoreo[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    sku: "",
    nombre: "",
    unidad: "kg" as "kg" | "litro",
    precio_menudeo: "",
    cantidad_mayoreo: "",
    precio_mayoreo: "",
    cantidad_mayoreo_especial: "",
    precio_mayoreo_especial: "",
    fecha_inicio: "",
    fecha_fin: "",
  });

  const loadRules = async () => {
    try {
      setRules(await listarMayoreoMenudeoPOS());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las reglas.");
    }
  };

  useEffect(() => {
    void loadRules();
  }, []);

  const submit = async (event: any) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await guardarMayoreoMenudeoPOS({
        sku: form.sku.trim(),
        nombre: form.nombre.trim(),
        unidad: form.unidad,
        precio_menudeo: Number(form.precio_menudeo),
        cantidad_mayoreo: Number(form.cantidad_mayoreo),
        precio_mayoreo: Number(form.precio_mayoreo),
        cantidad_mayoreo_especial: form.cantidad_mayoreo_especial
          ? Number(form.cantidad_mayoreo_especial)
          : null,
        precio_mayoreo_especial: form.precio_mayoreo_especial
          ? Number(form.precio_mayoreo_especial)
          : null,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        activo: true,
      });
      setForm({
        sku: "", nombre: "", unidad: "kg", precio_menudeo: "",
        cantidad_mayoreo: "", precio_mayoreo: "",
        cantidad_mayoreo_especial: "", precio_mayoreo_especial: "",
        fecha_inicio: "", fecha_fin: "",
      });
      await loadRules();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (rule: POSReglaMayoreo) => {
    if (!window.confirm(`¿Eliminar la regla de ${rule.nombre}?`)) return;
    try {
      await eliminarMayoreoMenudeoPOS(rule.id_regla);
      await loadRules();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar.");
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h3 className="text-lg font-bold">Configurar mayoreo y menudeo</h3>
          <p className="text-sm text-muted-foreground">
            Exclusivo para artículos vendidos por kg o litro.
          </p>
        </div>
        {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm"><span>SKU</span><input required className="w-full rounded-md border bg-background px-3 py-2" value={form.sku} onChange={(e) => setForm({...form, sku: e.target.value})} /></label>
          <label className="space-y-1 text-sm"><span>Nombre</span><input required className="w-full rounded-md border bg-background px-3 py-2" value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} /></label>
          <label className="space-y-1 text-sm"><span>Unidad</span><select className="w-full rounded-md border bg-background px-3 py-2" value={form.unidad} onChange={(e) => setForm({...form, unidad: e.target.value as "kg" | "litro"})}><option value="kg">Kilogramo</option><option value="litro">Litro</option></select></label>
          <label className="space-y-1 text-sm"><span>Precio menudeo</span><input required min="0.01" step="0.01" type="number" className="w-full rounded-md border bg-background px-3 py-2" value={form.precio_menudeo} onChange={(e) => setForm({...form, precio_menudeo: e.target.value})} /></label>
          <label className="space-y-1 text-sm"><span>Desde mayoreo</span><input required min="0.001" step="0.001" type="number" className="w-full rounded-md border bg-background px-3 py-2" value={form.cantidad_mayoreo} onChange={(e) => setForm({...form, cantidad_mayoreo: e.target.value})} /></label>
          <label className="space-y-1 text-sm"><span>Precio mayoreo</span><input required min="0.01" step="0.01" type="number" className="w-full rounded-md border bg-background px-3 py-2" value={form.precio_mayoreo} onChange={(e) => setForm({...form, precio_mayoreo: e.target.value})} /></label>
          <label className="space-y-1 text-sm"><span>Desde mayoreo especial</span><input min="0.001" step="0.001" type="number" className="w-full rounded-md border bg-background px-3 py-2" value={form.cantidad_mayoreo_especial} onChange={(e) => setForm({...form, cantidad_mayoreo_especial: e.target.value})} /></label>
          <label className="space-y-1 text-sm"><span>Precio especial</span><input min="0.01" step="0.01" type="number" className="w-full rounded-md border bg-background px-3 py-2" value={form.precio_mayoreo_especial} onChange={(e) => setForm({...form, precio_mayoreo_especial: e.target.value})} /></label>
          <label className="space-y-1 text-sm"><span>Inicio opcional</span><input type="datetime-local" className="w-full rounded-md border bg-background px-3 py-2" value={form.fecha_inicio} onChange={(e) => setForm({...form, fecha_inicio: e.target.value})} /></label>
          <label className="space-y-1 text-sm"><span>Fin opcional</span><input type="datetime-local" className="w-full rounded-md border bg-background px-3 py-2" value={form.fecha_fin} onChange={(e) => setForm({...form, fecha_fin: e.target.value})} /></label>
        </div>
        <button disabled={saving} className="w-full rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">
          {saving ? "Guardando..." : "Guardar regla"}
        </button>
      </form>

      <div className="space-y-3 rounded-xl border bg-card p-5">
        <div><h3 className="text-lg font-bold">Reglas configuradas</h3><p className="text-sm text-muted-foreground">El precio cambia automáticamente al alcanzar la cantidad.</p></div>
        {rules.map((rule) => (
          <div key={rule.id_regla} className="rounded-xl border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-bold">{rule.nombre}</p>
                <p className="text-sm text-muted-foreground">{rule.sku} · por {rule.unidad}</p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <div className="rounded-md bg-muted/50 p-2">Menudeo<br/><strong>${rule.precio_menudeo.toFixed(2)}</strong></div>
                  <div className="rounded-md bg-muted/50 p-2">Desde {rule.cantidad_mayoreo}<br/><strong>${rule.precio_mayoreo.toFixed(2)}</strong></div>
                  {rule.cantidad_mayoreo_especial != null && rule.precio_mayoreo_especial != null && <div className="rounded-md bg-muted/50 p-2">Desde {rule.cantidad_mayoreo_especial}<br/><strong>${rule.precio_mayoreo_especial.toFixed(2)}</strong></div>}
                </div>
              </div>
              <button type="button" onClick={() => void remove(rule)} className="rounded-md border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10">Eliminar</button>
            </div>
          </div>
        ))}
        {rules.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No hay reglas configuradas.</p>}
      </div>
    </div>
  );
}

function ProductsConfigPanel({ isAdmin }: { isAdmin: boolean }) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<POSProducto[]>([]);
  const [selected, setSelected] = useState<POSProducto | null>(null);
  const [config, setConfig] = useState<POSProductoConfiguracion | null>(null);
  const [saving, setSaving] = useState(false);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setProducts(await buscarProductosPOS(query));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se cargaron productos.");
    }
  };

  const choose = async (product: POSProducto) => {
    setSelected(product);
    const rows = await listarConfiguracionesProductoPOS(product.sku);
    const found = rows.find((item) => item.sku === product.sku);
    setConfig(
      found || {
        sku: product.sku,
        unidad_venta: "pieza",
        permite_fraccion: false,
        factor_inventario: 1,
        precio_normal: product.precio_venta_sugerido,
        precio_mayoreo: null,
        cantidad_mayoreo: 0,
        precio_minimo: null,
        activo: true,
      }
    );
  };

  const save = async () => {
    if (!selected || !config || !isAdmin) return;
    setSaving(true);
    try {
      await guardarConfiguracionProductoPOS(selected.sku, config);
      toast.success("Configuración POS guardada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se guardó la configuración.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader><CardTitle>Buscar producto</CardTitle></CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={search}><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SKU o nombre" /><Button type="submit"><Search className="h-4 w-4" /></Button></form>
          <div className="mt-3 space-y-2">
            {products.map((product) => <button key={product.id_producto} type="button" className="w-full rounded-lg border p-3 text-left hover:bg-muted" onClick={() => void choose(product)}><p className="font-semibold">{product.nombre}</p><p className="text-sm text-muted-foreground">{product.sku} · stock base {product.cantidad}</p></button>)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Precio, mayoreo y unidad de venta</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!selected || !config ? <p className="text-sm text-muted-foreground">Selecciona un producto.</p> : <>
            <div className="rounded-lg bg-secondary p-3"><strong>{selected.nombre}</strong><p className="text-sm text-muted-foreground">{selected.sku}</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Unidad: pieza, kg, metro..." value={config.unidad_venta} onChange={(event) => setConfig({ ...config, unidad_venta: event.target.value })} />
              <Input type="number" min="1" step="1" placeholder="Factor de inventario" value={config.factor_inventario} onChange={(event) => setConfig({ ...config, factor_inventario: Number(event.target.value || 1) })} />
              <Input type="number" min="0" step="0.01" placeholder="Precio normal" value={config.precio_normal ?? ""} onChange={(event) => setConfig({ ...config, precio_normal: event.target.value ? Number(event.target.value) : null })} />
              <Input type="number" min="0" step="0.01" placeholder="Precio mínimo" value={config.precio_minimo ?? ""} onChange={(event) => setConfig({ ...config, precio_minimo: event.target.value ? Number(event.target.value) : null })} />
              <Input type="number" min="0" step="0.01" placeholder="Precio mayoreo" value={config.precio_mayoreo ?? ""} onChange={(event) => setConfig({ ...config, precio_mayoreo: event.target.value ? Number(event.target.value) : null })} />
              <Input type="number" min="0" step="0.001" placeholder="Cantidad mayoreo" value={config.cantidad_mayoreo || ""} onChange={(event) => setConfig({ ...config, cantidad_mayoreo: Number(event.target.value || 0) })} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.permite_fraccion} onChange={(event) => setConfig({ ...config, permite_fraccion: event.target.checked })} /> Permitir cantidades fraccionadas</label>
            <p className="rounded-lg bg-muted p-3 text-sm">Ejemplo: inventario en gramos y venta en kg. Configura unidad <strong>kg</strong> y factor <strong>1000</strong>. Una venta de 0.350 kg descontará 350 unidades base.</p>
            <Button className="w-full" disabled={!isAdmin || saving} onClick={save}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar configuración</Button>
          </>}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsPanel({ isAdmin }: { isAdmin: boolean }) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [dateValue, setDateValue] = useState(today);
  const [boxValue, setBoxValue] = useState("");
  const [operatorValue, setOperatorValue] = useState("");
  const [report, setReport] = useState<POSReporteDiarioV5 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mxn = (value: unknown) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(Number(value || 0));
  const qty = (value: unknown) =>
    new Intl.NumberFormat("es-MX", {
      maximumFractionDigits: 3,
    }).format(Number(value || 0));
  const dateTime = (value: unknown) => {
    if (!value) return "—";
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime())
      ? String(value)
      : new Intl.DateTimeFormat("es-MX", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(parsed);
  };

  const loadReport = async () => {
    setLoading(true);
    setError("");
    try {
      setReport(
        await obtenerReporteDiarioPOSV5({
          fecha: dateValue,
          caja: boxValue || undefined,
          operador: operatorValue || undefined,
        })
      );
    } catch (cause) {
      setReport(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo generar el reporte diario."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [dateValue, boxValue, operatorValue]);

  const printReport = () => {
    if (!report) return;
    const escapeHtml = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const popup = window.open("", "_blank", "width=1100,height=820");
    if (!popup) {
      setError("Permite ventanas emergentes para imprimir el reporte.");
      return;
    }
    const paymentRows = report.metodos_pago
      .map((item) => `<tr><td>${escapeHtml(item.metodo)}</td><td class="num">${mxn(item.monto)}</td></tr>`)
      .join("");
    const boxRows = report.cajas
      .map((item) => `<tr><td>${escapeHtml(item.nombre)}</td><td class="num">${item.sesiones}</td><td class="num">${mxn(item.ventas)}</td><td class="num">-${mxn(item.devoluciones)}</td><td class="num">${mxn(item.venta_neta)}</td><td class="num">${mxn(item.diferencia)}</td></tr>`)
      .join("");
    const operatorRows = report.operadores
      .map((item) => `<tr><td>${escapeHtml(item.nombre)}</td><td class="num">${item.operaciones}</td><td class="num">${mxn(item.ventas)}</td><td class="num">${mxn(item.venta_neta)}</td><td class="num">${mxn(item.diferencia)}</td></tr>`)
      .join("");
    const productRows = report.productos
      .map((item) => `<tr><td><strong>${escapeHtml(item.nombre)}</strong><br><small>${escapeHtml(item.sku)}</small></td><td>${escapeHtml(item.unidad)}</td><td class="num">${qty(item.cantidad_vendida)}</td><td class="num">${qty(item.cantidad_devuelta)}</td><td class="num">${qty(item.cantidad_neta)}</td><td class="num">${mxn(item.ingreso_neto)}</td></tr>`)
      .join("");

    popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte diario POS ${escapeHtml(report.fecha)}</title><style>
      @page{size:letter landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0;font-size:10px}.header{display:flex;justify-content:space-between;border-bottom:3px solid #1f4fa3;padding-bottom:10px;margin-bottom:12px}.brand{font-size:24px;font-weight:800;color:#163d7a}.muted{color:#667085}.filters{margin-top:5px}.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin:10px 0 14px}.metric{border:1px solid #d7ddea;border-radius:7px;padding:8px}.metric span{display:block;color:#667085;text-transform:uppercase;font-size:8px}.metric strong{display:block;font-size:13px;margin-top:4px}h2{font-size:13px;color:#163d7a;margin:14px 0 6px;border-bottom:1px solid #cbd3e1;padding-bottom:4px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}table{width:100%;border-collapse:collapse;margin-bottom:8px}th{background:#edf3fb;text-align:left}th,td{border:1px solid #dce1ea;padding:5px;vertical-align:top}.num{text-align:right;white-space:nowrap}small{color:#667085}.footer{margin-top:14px;border-top:1px solid #dce1ea;padding-top:7px;text-align:center;color:#667085}
    </style></head><body><header class="header"><div><div class="brand">RackNova</div><div class="muted">Reporte diario profesional del Punto de Venta</div><div class="filters">Fecha: ${escapeHtml(report.fecha)} · Caja: ${escapeHtml(report.filtros.caja || "Todas")} · Operador: ${escapeHtml(report.filtros.operador || "Todos")}</div></div><div><strong>Generado</strong><br>${escapeHtml(dateTime(report.generado_en))}</div></header>
    <section class="metrics"><div class="metric"><span>Ventas</span><strong>${mxn(report.totales.ventas)}</strong></div><div class="metric"><span>Devoluciones</span><strong>-${mxn(report.totales.devoluciones)}</strong></div><div class="metric"><span>Venta neta</span><strong>${mxn(report.totales.ventas_netas)}</strong></div><div class="metric"><span>Ganancia</span><strong>${mxn(report.totales.ganancia)}</strong></div><div class="metric"><span>Operaciones</span><strong>${report.totales.numero_ventas}</strong></div><div class="metric"><span>Diferencias</span><strong>${mxn(report.totales.diferencias)}</strong></div></section>
    <div class="grid"><section><h2>Métodos de pago</h2><table><thead><tr><th>Método</th><th class="num">Monto</th></tr></thead><tbody>${paymentRows || '<tr><td colspan="2">Sin cobros registrados</td></tr>'}</tbody></table></section><section><h2>Resumen por caja</h2><table><thead><tr><th>Caja</th><th class="num">Ses.</th><th class="num">Ventas</th><th class="num">Dev.</th><th class="num">Neto</th><th class="num">Dif.</th></tr></thead><tbody>${boxRows || '<tr><td colspan="6">Sin cajas registradas</td></tr>'}</tbody></table></section></div>
    <h2>Resultados por operador</h2><table><thead><tr><th>Operador</th><th class="num">Operaciones</th><th class="num">Ventas</th><th class="num">Neto</th><th class="num">Diferencia</th></tr></thead><tbody>${operatorRows || '<tr><td colspan="5">Sin operadores registrados</td></tr>'}</tbody></table>
    <h2>Productos vendidos y devueltos</h2><table><thead><tr><th>Producto</th><th>Unidad</th><th class="num">Vendida</th><th class="num">Devuelta</th><th class="num">Neta</th><th class="num">Ingreso</th></tr></thead><tbody>${productRows || '<tr><td colspan="6">Sin productos registrados</td></tr>'}</tbody></table>
    <footer class="footer">Documento generado por RackNova · El diálogo de impresión permite guardarlo como PDF.</footer><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`);
    popup.document.close();
  };

  if (!isAdmin) return null;

  const totalSessions = report?.sesiones.length ?? 0;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Análisis operativo</p>
            <h3 className="text-2xl font-black">Reporte diario del Punto de Venta</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Ventas, devoluciones, métodos de pago, productos, cajas, operadores y diferencias reales del día.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[650px]">
            <label className="space-y-1 text-sm"><span>Fecha</span><input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2" /></label>
            <label className="space-y-1 text-sm"><span>Caja</span><select value={boxValue} onChange={(event) => setBoxValue(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2"><option value="">Todas las cajas</option>{(report?.catalogos.cajas || []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span>Operador</span><select value={operatorValue} onChange={(event) => setOperatorValue(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2"><option value="">Todos los operadores</option>{(report?.catalogos.operadores || []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => void loadReport()} disabled={loading} className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">{loading ? "Generando..." : "Actualizar"}</button>
          <button type="button" onClick={printReport} disabled={!report} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Imprimir / guardar PDF</button>
        </div>
      </section>

      {error && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
      {loading && !report && <p className="rounded-xl border p-8 text-center text-muted-foreground">Generando reporte diario...</p>}

      {report && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ["Ventas", mxn(report.totales.ventas)],
              ["Devoluciones", `-${mxn(report.totales.devoluciones)}`],
              ["Venta neta", mxn(report.totales.ventas_netas)],
              ["Ganancia", mxn(report.totales.ganancia)],
              ["Margen", `${report.totales.margen_porcentaje.toFixed(2)}%`],
              ["Operaciones", String(report.totales.numero_ventas)],
              ["Descuentos", mxn(report.totales.descuentos)],
              ["Costo", mxn(report.totales.costo)],
              ["Efectivo esperado", mxn(report.totales.efectivo_esperado)],
              ["Efectivo contado", mxn(report.totales.efectivo_contado)],
              ["Diferencias", mxn(report.totales.diferencias)],
              ["Sesiones", String(totalSessions)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><strong className="mt-1 block text-lg">{value}</strong></div>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-xl border bg-card p-5"><h3 className="font-bold">Métodos de pago</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{report.metodos_pago.map((item) => <div key={item.metodo} className="flex justify-between rounded-lg bg-muted/40 p-3 text-sm"><span>{item.metodo}</span><strong>{mxn(item.monto)}</strong></div>)}{report.metodos_pago.length === 0 && <p className="text-sm text-muted-foreground">No hay cobros registrados.</p>}</div></div>
            <div className="rounded-xl border bg-card p-5"><h3 className="font-bold">Control de efectivo</h3><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Fondos iniciales</span><strong className="block">{mxn(report.totales.fondo_inicial)}</strong></div><div className="rounded-lg bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Diferencia acumulada</span><strong className="block">{mxn(report.totales.diferencias)}</strong></div><div className="rounded-lg bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Ventas canceladas</span><strong className="block">{report.totales.ventas_canceladas}</strong></div><div className="rounded-lg bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Devoluciones</span><strong className="block">{report.totales.numero_devoluciones}</strong></div></div></div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="overflow-hidden rounded-xl border bg-card"><div className="border-b p-4"><h3 className="font-bold">Resultados por caja</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="bg-muted/40"><tr><th className="p-3 text-left">Caja</th><th className="p-3 text-right">Sesiones</th><th className="p-3 text-right">Ventas</th><th className="p-3 text-right">Dev.</th><th className="p-3 text-right">Neto</th><th className="p-3 text-right">Diferencia</th></tr></thead><tbody>{report.cajas.map((item) => <tr key={item.nombre} className="border-t"><td className="p-3 font-semibold">{item.nombre}</td><td className="p-3 text-right">{item.sesiones}</td><td className="p-3 text-right">{mxn(item.ventas)}</td><td className="p-3 text-right">-{mxn(item.devoluciones)}</td><td className="p-3 text-right font-semibold">{mxn(item.venta_neta)}</td><td className="p-3 text-right">{mxn(item.diferencia)}</td></tr>)}</tbody></table></div></div>
            <div className="overflow-hidden rounded-xl border bg-card"><div className="border-b p-4"><h3 className="font-bold">Resultados por operador</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="bg-muted/40"><tr><th className="p-3 text-left">Operador</th><th className="p-3 text-right">Operaciones</th><th className="p-3 text-right">Ventas</th><th className="p-3 text-right">Neto</th><th className="p-3 text-right">Diferencia</th></tr></thead><tbody>{report.operadores.map((item) => <tr key={item.nombre} className="border-t"><td className="p-3 font-semibold">{item.nombre}</td><td className="p-3 text-right">{item.operaciones}</td><td className="p-3 text-right">{mxn(item.ventas)}</td><td className="p-3 text-right font-semibold">{mxn(item.venta_neta)}</td><td className="p-3 text-right">{mxn(item.diferencia)}</td></tr>)}</tbody></table></div></div>
          </section>

          <section className="overflow-hidden rounded-xl border bg-card"><div className="border-b p-4"><h3 className="font-bold">Productos vendidos y devueltos</h3><p className="text-sm text-muted-foreground">Ordenados por ingreso neto.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="bg-muted/40"><tr><th className="p-3 text-left">Producto</th><th className="p-3 text-left">Unidad</th><th className="p-3 text-right">Vendida</th><th className="p-3 text-right">Devuelta</th><th className="p-3 text-right">Neta</th><th className="p-3 text-right">Ingreso</th></tr></thead><tbody>{report.productos.map((item) => <tr key={`${item.sku}-${item.unidad}`} className="border-t"><td className="p-3"><p className="font-semibold">{item.nombre}</p><p className="text-xs text-muted-foreground">{item.sku}</p></td><td className="p-3">{item.unidad}</td><td className="p-3 text-right">{qty(item.cantidad_vendida)}</td><td className="p-3 text-right">{qty(item.cantidad_devuelta)}</td><td className="p-3 text-right font-semibold">{qty(item.cantidad_neta)}</td><td className="p-3 text-right font-semibold">{mxn(item.ingreso_neto)}</td></tr>)}{report.productos.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No hay productos registrados para estos filtros.</td></tr>}</tbody></table></div></section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-xl border bg-card p-5"><h3 className="font-bold">Devoluciones del día</h3><div className="mt-3 max-h-96 space-y-2 overflow-y-auto">{report.devoluciones.map((item: any) => <div key={`${item.id_devolucion}-${item.id_sesion}`} className="rounded-lg border p-3 text-sm"><div className="flex justify-between gap-3"><div><p className="font-semibold">{item.folio}</p><p className="text-muted-foreground">{item.caja} · {item.operador_caja} · {dateTime(item.fecha)}</p><p className="mt-1">{item.motivo}</p></div><strong className="text-amber-700">-{mxn(item.monto)}</strong></div></div>)}{report.devoluciones.length === 0 && <p className="text-sm text-muted-foreground">No hubo devoluciones.</p>}</div></div>
            <div className="rounded-xl border bg-card p-5"><h3 className="font-bold">Movimientos de efectivo</h3><div className="mt-3 max-h-96 space-y-2 overflow-y-auto">{report.movimientos_efectivo.map((item: any, index) => <div key={`${item.id_movimiento || index}-${item.id_sesion}`} className="rounded-lg border p-3 text-sm"><div className="flex justify-between gap-3"><div><p className="font-semibold">{item.tipo}</p><p className="text-muted-foreground">{item.caja} · {item.operador_caja} · {dateTime(item.fecha)}</p><p className="mt-1">{item.motivo}</p></div><strong>{mxn(item.monto)}</strong></div></div>)}{report.movimientos_efectivo.length === 0 && <p className="text-sm text-muted-foreground">No hubo movimientos manuales.</p>}</div></div>
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-5"><div><h3 className="font-bold">Sesiones incluidas</h3><p className="text-sm text-muted-foreground">Detalle de apertura, cierre y resultado por sesión.</p></div>{report.sesiones.map((item) => <div key={item.sesion.id_sesion} className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2 xl:grid-cols-6"><div><span className="text-muted-foreground">Caja</span><p className="font-semibold">{item.sesion.caja_nombre}</p></div><div><span className="text-muted-foreground">Operador</span><p>{item.sesion.usuario}</p></div><div><span className="text-muted-foreground">Apertura</span><p>{dateTime(item.periodo.inicio)}</p></div><div><span className="text-muted-foreground">Cierre</span><p>{dateTime(item.periodo.fin)}</p></div><div><span className="text-muted-foreground">Venta neta</span><p className="font-semibold">{mxn(item.totales.ventas_netas)}</p></div><div><span className="text-muted-foreground">Diferencia</span><p className="font-semibold">{mxn(Number(item.sesion.diferencia || 0))}</p></div></div>)}{report.sesiones.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No existen operaciones para la fecha y filtros seleccionados.</p>}</section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-black">{value}</p></div>;
}
