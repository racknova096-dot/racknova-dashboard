import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Banknote,
  Barcode,
  Boxes,
  CircleDollarSign,
  CreditCard,
  Eye,
  History,
  Loader2,
  LockKeyhole,
  Minus,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  WalletCards,
  WifiOff,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import POSFase3Panel from "@/components/pos/POSFase3Panel";
import {
  abrirCajaPOS,
  buscarProductosPOS,
  cambiarEstadoPOS,
  cancelarVentaPOS,
  cerrarCajaPOS,
  crearCajaPOS,
  crearVentaPOS,
  cotizarVentaPOS,
  devolverVentaPOS,
  listarCajasPOS,
  listarSesionesCajaPOS,
  listarVentasPOS,
  obtenerEstadoPOS,
  obtenerSesionActualPOS,
  obtenerResumenSesionPOS,
  obtenerVentaPOS,
  registrarMovimientoEfectivoPOS,
  abrirCajaPermanentePOS,
  listarMayoreoMenudeoPOS,
  obtenerResumenSesionPOSV4,
  POSReglaMayoreo,
} from "@/lib/pos";
import type {
  POSCaja,
  POSCotizacion,
  POSEstado,
  POSProducto,
  POSSesionCaja,
  POSResumenTurno,
  POSVentaDetalle,
  POSVentaDetalleItem,
  POSVentaResumen,
} from "@/lib/pos";

type CartItem = POSProducto & {
  cantidadVenta: number;
  cantidadInput: string;
  descuentoPorcentaje: number;
  descuentoInput: string;
};

type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "mixto";
type MetodoReembolso = "efectivo" | "tarjeta" | "transferencia";
type POSWorkspacePanel = "sale" | "cash" | "history" | "tools";

const round2 = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const roundQuantity = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 1_000_000) /
  1_000_000;

const unidadVenta = (product: POSProducto | POSVentaDetalleItem) => {
  const unit = String(product.unidad_venta || "pieza").toLowerCase();
  if (unit === "litro") return "L";
  if (unit === "kg") return "kg";
  return "pza";
};

const factorVenta = (product: POSProducto | POSVentaDetalleItem) =>
  Math.max(Number(product.factor_inventario || 1), 1);

const pasoVenta = (product: POSProducto | POSVentaDetalleItem) =>
  factorVenta(product) > 1 ? 1 / factorVenta(product) : 1;

const cantidadDisponibleVenta = (product: POSProducto) =>
  Number(
    product.cantidad_disponible_venta ??
      Number(product.cantidad || 0) / factorVenta(product)
  );

const mostrarCantidad = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0));

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const getRole = () => (localStorage.getItem("rol") || "viewer").toLowerCase();

const createOperationId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const emitInventoryUpdated = (source: string) => {
  window.dispatchEvent(
    new CustomEvent("racknova:inventory-updated", {
      detail: { source, at: Date.now() },
    })
  );
};

