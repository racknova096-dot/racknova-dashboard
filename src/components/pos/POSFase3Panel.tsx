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
  const [tab, setTab] = useState<TabKey>("venta");
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
      <Card className="border-primary/20">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <BadgeDollarSign className="h-5 w-5" />
              POS comercial — Fase 3
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => void loadBase()} disabled={loadingBase}>
              {loadingBase ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Actualizar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <TabButton active={tab === "venta"} onClick={() => setTab("venta")} icon={<ShoppingCart className="h-4 w-4" />} label="Venta avanzada" />
            <TabButton active={tab === "clientes"} onClick={() => setTab("clientes")} icon={<Users className="h-4 w-4" />} label="Clientes y crédito" />
            <TabButton active={tab === "promociones"} onClick={() => setTab("promociones")} icon={<Gift className="h-4 w-4" />} label="Promociones" />
            <TabButton active={tab === "productos"} onClick={() => setTab("productos")} icon={<Boxes className="h-4 w-4" />} label="Precios y fracciones" />
            <TabButton active={tab === "reportes"} onClick={() => setTab("reportes")} icon={<BarChart3 className="h-4 w-4" />} label="Reporte diario" />
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
      {tab === "promociones" && (
        <PromotionsPanel promotions={promotions} isAdmin={isAdmin} onChanged={loadBase} />
      )}
      {tab === "productos" && <ProductsConfigPanel isAdmin={isAdmin} />}
      {tab === "reportes" && <ReportsPanel isAdmin={isAdmin} />}
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
  const [dateValue, setDateValue] = useState(today());
  const [report, setReport] = useState<POSReporteDiario | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await obtenerReporteDiarioPOS(dateValue));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se generó el reporte.");
    } finally {
      setLoading(false);
    }
  }, [dateValue]);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async (format: "pdf" | "xlsx") => {
    setDownloading(true);
    try {
      await descargarReportePOS(dateValue, format);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se descargó el reporte.");
    } finally {
      setDownloading(false);
    }
  };

  const close = async () => {
    try {
      await cerrarReporteDiarioPOS(dateValue);
      toast.success("Reporte diario cerrado y guardado.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se cerró el reporte.");
    }
  };

  const movementRows = report?.movimientos_productos ?? [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>Reporte diario de ventas</span>
            <div className="flex flex-wrap gap-2">
              <Input className="w-auto" type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
              <Button variant="outline" onClick={() => void load()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
              <Button variant="outline" disabled={downloading} onClick={() => void download("pdf")}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" disabled={downloading} onClick={() => void download("xlsx")}>
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>
              {isAdmin && (
                <Button onClick={() => void close()}>
                  <FileCheck2 className="mr-2 h-4 w-4" />
                  Cerrar día
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {!report ? (
            <p className="text-sm text-muted-foreground">Sin información.</p>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Ventas netas" value={money(report.resumen.ventas_netas)} />
                <Metric label="Ganancia" value={money(report.resumen.ganancia)} />
                <Metric label="Ventas" value={String(report.resumen.numero_ventas)} />
                <Metric label="Margen" value={`${report.resumen.margen}%`} />
                <Metric label="Descuentos" value={money(report.resumen.descuentos)} />
                <Metric label="Devoluciones" value={money(report.resumen.monto_devoluciones)} />
                <Metric label="Costo" value={money(report.resumen.costo_mercancia)} />
                <Metric label="Abonos" value={money(report.resumen.abonos)} />
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-semibold">Productos más vendidos</h3>
                  <div className="space-y-2">
                    {report.productos.slice(0, 10).map((item) => (
                      <div key={item.sku} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{item.nombre}</p>
                          <p className="text-sm text-muted-foreground">{item.cantidad} {item.unidad_venta}</p>
                        </div>
                        <strong>{money(item.ingresos)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">Métodos de pago</h3>
                  <div className="space-y-2">
                    {Object.entries(report.metodos_pago).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                        <span className="capitalize">{key.replaceAll("_", " ")}</span>
                        <strong>{money(Number(value))}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">Conciliación física de salidas</h3>
                    <p className="text-sm text-muted-foreground">
                      Cada renglón corresponde a un producto vendido y conserva la ubicación desde la que salió.
                    </p>
                  </div>
                  <Badge variant="secondary">{movementRows.length} movimientos</Badge>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[1180px] text-sm">
                    <thead className="bg-muted/60">
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-3">Hora</th>
                        <th className="p-3">Folio</th>
                        <th className="p-3">Caja</th>
                        <th className="p-3">Cajero</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3">Producto</th>
                        <th className="p-3">Ubicación</th>
                        <th className="p-3 text-right">Vendida</th>
                        <th className="p-3 text-right">Devuelta</th>
                        <th className="p-3 text-right">Neta</th>
                        <th className="p-3 text-right">Ingresos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movementRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-muted-foreground">
                            No hay salidas registradas para esta fecha.
                          </td>
                        </tr>
                      ) : (
                        movementRows.map((item) => (
                          <tr key={`${item.id_venta}-${item.id_detalle}`} className="border-b last:border-0">
                            <td className="whitespace-nowrap p-3">
                              {new Date(item.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="whitespace-nowrap p-3 font-medium">{item.folio}</td>
                            <td className="p-3">{item.caja}</td>
                            <td className="p-3">{item.usuario}</td>
                            <td className="whitespace-nowrap p-3 font-mono text-xs">{item.sku}</td>
                            <td className="p-3">{item.nombre}</td>
                            <td className="p-3"><Badge variant="outline">{item.ubicacion}</Badge></td>
                            <td className="p-3 text-right">{item.cantidad_vendida} {item.unidad_venta}</td>
                            <td className="p-3 text-right">{item.cantidad_devuelta}</td>
                            <td className="p-3 text-right font-semibold">{item.cantidad_neta}</td>
                            <td className="p-3 text-right font-semibold">{money(item.ingresos)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Cortes de caja</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-2">Caja</th>
                        <th className="p-2">Usuario</th>
                        <th className="p-2 text-right">Esperado</th>
                        <th className="p-2 text-right">Contado</th>
                        <th className="p-2 text-right">Diferencia</th>
                        <th className="p-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.cortes.map((cut) => (
                        <tr key={cut.id_sesion} className="border-b">
                          <td className="p-2">{cut.caja_nombre}</td>
                          <td className="p-2">{cut.usuario}</td>
                          <td className="p-2 text-right">{money(cut.efectivo_esperado)}</td>
                          <td className="p-2 text-right">{cut.efectivo_contado == null ? "—" : money(cut.efectivo_contado)}</td>
                          <td className="p-2 text-right">{cut.diferencia == null ? "—" : money(cut.diferencia)}</td>
                          <td className="p-2"><Badge>{cut.estado}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-black">{value}</p></div>;
}