// RACKNOVA_POS_SIMPLE_PRO_V5_1
export default function PuntoVenta() {
  const [estado, setEstado] = useState<POSEstado | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [cajas, setCajas] = useState<POSCaja[]>([]);
  const [sesion, setSesion] = useState<POSSesionCaja | null>(null);
  const [sesiones, setSesiones] = useState<POSSesionCaja[]>([]);
  const [loadingCash, setLoadingCash] = useState(false);

  const [selectedCaja, setSelectedCaja] = useState("");
  // RACKNOVA_INPUTS_LIBRES_POS
  const [fondoInicial, setFondoInicial] = useState("");
  const [newCajaName, setNewCajaName] = useState("Caja principal");

  const [cashType, setCashType] = useState("RETIRO");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [cashSaving, setCashSaving] = useState(false);

  const [cashCounted, setCashCounted] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [closingCash, setClosingCash] = useState(false);
  // RACKNOVA_CAJA_EQUIPO
  const [cashSummary, setCashSummary] =
    useState<POSResumenTurno | null>(null);
  const [teamSummary, setTeamSummary] =
    useState<POSResumenTurno | null>(null);
  // RACKNOVA_POS_V4_DASHBOARD
  const [sessionReport, setSessionReport] =
    useState<POSResumenTurno | null>(null);
  const [wholesaleRules, setWholesaleRules] =
    useState<POSReglaMayoreo[]>([]);
  const [loadingTeamSession, setLoadingTeamSession] =
    useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<POSProducto[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  // RACKNOVA_PROMOCIONES_COTIZACION
  const [quote, setQuote] = useState<POSCotizacion | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
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

  const [returnSale, setReturnSale] = useState<POSVentaDetalle | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, string>>(
    {}
  );
  const [returnReason, setReturnReason] = useState("");
  const [refundMethod, setRefundMethod] =
    useState<MetodoReembolso>("efectivo");
  const [returning, setReturning] = useState(false);

  // RACKNOVA_DEVOLUCIONES_VISIBLES
  const [salesSearch, setSalesSearch] = useState("");
  const returnsSectionRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const role = getRole();
  const isAdmin = role === "admin";
  const [workspacePanel, setWorkspacePanel] = useState<POSWorkspacePanel>("sale");

  const loadState = useCallback(async () => {
    setLoadingState(true);
    try {
      setEstado(await obtenerEstadoPOS());
    } catch (error) {
      setEstado(null);
      toast.error(
        error instanceof Error ? error.message : "No se pudo consultar el POS."
      );
    } finally {
      setLoadingState(false);
    }
  }, []);

  const loadCash = useCallback(async () => {
    if (!estado?.habilitado) return;
    setLoadingCash(true);
    try {
      const [boxList, currentSession, history] = await Promise.all([
        listarCajasPOS(),
        obtenerSesionActualPOS(),
        listarSesionesCajaPOS(20),
      ]);
      setCajas(boxList);
      setSesion(currentSession.sesion);
      setSesiones(history);
      if (!selectedCaja) {
        const first = boxList.find((box) => box.activa);
        if (first) setSelectedCaja(String(first.id_caja));
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cargar la información de caja."
      );
    } finally {
      setLoadingCash(false);
    }
  }, [estado?.habilitado, selectedCaja]);

  const loadSales = useCallback(async () => {
    if (!estado?.habilitado) return;
    setLoadingSales(true);
    try {
      setVentas(await listarVentasPOS(50));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cargar el historial."
      );
    } finally {
      setLoadingSales(false);
    }
  }, [estado?.habilitado]);

  const refreshPOS = useCallback(async () => {
    await Promise.all([loadCash(), loadSales()]);
  }, [loadCash, loadSales]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (estado?.habilitado) {
      void refreshPOS();
    }
  }, [estado?.habilitado, refreshPOS]);

  useEffect(() => {
    if (sesion?.estado === "ABIERTA") {
      window.setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [sesion?.estado]);

  useEffect(() => {
    if (!isAdmin || !estado?.habilitado) return;

    const timer = window.setInterval(() => {
      void listarSesionesCajaPOS(100)
        .then(setSesiones)
        .catch(() => undefined);
    }, 10_000);

    return () => window.clearInterval(timer);
  }, [estado?.habilitado, isAdmin]);


  useEffect(() => {
    if (!sesion?.id_sesion || sesion.estado !== "ABIERTA") {
      setSessionReport(null);
      return;
    }

    void refreshCurrentSessionReport(sesion.id_sesion);
    const timer = window.setInterval(() => {
      void refreshCurrentSessionReport(sesion.id_sesion);
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [sesion?.id_sesion, sesion?.estado]);

  useEffect(() => {
    void listarMayoreoMenudeoPOS()
      .then(setWholesaleRules)
      .catch(() => setWholesaleRules([]));
  }, [sesion?.id_sesion]);

  const localTotals = useMemo(
    () =>
      cart.reduce(
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
      ),
    [cart]
  );

  const cartQuantityError = useMemo(() => {
    for (const item of cart) {
      const raw = item.cantidadInput.trim();

      if (raw === "") {
        return `Captura la cantidad de ${item.nombre}.`;
      }

      const value = Number(raw);
      const step = pasoVenta(item);
      const available = cantidadDisponibleVenta(item);

      if (!Number.isFinite(value) || value <= 0) {
        return `La cantidad de ${item.nombre} debe ser mayor a cero.`;
      }

      if (value > available + 0.000001) {
        return `Stock disponible de ${item.nombre}: ${mostrarCantidad(
          available
        )} ${unidadVenta(item)}.`;
      }

      if (
        Math.abs(
          value * factorVenta(item) - Math.round(value * factorVenta(item))
        ) > 0.000001
      ) {
        return `Usa incrementos de ${mostrarCantidad(step)} ${unidadVenta(
          item
        )} para ${item.nombre}.`;
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
      efectivo_recibido: null,
      id_cliente: null,
      tipo_venta: "CONTADO" as const,
      fecha_vencimiento: null,
    }),
    [cart]
  );

  useEffect(() => {
    if (cart.length === 0 || cartQuantityError) {
      setQuote(null);
      setQuoteError(null);
      setQuoting(false);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setQuoting(true);
      setQuoteError(null);

      try {
        const response = await cotizarVentaPOS(quotePayload);
        if (!cancelled) setQuote(response);
      } catch (error) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(
            error instanceof Error
              ? error.message
              : "No se pudo calcular promociones y precios."
          );
        }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cart.length, cartQuantityError, quotePayload]);

  const totals = useMemo(() => {
    if (!quote || quote.items.length !== cart.length) {
      return {
        ...localTotals,
        automaticDiscount: 0,
        manualDiscount: localTotals.discount,
      };
    }

    const subtotal = round2(
      quote.items.reduce((sum, item) => sum + item.line_list, 0)
    );
    const automaticDiscount = round2(
      quote.items.reduce(
        (sum, item) => sum + item.automatic_discount,
        0
      )
    );
    const manualDiscount = round2(
      quote.items.reduce(
        (sum, item) => sum + item.manual_discount_amount,
        0
      )
    );

    return {
      subtotal,
      automaticDiscount,
      manualDiscount,
      discount: round2(automaticDiscount + manualDiscount),
      total: round2(quote.total),
    };
  }, [cart.length, localTotals, quote]);

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

  const filteredSales = useMemo(() => {
    const search = salesSearch.trim().toLowerCase();

    if (!search) {
      return ventas;
    }

    return ventas.filter((sale) =>
      [
        sale.folio,
        sale.usuario,
        sale.cliente_nombre || "",
        sale.estado,
      ].some((value) =>
        String(value).toLowerCase().includes(search)
      )
    );
  }, [salesSearch, ventas]);

  const scrollToReturns = () => {
    returnsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const returnTotal = useMemo(() => {
    if (!returnSale) return 0;
    return returnSale.items.reduce((sum, item) => {
      const quantity = Number(returnQuantities[item.id_detalle] || 0);
      return round2(sum + quantity * item.precio_unitario_final);
    }, 0);
  }, [returnQuantities, returnSale]);

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
      toast.error(
        error instanceof Error ? error.message : "No se pudo cambiar el estado."
      );
    }
  };

  const createBox = async () => {
    const name = newCajaName.trim();
    if (name.length < 2) {
      toast.error("Escribe un nombre para la caja.");
      return;
    }
    try {
      const created = await crearCajaPOS(name);
      toast.success(created.mensaje);
      setNewCajaName("");
      await loadCash();
      setSelectedCaja(String(created.id_caja));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la caja.");
    }
  };

  const openCash = async () => {
    const boxId = Number(selectedCaja);
    if (!boxId) {
      toast.error("Selecciona una caja.");
      return;
    }
    setLoadingCash(true);
    try {
      const response = await abrirCajaPOS(boxId, Number(fondoInicial || 0));
      setSesion(response.sesion);
      toast.success(response.mensaje);
      await loadCash();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir la caja.");
    } finally {
      setLoadingCash(false);
    }
  };

  const saveCashMovement = async () => {
    const amount = Number(cashAmount || 0);
    if (amount <= 0 || cashReason.trim().length < 3) {
      toast.error("Captura un monto y un motivo válido.");
      return;
    }
    setCashSaving(true);
    try {
      const response = await registrarMovimientoEfectivoPOS({
        tipo: cashType,
        monto: amount,
        motivo: cashReason.trim(),
      });
      setSesion(response.sesion);
      setCashAmount("");
      setCashReason("");
      toast.success(response.mensaje);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo registrar el movimiento."
      );
    } finally {
      setCashSaving(false);
    }
  };

  const closeCash = async () => {
    if (cashCounted.trim() === "") {
      toast.error("Captura el efectivo contado.");
      return;
    }
    if (!window.confirm("¿Confirmas el cierre de caja? Ya no podrás vender hasta abrir una nueva sesión.")) {
      return;
    }
    setClosingCash(true);
    try {
      const response = await cerrarCajaPOS({
        efectivo_contado: Number(cashCounted),
        observaciones: closeNotes.trim() || null,
      });
      toast.success(response.mensaje);
      try {
        setCashSummary(
          await obtenerResumenSesionPOSV4(response.sesion.id_sesion)
        );
      } catch {
        setCashSummary(null);
        toast.error(
          "La caja se cerró correctamente, pero el reporte no pudo cargarse. Puedes abrirlo desde Últimos cortes."
        );
      }
      setCashCounted("");
      setCloseNotes("");
      setCart([]);
      setSesion(null);
      await loadCash();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cerrar la caja.");
    } finally {
      setClosingCash(false);
    }
  };

  const refreshCurrentSessionReport = async (
    sessionId: number | null | undefined = sesion?.id_sesion
  ) => {
    if (!sessionId) {
      setSessionReport(null);
      return null;
    }

    try {
      const report = await obtenerResumenSesionPOSV4(sessionId);
      setSessionReport(report);
      return report;
    } catch {
      return null;
    }
  };

  const getWholesalePrice = (item: any, quantity: number) => {
    const sku = String(item?.sku ?? item?.producto?.sku ?? "");
    const unit = String(
      item?.unidad_venta ?? item?.unidad ?? item?.producto?.unidad_venta ?? ""
    ).toLowerCase();
    const base = Number(
      item?.precio_unitario ?? item?.precio ?? item?.precio_venta ?? 0
    );

    if (!sku || !["kg", "litro", "l"].includes(unit)) return base;
    const rule = wholesaleRules.find((row) => row.sku === sku && row.activo);
    if (!rule) return base;

    const qty = Number(quantity || 0);
    if (
      rule.cantidad_mayoreo_especial != null &&
      rule.precio_mayoreo_especial != null &&
      qty >= Number(rule.cantidad_mayoreo_especial)
    ) {
      return Number(rule.precio_mayoreo_especial);
    }
    if (qty >= Number(rule.cantidad_mayoreo)) {
      return Number(rule.precio_mayoreo);
    }
    return Number(rule.precio_menudeo);
  };

  const renderCurrentSessionActivity = () => {
    if (!sesion || sesion.estado !== "ABIERTA") return null;

    const sales = sessionReport?.ventas ?? [];
    const returns = sessionReport?.devoluciones ?? [];

    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Historial y devoluciones de esta caja</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Solo muestra operaciones de {sesion.caja_nombre}, sesión #{sesion.id_sesion}.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void refreshCurrentSessionReport()}
            >
              Actualizar actividad
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="font-semibold">Ventas de la sesión ({sales.length})</p>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {sales.map((sale: any) => (
                <div key={sale.id_venta} className="flex justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{sale.folio}</p>
                    <p className="text-muted-foreground">{formatDate(sale.fecha)}</p>
                  </div>
                  <strong>{money(sale.total)}</strong>
                </div>
              ))}
              {sales.length === 0 && (
                <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                  Esta caja todavía no tiene ventas.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Devoluciones de la sesión ({returns.length})</p>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {returns.map((item: any) => (
                <div key={item.id_devolucion} className="flex justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{item.folio}</p>
                    <p className="text-muted-foreground">
                      {item.folio_venta || "Venta"} · {formatDate(item.fecha)}
                    </p>
                  </div>
                  <strong className="text-amber-700">-{money(item.monto)}</strong>
                </div>
              ))}
              {returns.length === 0 && (
                <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                  No hay devoluciones en esta caja.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const openTeamSession = async (
    row: POSSesionCaja
  ) => {
    if (!isAdmin) return;

    setLoadingTeamSession(row.id_sesion);

    try {
      setTeamSummary(
        await obtenerResumenSesionPOSV4(row.id_sesion)
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo consultar la caja."
      );
    } finally {
      setLoadingTeamSession(null);
    }
  };

  const closeSummary = () => {
    setCashSummary(null);
    setTeamSummary(null);
  };

  const activeTeamSessions = sesiones.filter(
    (row) => row.estado === "ABIERTA"
  );

  const renderTeamBoxes = () => {
    if (!isAdmin) return null;

    return (
      <Card className="border-blue-500/30">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                Cajas del equipo
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Supervisión de solo lectura. Se actualiza cada 10 segundos.
              </p>
            </div>
            <Badge variant="outline">
              {activeTeamSessions.length} abierta(s)
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">Caja</th>
                  <th className="p-3">Operador</th>
                  <th className="p-3">Apertura</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Ventas</th>
                  <th className="p-3 text-right">Efectivo esperado</th>
                  <th className="p-3 text-right">Consulta</th>
                </tr>
              </thead>
              <tbody>
                {activeTeamSessions.map((row) => (
                  <tr key={row.id_sesion} className="border-b">
                    <td className="p-3 font-semibold">
                      {row.caja_nombre}
                    </td>
                    <td className="p-3">{row.usuario}</td>
                    <td className="p-3">
                      {formatDate(row.fecha_apertura)}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          row.estado === "ABIERTA"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {row.estado}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {money(row.total_ventas)}
                    </td>
                    <td className="p-3 text-right">
                      {money(row.efectivo_esperado)}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          loadingTeamSession === row.id_sesion
                        }
                        onClick={() =>
                          void openTeamSession(row)
                        }
                      >
                        {loadingTeamSession === row.id_sesion ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="mr-2 h-4 w-4" />
                        )}
                        Ver caja
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {activeTeamSessions.length === 0 && (
              <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                No hay cajas abiertas para supervisar.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // RACKNOVA_POS_V5_DASHBOARD
  const printCashSummaryProfessional = (
    report: POSResumenTurno,
    format: "carta" | "ticket"
  ) => {
    const escapeHtml = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const moneyPrint = (value: unknown) =>
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
      }).format(Number(value || 0));
    const datePrint = (value: unknown) => {
      if (!value) return "—";
      const parsed = new Date(String(value));
      return Number.isNaN(parsed.getTime())
        ? escapeHtml(value)
        : new Intl.DateTimeFormat("es-MX", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(parsed);
    };
    const numberPrint = (value: unknown) =>
      new Intl.NumberFormat("es-MX", {
        maximumFractionDigits: 3,
      }).format(Number(value || 0));
    const companyName =
      localStorage.getItem("empresa_nombre") ||
      localStorage.getItem("company_name") ||
      "RackNova";

    const productRows = (report.movimientos_productos || [])
      .map(
        (item) => `
          <tr>
            <td><strong>${escapeHtml(item.nombre)}</strong><br><small>${escapeHtml(item.sku)}</small></td>
            <td>${escapeHtml(item.unidad_venta)}</td>
            <td class="num">${numberPrint(item.cantidad_vendida)}</td>
            <td class="num">${numberPrint(item.cantidad_devuelta)}</td>
            <td class="num">${numberPrint(item.cantidad_neta)}</td>
            <td class="num">${moneyPrint(item.ingreso_neto)}</td>
          </tr>`
      )
      .join("");

    const returnRows = (report.devoluciones || [])
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.folio)}</td>
            <td>${escapeHtml(item.folio_venta || item.id_venta)}</td>
            <td>${escapeHtml(item.motivo)}</td>
            <td class="num">-${moneyPrint(item.monto)}</td>
          </tr>`
      )
      .join("");

    const cashRows = (report.movimientos_efectivo || [])
      .map(
        (item) => `
          <tr>
            <td>${datePrint(item.fecha)}</td>
            <td>${escapeHtml(item.tipo)}</td>
            <td>${escapeHtml(item.motivo)}</td>
            <td class="num">${moneyPrint(item.monto)}</td>
          </tr>`
      )
      .join("");

    const isTicket = format === "ticket";
    const popup = window.open(
      "",
      "_blank",
      isTicket ? "width=440,height=760" : "width=1000,height=820"
    );
    if (!popup) {
      toast.error("Permite las ventanas emergentes para imprimir el resumen.");
      return;
    }

    popup.document.write(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Resumen ${escapeHtml(report.sesion.caja_nombre)} #${escapeHtml(report.sesion.id_sesion)}</title>
<style>
  @page { size: ${isTicket ? "80mm auto" : "letter"}; margin: ${isTicket ? "4mm" : "12mm"}; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #172033; font-family: Arial, Helvetica, sans-serif; font-size: ${isTicket ? "10px" : "11px"}; background: white; }
  .page { width: 100%; }
  .header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #1f4fa3; }
  .brand { font-size: ${isTicket ? "18px" : "24px"}; font-weight: 800; color: #163d7a; letter-spacing: .3px; }
  .subtitle { margin-top: 3px; color: #5b6474; }
  .folio { text-align: right; }
  .folio strong { display: block; font-size: ${isTicket ? "13px" : "16px"}; }
  .meta { display: grid; grid-template-columns: ${isTicket ? "1fr" : "repeat(3,1fr)"}; gap: 8px; margin: 12px 0; }
  .meta div, .metric { border: 1px solid #d9deea; border-radius: 7px; padding: 8px; }
  .label { color: #657083; font-size: .88em; text-transform: uppercase; letter-spacing: .4px; }
  .value { margin-top: 3px; font-weight: 700; }
  .metrics { display: grid; grid-template-columns: ${isTicket ? "repeat(2,1fr)" : "repeat(4,1fr)"}; gap: 7px; margin: 10px 0 14px; }
  .metric .value { font-size: ${isTicket ? "12px" : "15px"}; }
  h2 { margin: 15px 0 7px; font-size: ${isTicket ? "12px" : "14px"}; color: #163d7a; border-bottom: 1px solid #cbd3e1; padding-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th { background: #eef3fb; color: #27364f; text-align: left; padding: 6px; border: 1px solid #d9deea; font-size: .9em; }
  td { padding: 6px; border: 1px solid #e2e6ee; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .total { font-weight: 800; background: #f4f7fb; }
  .notes { min-height: 45px; border: 1px solid #d9deea; border-radius: 7px; padding: 8px; }
  .signatures { display: ${isTicket ? "none" : "grid"}; grid-template-columns: 1fr 1fr; gap: 70px; margin-top: 45px; }
  .signature { border-top: 1px solid #283448; text-align: center; padding-top: 6px; }
  .footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #d9deea; color: #6d7685; text-align: center; font-size: .88em; }
  .ticket-hide { display: ${isTicket ? "none" : "table-cell"}; }
  small { color: #6b7280; }
</style>
</head>
<body>
<div class="page">
  <header class="header">
    <div><div class="brand">${escapeHtml(companyName)}</div><div class="subtitle">Resumen profesional de cierre de caja</div></div>
    <div class="folio"><span class="label">Sesión</span><strong>#${escapeHtml(report.sesion.id_sesion)}</strong><span>${escapeHtml(report.sesion.estado)}</span></div>
  </header>

  <section class="meta">
    <div><span class="label">Caja</span><div class="value">${escapeHtml(report.sesion.caja_nombre)}</div></div>
    <div><span class="label">Operador</span><div class="value">${escapeHtml(report.sesion.usuario)}</div></div>
    <div><span class="label">Periodo</span><div class="value">${datePrint(report.periodo.inicio)}<br>${datePrint(report.periodo.fin)}</div></div>
  </section>

  <section class="metrics">
    <div class="metric"><span class="label">Fondo inicial</span><div class="value">${moneyPrint(report.sesion.fondo_inicial)}</div></div>
    <div class="metric"><span class="label">Ventas</span><div class="value">${moneyPrint(report.totales.ventas)}</div></div>
    <div class="metric"><span class="label">Devoluciones</span><div class="value">-${moneyPrint(report.totales.devoluciones)}</div></div>
    <div class="metric"><span class="label">Venta neta</span><div class="value">${moneyPrint(report.totales.ventas_netas)}</div></div>
    <div class="metric"><span class="label">Efectivo esperado</span><div class="value">${moneyPrint(report.sesion.efectivo_esperado)}</div></div>
    <div class="metric"><span class="label">Efectivo contado</span><div class="value">${report.sesion.efectivo_contado == null ? "Pendiente" : moneyPrint(report.sesion.efectivo_contado)}</div></div>
    <div class="metric"><span class="label">Diferencia</span><div class="value">${report.sesion.diferencia == null ? "Pendiente" : moneyPrint(report.sesion.diferencia)}</div></div>
    <div class="metric"><span class="label">Operaciones</span><div class="value">${escapeHtml(report.totales.numero_ventas)}</div></div>
  </section>

  <h2>Desglose de cobros</h2>
  <table><tbody>
    <tr><td>Efectivo de ventas</td><td class="num">${moneyPrint(report.sesion.efectivo_ventas)}</td></tr>
    <tr><td>Tarjeta</td><td class="num">${moneyPrint(report.sesion.tarjeta)}</td></tr>
    <tr><td>Transferencia</td><td class="num">${moneyPrint(report.sesion.transferencia)}</td></tr>
    <tr class="total"><td>Total neto</td><td class="num">${moneyPrint(report.totales.ventas_netas)}</td></tr>
  </tbody></table>

  <h2>Productos vendidos y devueltos</h2>
  <table>
    <thead><tr><th>Producto</th><th>Unidad</th><th class="num">Vendida</th><th class="num">Devuelta</th><th class="num">Neta</th><th class="num">Ingreso</th></tr></thead>
    <tbody>${productRows || '<tr><td colspan="6">No hay productos registrados.</td></tr>'}</tbody>
  </table>

  ${returnRows ? `<h2>Devoluciones</h2><table><thead><tr><th>Folio</th><th>Venta</th><th>Motivo</th><th class="num">Monto</th></tr></thead><tbody>${returnRows}</tbody></table>` : ""}
  ${cashRows ? `<h2>Movimientos de efectivo</h2><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Motivo</th><th class="num">Monto</th></tr></thead><tbody>${cashRows}</tbody></table>` : ""}

  <h2>Observaciones</h2>
  <div class="notes">${escapeHtml((report.sesion as any).observaciones || "Sin observaciones registradas.")}</div>

  <section class="signatures"><div class="signature">Firma del operador</div><div class="signature">Firma del supervisor</div></section>
  <footer class="footer">Documento generado por RackNova · ${datePrint(new Date().toISOString())}</footer>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script>
</body></html>`);
    popup.document.close();
  };

  const renderCashSummary = () => {
    const report = teamSummary || cashSummary;

    if (!report) return null;

    const readOnly = Boolean(teamSummary);

    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4">
        <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl border bg-background shadow-2xl">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background/95 p-5 backdrop-blur">
            <div>
              <div className="flex items-center gap-2 text-blue-600">
                <ReceiptText className="h-6 w-6" />
                <span className="font-semibold">
                  {readOnly
                    ? "Supervisión de caja · Solo lectura"
                    : "Caja cerrada correctamente"}
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-black">
                {report.sesion.caja_nombre}
              </h2>
              <p className="text-sm text-muted-foreground">
                {report.sesion.usuario} ·{" "}
                {formatDate(report.periodo.inicio)} a{" "}
                {formatDate(report.periodo.fin)}
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeSummary}
              aria-label="Cerrar resumen"
            >
              <XCircle className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-6 p-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Ventas
                  </p>
                  <p className="text-xl font-black">
                    {money(report.totales.ventas)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Devoluciones
                  </p>
                  <p className="text-xl font-black text-amber-700">
                    -{money(report.totales.devoluciones)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Venta neta
                  </p>
                  <p className="text-xl font-black">
                    {money(report.totales.ventas_netas)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Efectivo esperado
                  </p>
                  <p className="text-xl font-black">
                    {money(report.sesion.efectivo_esperado)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Efectivo contado
                  </p>
                  <p className="text-xl font-black">
                    {report.sesion.efectivo_contado == null
                      ? "Pendiente"
                      : money(report.sesion.efectivo_contado)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Diferencia
                  </p>
                  <p className="text-xl font-black">
                    {report.sesion.diferencia == null
                      ? "Pendiente"
                      : money(report.sesion.diferencia)}
                  </p>
                </CardContent>
              </Card>
            </section>

            <section className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
              <div className="rounded-xl bg-secondary p-4">
                <p className="text-sm text-muted-foreground">
                  Efectivo de ventas
                </p>
                <strong>{money(report.sesion.efectivo_ventas)}</strong>
              </div>
              <div className="rounded-xl bg-secondary p-4">
                <p className="text-sm text-muted-foreground">
                  Tarjeta
                </p>
                <strong>{money(report.sesion.tarjeta)}</strong>
              </div>
              <div className="rounded-xl bg-secondary p-4">
                <p className="text-sm text-muted-foreground">
                  Transferencia
                </p>
                <strong>{money(report.sesion.transferencia)}</strong>
              </div>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>
                  Productos, ubicaciones y movimientos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Folio</th>
                        <th className="p-3">Ubicación</th>
                        <th className="p-3">Producto</th>
                        <th className="p-3">Unidad</th>
                        <th className="p-3 text-right">Vendida</th>
                        <th className="p-3 text-right">Devuelta</th>
                        <th className="p-3 text-right">Neta</th>
                        <th className="p-3 text-right">Ingreso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.movimientos_productos.map((item) => (
                        <tr
                          key={`${item.id_venta}-${item.id_detalle}`}
                          className="border-b"
                        >
                          <td className="p-3">
                            {formatDate(item.fecha)}
                          </td>
                          <td className="p-3 font-semibold">
                            {item.folio}
                          </td>
                          <td className="p-3">{item.ubicacion}</td>
                          <td className="p-3">
                            <p className="font-semibold">
                              {item.nombre}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.sku}
                            </p>
                          </td>
                          <td className="p-3">
                            {item.unidad_venta}
                          </td>
                          <td className="p-3 text-right">
                            {item.cantidad_vendida}
                          </td>
                          <td className="p-3 text-right">
                            {item.cantidad_devuelta}
                          </td>
                          <td className="p-3 text-right font-semibold">
                            {item.cantidad_neta}
                          </td>
                          <td className="p-3 text-right">
                            {money(item.ingreso_neto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Devoluciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.devoluciones.map((item) => (
                    <div
                      key={item.id_devolucion}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-semibold">
                            {item.folio}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Venta {item.folio_venta || item.id_venta} ·{" "}
                            {formatDate(item.fecha)}
                          </p>
                          <p className="mt-1 text-sm">
                            {item.motivo}
                          </p>
                        </div>
                        <strong className="text-amber-700">
                          -{money(item.monto)}
                        </strong>
                      </div>
                    </div>
                  ))}

                  {report.devoluciones.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No hubo devoluciones en esta sesión.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Movimientos de efectivo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.movimientos_efectivo.map((item) => (
                    <div
                      key={item.id_movimiento}
                      className="flex justify-between gap-4 rounded-xl border p-4"
                    >
                      <div>
                        <p className="font-semibold">{item.tipo}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.motivo} · {formatDate(item.fecha)}
                        </p>
                      </div>
                      <strong>{money(item.monto)}</strong>
                    </div>
                  ))}

                  {report.movimientos_efectivo.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No hubo movimientos manuales de efectivo.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeSummary}
              >
                Cerrar resumen
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => printCashSummaryProfessional(report, "ticket")}
              >
                <Printer className="mr-2 h-4 w-4" />
                Ticket 80 mm
              </Button>
              <Button
                type="button"
                onClick={() => printCashSummaryProfessional(report, "carta")}
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir carta / PDF
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const addProduct = (product: POSProducto) => {
    if (!sesion) {
      toast.error("Abre una caja antes de vender.");
      return;
    }

    const available = cantidadDisponibleVenta(product);
    const step = pasoVenta(product);

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
        },
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

  const updateQuantity = (sku: string, direction: -1 | 1) => {
    setCart((current) =>
      current.map((item) => {
        if (item.sku !== sku) return item;

        const step = pasoVenta(item);
        const available = cantidadDisponibleVenta(item);
        const typed = item.cantidadInput.trim();
        const parsed = typed === "" ? 0 : Number(typed);
        const base = Number.isFinite(parsed) ? parsed : item.cantidadVenta;
        const next = roundQuantity(base + direction * step);

        if (direction < 0 && next < step) {
          return item;
        }

        if (next > available + 0.000001) {
          toast.error(
            `Stock disponible: ${mostrarCantidad(available)} ${unidadVenta(item)}.`
          );
          return item;
        }

        return {
          ...item,
          cantidadVenta: next,
          cantidadInput: String(next),
        };
      })
    );
  };

  const setProductQuantityInput = (sku: string, raw: string) => {
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

  const setDiscountInput = (sku: string, raw: string) => {
    const max = isAdmin ? 100 : 10;

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
        if (!Number.isFinite(parsed)) {
          return {
            ...item,
            descuentoInput: raw,
            descuentoPorcentaje: 0,
          };
        }

        const safe = Math.min(Math.max(parsed, 0), max);
        return {
          ...item,
          descuentoInput: parsed > max ? String(max) : raw,
          descuentoPorcentaje: safe,
        };
      })
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
    const payments: Array<{
      metodo: "efectivo" | "tarjeta" | "transferencia";
      monto: number;
      referencia?: string | null;
    }> = [];
    const cash = Number(montoEfectivoMixto || 0);
    const card = Number(montoTarjetaMixto || 0);
    const transfer = Number(montoTransferenciaMixto || 0);
    if (cash > 0) payments.push({ metodo: "efectivo", monto: cash });
    if (card > 0) {
      payments.push({
        metodo: "tarjeta",
        monto: card,
        referencia: referencia.trim() || null,
      });
    }
    if (transfer > 0) {
      payments.push({
        metodo: "transferencia",
        monto: transfer,
        referencia: referencia.trim() || null,
      });
    }
    return payments;
  };

  const checkout = async () => {
    if (!sesion) {
      toast.error("Debes abrir una caja antes de vender.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Agrega al menos un producto.");
      return;
    }
    if (cartQuantityError) {
      toast.error(cartQuantityError);
      return;
    }

    if (quoting) {
      toast.error("Espera a que termine el cálculo de promociones.");
      return;
    }

    if (!quote) {
      toast.error(
        quoteError ||
          "No se pudo confirmar el total con promociones. Actualiza el carrito."
      );
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
    const operationId = createOperationId();
    try {
      const response = await crearVentaPOS({
        operacion_id: operationId,
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
      toast.success(
        response.duplicada
          ? `La venta ${response.folio} ya estaba registrada.`
          : `Venta ${response.folio} completada.`
      );
      emitInventoryUpdated("pos-sale");
      await refreshPOS();
      window.setTimeout(() => searchRef.current?.focus(), 100);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo registrar la venta."
      );
    } finally {
      setSelling(false);
    }
  };

  const openSale = async (id: number) => {
    try {
      setTicket(await obtenerVentaPOS(id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir la venta.");
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
            <td>${mostrarCantidad(item.cantidad)} ${unidadVenta(item)} × ${item.nombre}<br><small>${item.sku}</small></td>
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
      <!doctype html><html lang="es"><head><meta charset="utf-8" />
      <title>${sale.folio}</title><style>
      body{font-family:Arial,sans-serif;margin:24px;color:#111}h1,p{margin:4px 0;text-align:center}
      table{width:100%;border-collapse:collapse;margin:18px 0}td{padding:7px 0;border-bottom:1px dashed #bbb;vertical-align:top}
      .row{display:flex;justify-content:space-between;margin:6px 0}</style></head><body>
      <h1>RackNova</h1><p>${sale.folio}</p><p>${formatDate(sale.fecha)}</p><p>Cajero: ${sale.usuario}</p>
      <table>${items}</table><div class="row"><strong>Total</strong><strong>${money(sale.total)}</strong></div>
      ${payments}<div class="row"><span>Cambio</span><span>${money(sale.cambio)}</span></div>
      <p style="margin-top:28px">Gracias por su compra</p><script>window.onload=()=>{window.print();}</script>
      </body></html>
    `);
    popup.document.close();
  };

  const cancelSale = async (sale: POSVentaResumen) => {
    const reason = window.prompt(`Motivo para cancelar ${sale.folio}:`);
    if (!reason?.trim()) return;
    if (!window.confirm(`¿Confirmas cancelar ${sale.folio} y restaurar el inventario?`)) {
      return;
    }
    try {
      await cancelarVentaPOS(sale.id_venta, reason.trim());
      toast.success("Venta cancelada e inventario restaurado.");
      emitInventoryUpdated("pos-cancel");
      await refreshPOS();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cancelar la venta.");
    }
  };

  const beginReturn = async (sale: POSVentaResumen) => {
    try {
      const detail = await obtenerVentaPOS(sale.id_venta);
      setReturnSale(detail);
      setReturnQuantities({});
      setReturnReason("");
      setRefundMethod("efectivo");
      window.setTimeout(() => {
        document
          .querySelector<HTMLElement>(
            '[data-racknova-return-dialog="true"]'
          )
          ?.focus();
      }, 50);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir la venta.");
    }
  };

  const maxReturn = (item: POSVentaDetalleItem) =>
    Math.max(item.cantidad - item.cantidad_devuelta, 0);

  const submitReturn = async () => {
    if (!returnSale) return;
    const items = returnSale.items
      .map((item) => ({
        id_detalle: item.id_detalle,
        cantidad: Number(returnQuantities[item.id_detalle] || 0),
      }))
      .filter((item) => item.cantidad > 0);
    if (items.length === 0) {
      toast.error("Selecciona al menos una cantidad para devolver.");
      return;
    }
    if (returnReason.trim().length < 3) {
      toast.error("Escribe el motivo de la devolución.");
      return;
    }
    setReturning(true);
    try {
      const response = await devolverVentaPOS(returnSale.id_venta, {
        items,
        motivo: returnReason.trim(),
        metodo_reembolso: refundMethod,
      });
      toast.success(`${response.venta.folio}: reembolso ${money(response.monto)}.`);
      setReturnSale(null);
      emitInventoryUpdated("pos-return");
      await refreshPOS();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar la devolución.");
    } finally {
      setReturning(false);
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
              El inventario, catálogo, reportes, IA y MQTT continúan funcionando.
            </p>
            {!estado?.env_habilitado && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                Agrega <strong>POS_ENABLED=true</strong> en Render.
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

  if (!sesion) {
    const activeBoxes = cajas.filter((box) => box.activa);
    return (
      <main className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight">
              <LockKeyhole className="h-8 w-8 text-cyan-600 dark:text-cyan-300" /> Abrir caja
            </h1>
            <p className="text-muted-foreground">
              Debes abrir una sesión antes de registrar ventas.
            </p>
          </div>
          <Button variant="outline" onClick={() => void refreshPOS()} disabled={loadingCash}>
            <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
          </Button>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="border-b border-slate-100 pb-5 dark:border-slate-800"><CardTitle>Caja y fondo inicial</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {activeBoxes.length > 0 ? (
                <>
                  <div>
                    <label className="text-sm font-semibold">Caja</label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                      value={selectedCaja}
                      onChange={(event) => setSelectedCaja(event.target.value)}
                    >
                      <option value="">Selecciona una caja</option>
                      {activeBoxes.map((box) => (
                        <option key={box.id_caja} value={box.id_caja}>{box.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Fondo inicial</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ejemplo: 500"
                      value={fondoInicial}
                      onChange={(event) =>
                        setFondoInicial(event.target.value)
                      }
                    />
                  </div>
                  <Button className="h-12 w-full rounded-xl text-base font-semibold" onClick={openCash} disabled={loadingCash}>
                    {loadingCash && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Abrir caja
                  </Button>
                </>
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  No hay cajas activas. Un administrador debe crear la primera.
                </p>
              )}
            </CardContent>
          </Card>

          {isAdmin && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5" /> Abrir caja</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input value={newCajaName} onChange={(event) => setNewCajaName(event.target.value)} placeholder="Caja principal" />
                <Button variant="outline" className="w-full" onClick={createBox}>Abrir caja</Button>
              </CardContent>
            </Card>
          )}
        </div>
        {renderTeamBoxes()}
        <Card>
          <CardHeader><CardTitle>Últimos cortes</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Caja</th><th className="p-3">Usuario</th><th className="p-3">Apertura</th><th className="p-3">Estado</th><th className="p-3 text-right">Esperado</th><th className="p-3 text-right">Diferencia</th></tr></thead>
                <tbody>
                  {sesiones.slice(0, 10).map((row) => (
                    <tr key={row.id_sesion} className="border-b"><td className="p-3">{row.caja_nombre}</td><td className="p-3">{row.usuario}</td><td className="p-3">{formatDate(row.fecha_apertura)}</td><td className="p-3"><Badge variant={row.estado === "ABIERTA" ? "default" : "secondary"}>{row.estado}</Badge></td><td className="p-3 text-right">{money(row.efectivo_esperado)}</td><td className="p-3 text-right">{row.diferencia == null ? "—" : money(row.diferencia)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
                {/* RACKNOVA_POS_V5_ADMIN_SIN_CAJA */}
        <section className="space-y-3 rounded-2xl border bg-card p-4 md:p-5">
          <div>
            <h2 className="text-xl font-black">Administración comercial</h2>
            <p className="text-sm text-muted-foreground">
              Promociones, mayoreo y menudeo, clientes y crédito, y reporte diario están disponibles sin abrir una caja.
            </p>
          </div>

      {workspacePanel === "tools" && (
        <section className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Herramientas comerciales</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Funciones avanzadas disponibles sin saturar la pantalla principal de venta.
            </p>
          </div>
          <POSFase3Panel />
        </section>
      )}
        </section>
{renderCashSummary()}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight">
            <Store className="h-8 w-8 text-cyan-600 dark:text-cyan-300" /> Punto de Venta
          </h1>
          <p className="text-muted-foreground">
            {sesion.caja_nombre} · sesión #{sesion.id_sesion} · {sesion.usuario}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refreshPOS()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
          </Button>
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              onClick={scrollToReturns}
              className="border-amber-400/60 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Devoluciones
            </Button>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-800 dark:bg-slate-900/60">
            <Button
              type="button"
              size="sm"
              variant={workspacePanel === "sale" ? "default" : "ghost"}
              className="rounded-xl"
              onClick={() => {
                setWorkspacePanel("sale");
                window.setTimeout(() => searchRef.current?.focus(), 50);
              }}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Venta
            </Button>

            <Button
              type="button"
              size="sm"
              variant={workspacePanel === "cash" ? "default" : "ghost"}
              className="rounded-xl"
              onClick={() => setWorkspacePanel("cash")}
            >
              <CircleDollarSign className="mr-2 h-4 w-4" />
              Caja
            </Button>

            <Button
              type="button"
              size="sm"
              variant={workspacePanel === "history" ? "default" : "ghost"}
              className="rounded-xl"
              onClick={() => setWorkspacePanel("history")}
            >
              <History className="mr-2 h-4 w-4" />
              Historial
            </Button>

            <Button
              type="button"
              size="sm"
              variant={workspacePanel === "tools" ? "default" : "ghost"}
              className="rounded-xl"
              onClick={() => setWorkspacePanel("tools")}
            >
              <Boxes className="mr-2 h-4 w-4" />
              Herramientas
            </Button>
          </div>
          {isAdmin && <Button variant="outline" onClick={togglePOS}>Desactivar POS</Button>}
        </div>
      </section>


      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Área de trabajo
            </p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
              {workspacePanel === "sale" && "Venta rápida"}
              {workspacePanel === "cash" && "Control de caja"}
              {workspacePanel === "history" && "Historial y devoluciones"}
              {workspacePanel === "tools" && "Herramientas comerciales"}
            </p>
          </div>
          <p className="max-w-xl text-sm text-slate-500 dark:text-slate-400">
            {workspacePanel === "sale" && "Escanea, agrega productos y cobra. Todo lo demás permanece fuera del flujo principal."}
            {workspacePanel === "cash" && "Registra movimientos y realiza el cierre sin llenar la pantalla de venta."}
            {workspacePanel === "history" && "Consulta ventas, reimprime, cancela o inicia devoluciones cuando corresponda."}
            {workspacePanel === "tools" && "Clientes, crédito, promociones, precios, fracciones, reportes y venta avanzada."}
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 [&>div]:rounded-2xl [&>div]:border-slate-200 [&>div]:shadow-sm dark:[&>div]:border-slate-800">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fondo inicial</p><p className="text-xl font-black">{money(sesion.fondo_inicial)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ventas del turno</p><p className="text-xl font-black">{money(sesion.total_ventas)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Efectivo vendido</p><p className="text-xl font-black">{money(sesion.efectivo_ventas)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Efectivo esperado</p><p className="text-xl font-black">{money(sesion.efectivo_esperado)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Operaciones</p><p className="text-xl font-black">{sesion.ventas_completadas}</p></CardContent></Card>
      </section>

      {renderTeamBoxes()}
      {renderCurrentSessionActivity()}
      <section className="grid gap-5 xl:grid-cols-[minmax(280px,0.82fr)_minmax(420px,1.18fr)_390px] xl:items-start">
        <div className="contents">
          <Card className="rounded-3xl border-slate-200 bg-white shadow-lg shadow-slate-200/35 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none xl:col-start-1 xl:row-start-1">
            <CardHeader className="border-b border-slate-100 pb-5 dark:border-slate-800"><CardTitle className="flex items-center gap-2 text-xl"><Barcode className="h-5 w-5 text-cyan-600 dark:text-cyan-300" /> Escanear o buscar</CardTitle></CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={search} className="flex gap-3">
                <Input ref={searchRef} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código de barras, SKU o nombre" autoComplete="off" className="h-12 rounded-xl" />
                <Button type="submit" disabled={searching} className="h-12 rounded-xl px-5">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
              </form>
              {results.length > 0 && (
                <div className="mt-4 divide-y overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
                  {results.map((product) => (
                    <button key={product.id_producto} type="button" onClick={() => addProduct(product)} className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/70">
                      <div><p className="font-semibold">{product.nombre}</p><p className="text-sm text-muted-foreground">{product.sku} · {product.ubicacion} · Stock {mostrarCantidad(cantidadDisponibleVenta(product))} {unidadVenta(product)}</p></div><strong>{money(product.precio_venta_sugerido)} / {unidadVenta(product)}</strong>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200 bg-white shadow-lg shadow-slate-200/35 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none xl:col-start-2 xl:row-start-1">
            <CardHeader className="border-b border-slate-100 pb-5 dark:border-slate-800"><CardTitle className="flex items-center gap-2 text-xl"><ShoppingCart className="h-5 w-5 text-cyan-600 dark:text-cyan-300" /> Carrito <Badge variant="secondary">{cart.length}</Badge></CardTitle></CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-muted-foreground dark:border-slate-800 dark:bg-slate-900/30">Escanea o busca un producto para comenzar.</div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => {
                    const quoteItem = quote?.items.find((row) => row.sku === item.sku);

                    const finalUnit = quoteItem?.final_unit ?? item.precio_venta_sugerido * (1 - item.descuentoPorcentaje / 100);
                    return (
                      <div key={item.sku} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{item.nombre}</p><p className="text-sm text-muted-foreground">{item.sku} · {item.ubicacion} · Disponible {mostrarCantidad(cantidadDisponibleVenta(item))} {unidadVenta(item)}</p></div><Button size="icon" variant="ghost" onClick={() => setCart((current) => current.filter((row) => row.sku !== item.sku))}><Trash2 className="h-4 w-4" /></Button></div>
                        {quoteItem?.promotion_name && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                              Promoción aplicada: {quoteItem.promotion_name}
                            </span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-300">
                              -{money(quoteItem.automatic_discount)}
                            </span>
                          </div>
                        )}
                        <div className="mt-4 grid gap-4 lg:grid-cols-[190px_1fr_170px] lg:items-end">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Cantidad ({unidadVenta(item)})</label>
                            <div className="mt-1 flex items-center gap-2">
                              <Button size="icon" variant="outline" onClick={() => updateQuantity(item.sku, -1)}><Minus className="h-4 w-4" /></Button>
                              <Input
                                className="w-28 text-center font-bold"
                                type="number"
                                min={pasoVenta(item)}
                                max={cantidadDisponibleVenta(item)}
                                step={pasoVenta(item)}
                                placeholder="Cantidad"
                                value={item.cantidadInput}
                                aria-invalid={
                                  item.cantidadInput.trim() === ""
                                }
                                onChange={(event) =>
                                  setProductQuantityInput(
                                    item.sku,
                                    event.target.value
                                  )
                                }
                              />
                              <Button size="icon" variant="outline" onClick={() => updateQuantity(item.sku, 1)}><Plus className="h-4 w-4" /></Button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">
                              Descuento manual %
                            </label>
                            <Input
                              type="number"
                              min="0"
                              max={isAdmin ? 100 : 10}
                              step="0.01"
                              placeholder="Ejemplo: 10"
                              value={item.descuentoInput}
                              onChange={(event) =>
                                setDiscountInput(
                                  item.sku,
                                  event.target.value
                                )
                              }
                            />
                          </div>
                          <div className="text-right"><p className="text-xs text-muted-foreground">Precio por {unidadVenta(item)}</p><p className="font-black">{money(finalUnit)}</p></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="contents">
          <Card className="rounded-3xl border-cyan-200 bg-white shadow-2xl shadow-cyan-100/60 xl:sticky xl:top-24 xl:col-start-3 xl:row-start-1 xl:row-span-2 xl:self-start dark:border-cyan-500/25 dark:bg-slate-950 dark:shadow-none">
            <CardHeader className="border-b border-slate-100 pb-5 dark:border-slate-800"><CardTitle className="flex items-center gap-2 text-xl"><ReceiptText className="h-5 w-5 text-cyan-600 dark:text-cyan-300" /> Cobro</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <strong>{money(totals.subtotal)}</strong>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                  <span>Promociones automáticas</span>
                  <strong>-{money(totals.automaticDiscount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Descuento manual</span>
                  <strong>-{money(totals.manualDiscount)}</strong>
                </div>
                <div className="flex justify-between border-t pt-2 text-xl">
                  <span>Total</span>
                  <strong>{money(totals.total)}</strong>
                </div>
                {quoting && (
                  <p className="text-xs text-muted-foreground">
                    Calculando promociones vigentes...
                  </p>
                )}
                {quoteError && (
                  <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                    {quoteError}
                  </p>
                )}
              </div>
              <div><label className="text-sm font-semibold">Forma de pago</label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={metodoPago} onChange={(event) => setMetodoPago(event.target.value as MetodoPago)}><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option><option value="mixto">Pago mixto</option></select></div>
              {metodoPago === "mixto" && <div className="grid gap-3"><Input type="number" min="0" step="0.01" placeholder="Monto en efectivo" value={montoEfectivoMixto} onChange={(e) => setMontoEfectivoMixto(e.target.value)} /><Input type="number" min="0" step="0.01" placeholder="Monto en tarjeta" value={montoTarjetaMixto} onChange={(e) => setMontoTarjetaMixto(e.target.value)} /><Input type="number" min="0" step="0.01" placeholder="Monto por transferencia" value={montoTransferenciaMixto} onChange={(e) => setMontoTransferenciaMixto(e.target.value)} /></div>}
              {(metodoPago === "tarjeta" || metodoPago === "transferencia" || metodoPago === "mixto") && <Input placeholder="Referencia opcional" value={referencia} onChange={(e) => setReferencia(e.target.value)} />}
              {(metodoPago === "efectivo" || metodoPago === "mixto") && <div><label className="text-sm font-semibold">Efectivo recibido</label><Input type="number" min="0" step="0.01" value={efectivoRecibido} onChange={(e) => setEfectivoRecibido(e.target.value)} placeholder="0.00" /><div className="mt-2 flex justify-between rounded-lg bg-secondary p-3 font-bold"><span>Cambio</span><span>{money(change)}</span></div></div>}
              <Button className="h-14 w-full rounded-xl text-base font-bold shadow-lg" disabled={selling || quoting || !quote || Boolean(cartQuantityError) || cart.length === 0} onClick={checkout}>{selling ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : metodoPago === "efectivo" ? <Banknote className="mr-2 h-5 w-5" /> : <CreditCard className="mr-2 h-5 w-5" />}{quoting
                  ? "Calculando promociones..."
                  : `Cobrar ${money(totals.total)}`}
              </Button>
            </CardContent>
          </Card>

          {workspacePanel === "cash" && (
<Card className="rounded-3xl border-slate-200 bg-white shadow-lg shadow-slate-200/35 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none xl:col-start-1 xl:row-start-2">
            <CardHeader className="border-b border-slate-100 pb-5 dark:border-slate-800"><CardTitle className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-cyan-600 dark:text-cyan-300" /> Movimiento de efectivo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <select className="h-10 w-full rounded-md border bg-background px-3" value={cashType} onChange={(event) => setCashType(event.target.value)}><option value="ENTRADA">Entrada</option><option value="RETIRO">Retiro</option><option value="GASTO">Gasto</option><option value="DEPOSITO">Depósito / entrega</option>{isAdmin && <option value="AJUSTE_ENTRADA">Ajuste de entrada</option>}{isAdmin && <option value="AJUSTE_SALIDA">Ajuste de salida</option>}</select>
              <Input type="number" min="0" step="0.01" placeholder="Monto" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} />
              <Input placeholder="Motivo obligatorio" value={cashReason} onChange={(event) => setCashReason(event.target.value)} />
              <Button variant="outline" className="w-full" disabled={cashSaving} onClick={saveCashMovement}>{cashSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar</Button>
            </CardContent>
          </Card>
)}

          {workspacePanel === "cash" && (
<Card className="rounded-3xl border-slate-200 bg-white shadow-lg shadow-slate-200/35 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none xl:col-start-2 xl:row-start-2">
            <CardHeader className="border-b border-slate-100 pb-5 dark:border-slate-800"><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-cyan-600 dark:text-cyan-300" /> Cerrar caja</CardTitle></CardHeader>
            <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Efectivo esperado: <strong>{money(sesion.efectivo_esperado)}</strong></p><Input type="number" min="0" step="0.01" placeholder="Efectivo contado" value={cashCounted} onChange={(event) => setCashCounted(event.target.value)} /><textarea className="min-h-20 w-full rounded-md border bg-background p-3 text-sm" placeholder="Observaciones opcionales" value={closeNotes} onChange={(event) => setCloseNotes(event.target.value)} /><Button variant="destructive" className="h-12 w-full rounded-xl text-base font-semibold" disabled={closingCash} onClick={closeCash}>{closingCash && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cerrar turno</Button></CardContent>
          </Card>
)}
        </div>
      </section>

      {/* RACKNOVA_TICKET_RESUMEN_MODAL */}
      {ticket && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Resumen de la venta ${ticket.folio}`}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-background shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background/95 p-5 backdrop-blur">
              <div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <ReceiptText className="h-6 w-6" />
                  <span className="font-semibold">Venta completada</span>
                </div>
                <h2 className="mt-1 text-2xl font-black">
                  Ticket {ticket.folio}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {formatDate(ticket.fecha)}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setTicket(null)}
                aria-label="Cerrar resumen del ticket"
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 rounded-xl bg-secondary p-4 sm:grid-cols-4">
                <div>
                  <span className="text-xs text-muted-foreground">Cajero</span>
                  <p className="font-semibold">{ticket.usuario}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Cliente</span>
                  <p className="font-semibold">
                    {ticket.cliente_nombre || "Público general"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Modalidad</span>
                  <p className="font-semibold">
                    {ticket.tipo_venta || "CONTADO"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Estado</span>
                  <p className="font-semibold">{ticket.estado}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border">
                <div className="border-b bg-muted/50 px-4 py-3 font-semibold">
                  Productos
                </div>
                <div className="divide-y">
                  {ticket.items.map((item) => (
                    <div
                      key={item.id_detalle}
                      className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <div>
                        <p className="font-semibold">{item.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.sku} · {mostrarCantidad(item.cantidad)}{" "}
                          {unidadVenta(item)} ×{" "}
                          {money(item.precio_unitario_final)}
                        </p>
                        {item.promocion_nombre && (
                          <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                            Promoción: {item.promocion_nombre}
                          </p>
                        )}
                      </div>
                      <p className="text-right font-bold">
                        {money(item.subtotal)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="mb-3 font-semibold">Forma de pago</p>
                  <div className="space-y-2">
                    {ticket.pagos.map((payment) => (
                      <div
                        key={payment.id_pago}
                        className="flex justify-between gap-4 text-sm"
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
                    {ticket.pagos.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Venta a crédito sin pago inicial.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl bg-slate-50 p-5 dark:bg-slate-900/60">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <strong>{money(ticket.subtotal)}</strong>
                  </div>
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                    <span>Promociones</span>
                    <strong>
                      -{money(ticket.descuento_promociones || 0)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Descuento total</span>
                    <strong>-{money(ticket.descuento_total)}</strong>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-xl">
                    <span>Total</span>
                    <strong>{money(ticket.total)}</strong>
                  </div>
                  {ticket.efectivo_recibido > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Efectivo recibido</span>
                        <strong>{money(ticket.efectivo_recibido)}</strong>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Cambio</span>
                        <strong>{money(ticket.cambio)}</strong>
                      </div>
                    </>
                  )}
                  {Number(ticket.saldo_pendiente || 0) > 0 && (
                    <div className="flex justify-between border-t pt-2 text-amber-700 dark:text-amber-300">
                      <span>Saldo pendiente</span>
                      <strong>{money(ticket.saldo_pendiente || 0)}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTicket(null)}
                >
                  Nueva venta
                </Button>
                <Button
                  type="button"
                  onClick={() => printTicket(ticket)}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir ticket
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {returnSale && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div
            data-racknova-return-dialog="true"
            role="dialog"
            aria-modal="true"
            aria-label={`Devolución de ${returnSale.folio}`}
            tabIndex={-1}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-background shadow-2xl outline-none"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background/95 p-5 backdrop-blur">
              <div>
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <RotateCcw className="h-6 w-6" />
                  <span className="font-semibold">
                    Registrar devolución
                  </span>
                </div>
                <h2 className="mt-1 text-2xl font-black">
                  Venta {returnSale.folio}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Selecciona únicamente los artículos que el cliente devuelve.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setReturnSale(null)}
                aria-label="Cerrar devolución"
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-5 p-5">
              <div className="space-y-3">
                {returnSale.items.map((item) => {
                  const available = maxReturn(item);
                  const factor = Number(item.factor_inventario || 1);
                  const step = factor > 1 ? 1 / factor : 1;

                  return (
                    <div
                      key={item.id_detalle}
                      className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_170px] sm:items-end"
                    >
                      <div>
                        <p className="font-semibold">{item.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.sku} · vendidas {item.cantidad}{" "}
                          {item.unidad_venta || "pieza"} · ya devueltas{" "}
                          {item.cantidad_devuelta} · disponibles {available}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Cantidad a devolver
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max={available}
                          step={step}
                          disabled={available <= 0}
                          value={returnQuantities[item.id_detalle] || ""}
                          onChange={(event) => {
                            const raw = event.target.value;

                            setReturnQuantities((current) => ({
                              ...current,
                              [item.id_detalle]:
                                raw === ""
                                  ? ""
                                  : String(
                                      Math.min(
                                        Math.max(Number(raw), 0),
                                        available
                                      )
                                    ),
                            }));
                          }}
                          placeholder={
                            available > 0
                              ? `Máximo ${available}`
                              : "Sin artículos disponibles"
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold">
                    Motivo de la devolución
                  </label>
                  <Input
                    className="mt-1"
                    placeholder="Ejemplo: producto dañado"
                    value={returnReason}
                    onChange={(event) =>
                      setReturnReason(event.target.value)
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold">
                    Método de reembolso
                  </label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                    value={refundMethod}
                    onChange={(event) =>
                      setRefundMethod(
                        event.target.value as MetodoReembolso
                      )
                    }
                  >
                    <option value="efectivo">
                      Reembolso en efectivo
                    </option>
                    <option value="tarjeta">
                      Reembolso a tarjeta
                    </option>
                    <option value="transferencia">
                      Reembolso por transferencia
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-secondary p-4">
                <div>
                  <p className="font-semibold">Total a reembolsar</p>
                  <p className="text-xs text-muted-foreground">
                    El inventario se restaurará al confirmar.
                  </p>
                </div>
                <strong className="text-2xl">
                  {money(returnTotal)}
                </strong>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReturnSale(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={
                    returning ||
                    returnTotal <= 0 ||
                    returnReason.trim().length < 3
                  }
                  onClick={submitReturn}
                >
                  {returning && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirmar devolución
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        ref={returnsSectionRef}
        className="scroll-mt-6"
      >
        <Card className="border-amber-500/30">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-amber-600" />
                  Historial y devoluciones
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Busca la venta, pulsa Devolver y selecciona los artículos
                  que regresó el cliente.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadSales()}
                disabled={loadingSales}
              >
                {loadingSales && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar ventas
              </Button>
            </div>

            {isAdmin ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <strong>Cómo hacer una devolución:</strong>{" "}
                localiza una venta completada y pulsa el botón{" "}
                <strong>Devolver</strong>. Se abrirá el formulario de reembolso.
              </div>
            ) : (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                Las devoluciones requieren autorización de un administrador.
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={salesSearch}
                onChange={(event) =>
                  setSalesSearch(event.target.value)
                }
                placeholder="Buscar por folio, cajero, cliente o estado"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3">Folio</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Cajero</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id_venta} className="border-b">
                      <td className="p-3 font-semibold">{sale.folio}</td>
                      <td className="p-3">{formatDate(sale.fecha)}</td>
                      <td className="p-3">{sale.usuario}</td>
                      <td className="p-3">
                        {sale.cliente_nombre || "Público general"}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            sale.estado === "COMPLETADA"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {sale.estado}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-bold">
                        {money(sale.total)}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void openSale(sale.id_venta)
                            }
                          >
                            Ver
                          </Button>

                          {isAdmin &&
                            sale.estado === "COMPLETADA" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-400/60 text-amber-800 hover:bg-amber-500/10 dark:text-amber-200"
                                onClick={() =>
                                  void beginReturn(sale)
                                }
                              >
                                <RotateCcw className="mr-1 h-4 w-4" />
                                Devolver
                              </Button>
                            )}

                          {isAdmin &&
                            sale.estado === "COMPLETADA" && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  void cancelSale(sale)
                                }
                              >
                                <XCircle className="mr-1 h-4 w-4" />
                                Cancelar
                              </Button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredSales.length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  No se encontraron ventas con ese criterio.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <POSFase3Panel />

      {workspacePanel === "cash" && (
<Card>
        <CardHeader><CardTitle>Movimientos de efectivo del turno</CardTitle></CardHeader>
        <CardContent>
          {sesion.movimientos_efectivo.length === 0 ? <p className="text-sm text-muted-foreground">No hay movimientos manuales.</p> : <div className="space-y-2">{sesion.movimientos_efectivo.map((movement) => <div key={movement.id_movimiento} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-semibold">{movement.tipo}</p><p className="text-sm text-muted-foreground">{movement.motivo} · {formatDate(movement.fecha)}</p></div><strong>{money(movement.monto)}</strong></div>)}</div>}
        </CardContent>
      </Card>
)}
      {renderCashSummary()}
    </main>
  );
}
