import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";
import { useInventory } from "@/context/InventoryContext";
import { Product } from "@/types/inventory";
import {
  Card,
  
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  Bot,
  Boxes,
  Brain,
  CalendarClock,
  Check,
  Copy,
  Download,
  Lightbulb,
  Loader2,
  MapPinned,
  MessageSquare,
  PackageX,
  Percent,
  RefreshCcw,
  Send,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  source?: string | null;
  warning?: string | null;
  complete?: boolean;
  continuations?: number;
  finishReason?: string | null;
  tokenUsage?: TokenUsage | null;
};

type PriorityLevel = "Alta" | "Media" | "Monitoreo";

type ProductAnalysis = {
  sku: string;
  nombre: string;
  locationId: string;
  cantidad: number;
  stockMinimo: number;
  stockAlto: number;
  caducidad: string | null;
  diasCaducidad: number | null;
  cantidadVendida: number;
  ingresos: number;
  costos: number;
  ganancia: number;
  margen: number;
  descuentoSugerido: number;
  stockStatus: "bajo" | "normal" | "alto";
  score: number;
  prioridad: PriorityLevel;
  razones: string[];
};

type ParsedLocation = {
  rack: string;
  nivel: number;
  slot: number;
};

type LocationRecommendation = {
  productSku: string;
  referenceSku: string;
  referenceName: string;
  referenceLocationId: string;
  referenceSales: number;
  suggestedLocationId: string | null;
  alreadyWellPlaced: boolean;
  message: string;
};

const CHART_COLORS = {
  primary: "#2563eb",
  cyan: "#06b6d4",
  emerald: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  purple: "#8b5cf6",
  slate: "#64748b",
};

const PRIORITY_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#2563eb",
];

const STOCK_COLORS = [
  "#ef4444",
  "#10b981",
  "#2563eb",
];

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  color: "#0f172a",
  boxShadow:
    "0 10px 25px rgba(15, 23, 42, 0.15)",
};

const TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 700,
};

const TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 600,
};

const quickQuestions = [
  {
    title: "Descuentos",
    prompt:
      "¿Qué productos me recomiendas vender con descuento y por qué?",
    icon: Percent,
  },
  {
    title: "Caducidad",
    prompt:
      "¿Qué productos están próximos a caducar y qué debo hacer?",
    icon: CalendarClock,
  },
  {
    title: "Restock",
    prompt:
      "¿Qué productos debo resurtir primero según mi inventario?",
    icon: Boxes,
  },
  {
    title: "Baja rotación",
    prompt:
      "¿Qué productos tienen baja rotación o no se han vendido?",
    icon: TrendingDown,
  },
  {
    title: "Rentabilidad",
    prompt:
      "¿Qué productos son más rentables y cuáles tienen margen bajo?",
    icon: TrendingUp,
  },
  {
    title: "Ubicación",
    prompt:
      "¿Qué productos vigentes me conviene mover de ubicación dentro del rack? No incluyas productos vencidos.",
    icon: MapPinned,
  },
];

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hola, soy RACKNOVA IA. Puedo ayudarte a analizar inventario, caducidad, descuentos, rotación, rentabilidad, stock y ubicación de productos.",
  source: "racknova",
  complete: true,
  continuations: 0,
};

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));
}

function numberFormat(value: number) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function percent(value: number) {
  return `${numberFormat(value)}%`;
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "Sin caducidad";
  }

  const date = new Date(
    `${String(value).slice(0, 10)}T00:00:00`
  );

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDaysToExpiration(
  dateValue?: string | null
) {
  if (!dateValue) {
    return null;
  }

  const expirationDate = new Date(
    `${dateValue.slice(0, 10)}T00:00:00`
  );

  const today = new Date();

  const todayClean = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const diffMs =
    expirationDate.getTime() -
    todayClean.getTime();

  return Math.ceil(
    diffMs / (1000 * 60 * 60 * 24)
  );
}

function getSuggestedDiscount(
  days: number | null
) {
  if (days === null) {
    return 0;
  }

  /*
   * Un producto vencido no debe venderse
   * con descuento ni reubicarse.
   */
  if (days < 0) {
    return 0;
  }

  if (days <= 5) {
    return 40;
  }

  if (days <= 10) {
    return 30;
  }

  if (days <= 15) {
    return 20;
  }

  if (days <= 30) {
    return 10;
  }

  return 0;
}

function getStockStatus(
  product: Product
): "bajo" | "normal" | "alto" {
  const stockMinimo = Number(
    product.stock_minimo ?? 10
  );

  const stockAlto = Number(
    product.stock_alto ??
      stockMinimo * 3
  );

  if (
    product.cantidad <= stockMinimo
  ) {
    return "bajo";
  }

  if (
    product.cantidad >= stockAlto
  ) {
    return "alto";
  }

  return "normal";
}

function isExpired(
  product: ProductAnalysis
) {
  return (
    product.diasCaducidad !== null &&
    product.diasCaducidad < 0
  );
}

function getPriorityBadge(
  priority: PriorityLevel
) {
  if (priority === "Alta") {
    return (
      <Badge variant="destructive">
        Prioridad alta
      </Badge>
    );
  }

  if (priority === "Media") {
    return (
      <Badge className="bg-amber-500 hover:bg-amber-500">
        Prioridad media
      </Badge>
    );
  }

  return (
    <Badge className="bg-blue-600 hover:bg-blue-600">
      Monitoreo
    </Badge>
  );
}

function getStockBadge(
  status: "bajo" | "normal" | "alto"
) {
  if (status === "bajo") {
    return (
      <Badge variant="destructive">
        Stock bajo
      </Badge>
    );
  }

  if (status === "alto") {
    return (
      <Badge className="bg-blue-600 hover:bg-blue-600">
        Stock alto
      </Badge>
    );
  }

  return (
    <Badge variant="outline">
      Stock normal
    </Badge>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function productTooltipLabel(
  _label: unknown,
  payload: any[]
) {
  const item =
    payload?.[0]?.payload;

  return (
    item?.nombre ||
    item?.sku ||
    "Producto"
  );
}

function parseLocationId(
  locationId?: string | null
): ParsedLocation | null {
  if (!locationId) {
    return null;
  }

  const [
    rack,
    nivelText,
    slotText,
  ] = locationId.split("-");

  const nivel = Number(nivelText);
  const slot = Number(slotText);

  if (
    !rack ||
    !Number.isInteger(nivel) ||
    !Number.isInteger(slot)
  ) {
    return null;
  }

  return {
    rack,
    nivel,
    slot,
  };
}

function areLocationsNear(
  first: ParsedLocation,
  second: ParsedLocation
) {
  return (
    first.rack === second.rack &&
    first.nivel === second.nivel &&
    Math.abs(
      first.slot - second.slot
    ) === 1
  );
}

function sourceLabel(
  source?: string | null
) {
  if (source === "deepseek") {
    return "IA externa";
  }

  if (
    source ===
    "motor_interno_fallback"
  ) {
    return "Motor interno RackNova";
  }

  if (source === "racknova") {
    return "RackNova";
  }

  if (source === "error") {
    return "Error";
  }

  return source ?? "RackNova";
}

async function copyToClipboard(
  text: string
) {
  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(
      text
    );

    return;
  }

  const textarea =
    document.createElement(
      "textarea"
    );

  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";

  textarea.setAttribute(
    "readonly",
    "true"
  );

  document.body.appendChild(
    textarea
  );

  textarea.select();

  const copied =
    document.execCommand("copy");

  document.body.removeChild(
    textarea
  );

  if (!copied) {
    throw new Error(
      "No se pudo copiar la respuesta."
    );
  }
}

export default function RackNovaIA() {
  const {
    products,
    movements,
    locations,
  } = useInventory();

  const [
    question,
    setQuestion,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    copiedIndex,
    setCopiedIndex,
  ] = useState<number | null>(
    null
  );

  const [
    messages,
    setMessages,
  ] = useState<Message[]>([
    INITIAL_MESSAGE,
  ]);

  const chatContainerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const chatEndRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const copyTimerRef =
    useRef<number | null>(
      null
    );

  const isNearBottomRef =
    useRef(true);

  useEffect(() => {
    return () => {
      if (
        copyTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          copyTimerRef.current
        );
      }
    };
  }, []);

  useEffect(() => {
    if (
      !isNearBottomRef.current
    ) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        chatEndRef.current?.scrollIntoView(
          {
            behavior: "smooth",
            block: "end",
          }
        );
      }, 50);

    return () =>
      window.clearTimeout(timer);
  }, [messages, loading]);

  const productAnalysis =
    useMemo<ProductAnalysis[]>(
      () => {
        const salesMap =
          new Map<
            string,
            {
              cantidadVendida: number;
              ingresos: number;
              costos: number;
              ganancia: number;
            }
          >();

        movements
          .filter(
            (movement) =>
              movement.action ===
              "Egreso"
          )
          .forEach(
            (movement) => {
              const current =
                salesMap.get(
                  movement.productSku
                ) ?? {
                  cantidadVendida: 0,
                  ingresos: 0,
                  costos: 0,
                  ganancia: 0,
                };

              const ingreso =
                Number(
                  movement.ingreso_total ??
                    0
                );

              const costo =
                Number(
                  movement.costo_total ??
                    0
                );

              const ganancia =
                ingreso - costo;

              current.cantidadVendida +=
                Number(
                  movement.quantity ??
                    0
                );

              current.ingresos +=
                ingreso;

              current.costos +=
                costo;

              current.ganancia +=
                ganancia;

              salesMap.set(
                movement.productSku,
                current
              );
            }
          );

        return products.map(
          (product) => {
            const sales =
              salesMap.get(
                product.sku
              );

            const stockMinimo =
              Number(
                product.stock_minimo ??
                  10
              );

            const stockAlto =
              Number(
                product.stock_alto ??
                  stockMinimo * 3
              );

            const diasCaducidad =
              getDaysToExpiration(
                product.caducidad
              );

            const descuentoSugerido =
              getSuggestedDiscount(
                diasCaducidad
              );

            const stockStatus =
              getStockStatus(product);

            const ingresos =
              Number(
                sales?.ingresos ?? 0
              );

            const costos =
              Number(
                sales?.costos ?? 0
              );

            const ganancia =
              Number(
                sales?.ganancia ?? 0
              );

            const margen =
              ingresos > 0
                ? (ganancia /
                    ingresos) *
                  100
                : 0;

            const cantidadVendida =
              Number(
                sales?.cantidadVendida ??
                  0
              );

            const razones: string[] =
              [];

            let score = 0;

            if (
              stockStatus === "bajo"
            ) {
              score += 25;

              razones.push(
                "stock bajo"
              );
            }

            if (
              diasCaducidad !== null &&
              diasCaducidad < 0
            ) {
              score += 40;

              razones.push(
                "producto vencido"
              );
            } else if (
              diasCaducidad !== null &&
              diasCaducidad <= 7
            ) {
              score += 30;

              razones.push(
                "caducidad muy cercana"
              );
            } else if (
              diasCaducidad !== null &&
              diasCaducidad <= 15
            ) {
              score += 25;

              razones.push(
                "caducidad cercana"
              );
            } else if (
              diasCaducidad !== null &&
              diasCaducidad <= 30
            ) {
              score += 15;

              razones.push(
                "próximo a caducar"
              );
            }

            if (
              cantidadVendida === 0 &&
              product.cantidad > 0
            ) {
              score += 20;

              razones.push(
                "sin ventas registradas"
              );
            }

            if (
              ingresos > 0 &&
              margen < 15
            ) {
              score += 15;

              razones.push(
                "margen bajo"
              );
            }

            if (
              stockStatus === "alto" &&
              cantidadVendida === 0
            ) {
              score += 10;

              razones.push(
                "stock alto sin movimiento"
              );
            }

            const prioridad: PriorityLevel =
              score >= 50
                ? "Alta"
                : score >= 25
                  ? "Media"
                  : "Monitoreo";

            return {
              sku: product.sku,
              nombre:
                product.nombre,
              locationId:
                product.locationId,
              cantidad:
                product.cantidad,
              stockMinimo,
              stockAlto,
              caducidad:
                product.caducidad ??
                null,
              diasCaducidad,
              cantidadVendida,
              ingresos,
              costos,
              ganancia,
              margen,
              descuentoSugerido,
              stockStatus,
              score,
              prioridad,
              razones,
            };
          }
        );
      },
      [products, movements]
    );

  const priorityProducts =
    useMemo(() => {
      return [
        ...productAnalysis,
      ]
        .sort(
          (a, b) =>
            b.score - a.score
        )
        .slice(0, 10);
    }, [productAnalysis]);

  const discountProducts =
    useMemo(() => {
      return productAnalysis
        .filter(
          (product) =>
            product.descuentoSugerido >
            0
        )
        .sort((a, b) => {
          const aDays =
            a.diasCaducidad ??
            999999;

          const bDays =
            b.diasCaducidad ??
            999999;

          return aDays - bDays;
        })
        .slice(0, 10);
    }, [productAnalysis]);

  const lowStockProducts =
    useMemo(() => {
      return productAnalysis
        .filter(
          (product) =>
            product.stockStatus ===
            "bajo"
        )
        .sort(
          (a, b) =>
            a.cantidad -
            b.cantidad
        )
        .slice(0, 10);
    }, [productAnalysis]);

  const notSoldProducts =
    useMemo(() => {
      return productAnalysis
        .filter(
          (product) =>
            product.cantidadVendida ===
              0 &&
            product.cantidad > 0
        )
        .sort(
          (a, b) =>
            b.cantidad -
            a.cantidad
        )
        .slice(0, 10);
    }, [productAnalysis]);

  const locationRecommendations =
    useMemo(() => {
      const recommendations =
        new Map<
          string,
          LocationRecommendation
        >();

      /*
       * Solo productos vigentes pueden
       * usarse como referencia de ventas.
       */
      const topSellers =
        productAnalysis
          .filter(
            (product) =>
              product.cantidadVendida >
                0 &&
              product.cantidad > 0 &&
              !isExpired(product)
          )
          .sort(
            (a, b) =>
              b.cantidadVendida -
              a.cantidadVendida
          )
          .slice(0, 10);

      if (
        topSellers.length === 0
      ) {
        return recommendations;
      }

      const occupiedLocationIds =
        new Set(
          products.map(
            (product) =>
              product.locationId
          )
        );

      const availableLocations =
        locations.filter(
          (location) =>
            location.status ===
              "libre" &&
            !occupiedLocationIds.has(
              location.id
            )
        );

      const reservedLocationIds =
        new Set<string>();

      /*
       * Los vencidos quedan fuera
       * completamente de las sugerencias
       * de reubicación.
       */
      const unsoldProducts =
        productAnalysis
          .filter(
            (product) =>
              product.cantidadVendida ===
                0 &&
              product.cantidad > 0 &&
              !isExpired(product)
          )
          .sort(
            (a, b) =>
              b.cantidad -
              a.cantidad
          );

      unsoldProducts.forEach(
        (product) => {
          const currentLocation =
            parseLocationId(
              product.locationId
            );

          const nearbyTopSeller =
            topSellers.find(
              (
                referenceProduct
              ) => {
                const referenceLocation =
                  parseLocationId(
                    referenceProduct.locationId
                  );

                if (
                  !currentLocation ||
                  !referenceLocation
                ) {
                  return false;
                }

                return areLocationsNear(
                  currentLocation,
                  referenceLocation
                );
              }
            );

          if (nearbyTopSeller) {
            recommendations.set(
              product.sku,
              {
                productSku:
                  product.sku,

                referenceSku:
                  nearbyTopSeller.sku,

                referenceName:
                  nearbyTopSeller.nombre,

                referenceLocationId:
                  nearbyTopSeller.locationId,

                referenceSales:
                  nearbyTopSeller.cantidadVendida,

                suggestedLocationId:
                  null,

                alreadyWellPlaced:
                  true,

                message:
                  `Este producto ya está junto a ${nearbyTopSeller.nombre}, ` +
                  `ubicado en ${nearbyTopSeller.locationId}, que registra ` +
                  `${nearbyTopSeller.cantidadVendida} unidad(es) vendidas. ` +
                  "Mantén temporalmente esta ubicación y prueba durante 7 a 14 " +
                  "días una mejora de precio, promoción o exhibición. Si no " +
                  "mejora, la baja venta probablemente no se debe únicamente " +
                  "a la ubicación.",
              }
            );

            return;
          }

          const candidates =
            topSellers.flatMap(
              (
                referenceProduct,
                referenceIndex
              ) => {
                const referenceLocation =
                  parseLocationId(
                    referenceProduct.locationId
                  );

                if (
                  !referenceLocation
                ) {
                  return [];
                }

                return availableLocations
                  .filter(
                    (location) =>
                      !reservedLocationIds.has(
                        location.id
                      ) &&
                      location.rack ===
                        referenceLocation.rack &&
                      location.nivel ===
                        referenceLocation.nivel &&
                      location.id !==
                        product.locationId
                  )
                  .map(
                    (location) => {
                      const distance =
                        Math.abs(
                          location.slot -
                            referenceLocation.slot
                        );

                      return {
                        referenceProduct,
                        referenceIndex,
                        location,
                        distance,
                        adjacent:
                          distance === 1,
                      };
                    }
                  );
              }
            );

          candidates.sort(
            (first, second) => {
              if (
                first.adjacent !==
                second.adjacent
              ) {
                return first.adjacent
                  ? -1
                  : 1;
              }

              if (
                first
                  .referenceProduct
                  .cantidadVendida !==
                second
                  .referenceProduct
                  .cantidadVendida
              ) {
                return (
                  second
                    .referenceProduct
                    .cantidadVendida -
                  first
                    .referenceProduct
                    .cantidadVendida
                );
              }

              if (
                first.distance !==
                second.distance
              ) {
                return (
                  first.distance -
                  second.distance
                );
              }

              return (
                first.referenceIndex -
                second.referenceIndex
              );
            }
          );

          const selectedCandidate =
            candidates[0] ??
            null;

          const finalReference =
            selectedCandidate
              ?.referenceProduct ??
            topSellers[0];

          const selectedLocationId =
            selectedCandidate
              ?.location.id ??
            null;

          if (
            selectedLocationId
          ) {
            reservedLocationIds.add(
              selectedLocationId
            );
          }

          const message =
            selectedLocationId
              ? `Prueba mover temporalmente este producto de ` +
                `${product.locationId} a ${selectedLocationId}, cerca de ` +
                `${finalReference.nombre}, ubicado en ` +
                `${finalReference.locationId}. Este producto de referencia ` +
                `registra ${finalReference.cantidadVendida} unidad(es) vendidas. ` +
                `Monitorea el cambio durante 7 a 14 días y compara sus ventas ` +
                `antes y después. La ubicación puede mejorar su visibilidad, ` +
                `pero también conviene revisar precio, demanda, presentación y ` +
                `promociones.`
              : `No existe actualmente un slot libre en el mismo nivel de ` +
                `${finalReference.nombre}, ubicado en ` +
                `${finalReference.locationId}, uno de los productos con mayor ` +
                `rotación. Considera liberar o reorganizar un espacio contiguo ` +
                `y realizar una prueba de ubicación durante 7 a 14 días. También ` +
                `revisa precio, demanda y promoción antes de concluir que la ` +
                `ubicación es la causa principal.`;

          recommendations.set(
            product.sku,
            {
              productSku:
                product.sku,

              referenceSku:
                finalReference.sku,

              referenceName:
                finalReference.nombre,

              referenceLocationId:
                finalReference.locationId,

              referenceSales:
                finalReference.cantidadVendida,

              suggestedLocationId:
                selectedLocationId,

              alreadyWellPlaced:
                false,

              message,
            }
          );
        }
      );

      return recommendations;
    }, [
      productAnalysis,
      products,
      locations,
    ]);

  const decisionProducts =
    useMemo(() => {
      const selectedProducts =
        new Map<
          string,
          ProductAnalysis
        >();

      notSoldProducts
        .slice(0, 3)
        .forEach((product) => {
          selectedProducts.set(
            product.sku,
            product
          );
        });

      priorityProducts.forEach(
        (product) => {
          if (
            !selectedProducts.has(
              product.sku
            )
          ) {
            selectedProducts.set(
              product.sku,
              product
            );
          }
        }
      );

      return Array.from(
        selectedProducts.values()
      ).slice(0, 8);
    }, [
      notSoldProducts,
      priorityProducts,
    ]);

  const lowMarginProducts =
    useMemo(() => {
      return productAnalysis
        .filter(
          (product) =>
            product.ingresos > 0 &&
            product.margen < 15
        )
        .sort(
          (a, b) =>
            a.margen -
            b.margen
        )
        .slice(0, 10);
    }, [productAnalysis]);

  const summary =
    useMemo(() => {
      const highPriority =
        productAnalysis.filter(
          (product) =>
            product.prioridad ===
            "Alta"
        ).length;

      const mediumPriority =
        productAnalysis.filter(
          (product) =>
            product.prioridad ===
            "Media"
        ).length;

      const stockLow =
        productAnalysis.filter(
          (product) =>
            product.stockStatus ===
            "bajo"
        ).length;

      const expiring =
        productAnalysis.filter(
          (product) =>
            product.diasCaducidad !==
              null &&
            product.diasCaducidad >=
              0 &&
            product.diasCaducidad <=
              30
        ).length;

      const expired =
        productAnalysis.filter(
          isExpired
        ).length;

      const notSold =
        productAnalysis.filter(
          (product) =>
            product.cantidadVendida ===
            0
        ).length;

      const lowMargin =
        productAnalysis.filter(
          (product) =>
            product.ingresos > 0 &&
            product.margen < 15
        ).length;

      return {
        totalProducts:
          productAnalysis.length,

        highPriority,
        mediumPriority,
        stockLow,
        expiring,
        expired,
        notSold,
        lowMargin,

        totalPotentialDiscounts:
          discountProducts.length,
      };
    }, [
      productAnalysis,
      discountProducts.length,
    ]);

  const priorityChartData =
    useMemo(() => {
      return [
        {
          name: "Alta",

          value:
            productAnalysis.filter(
              (product) =>
                product.prioridad ===
                "Alta"
            ).length,
        },
        {
          name: "Media",

          value:
            productAnalysis.filter(
              (product) =>
                product.prioridad ===
                "Media"
            ).length,
        },
        {
          name: "Monitoreo",

          value:
            productAnalysis.filter(
              (product) =>
                product.prioridad ===
                "Monitoreo"
            ).length,
        },
      ];
    }, [productAnalysis]);

  const stockChartData =
    useMemo(() => {
      return [
        {
          name: "Bajo",

          value:
            productAnalysis.filter(
              (product) =>
                product.stockStatus ===
                "bajo"
            ).length,
        },
        {
          name: "Normal",

          value:
            productAnalysis.filter(
              (product) =>
                product.stockStatus ===
                "normal"
            ).length,
        },
        {
          name: "Alto",

          value:
            productAnalysis.filter(
              (product) =>
                product.stockStatus ===
                "alto"
            ).length,
        },
      ];
    }, [productAnalysis]);

  const priorityBarData =
    useMemo(() => {
      return priorityProducts
        .slice(0, 8)
        .map((product) => ({
          sku: product.sku,
          nombre:
            product.nombre,
          score: product.score,
        }));
    }, [priorityProducts]);

  const executiveMessage =
    useMemo(() => {
      if (
        productAnalysis.length ===
        0
      ) {
        return "Todavía no hay productos suficientes para generar análisis inteligente.";
      }

      if (
        summary.expired > 0
      ) {
        return `RACKNOVA IA detectó ${summary.expired} producto(s) vencido(s). Deben revisarse y retirarse del flujo de venta antes de considerar descuentos o reubicaciones.`;
      }

      if (
        summary.highPriority > 0
      ) {
        return `RACKNOVA IA detectó ${summary.highPriority} producto(s) con prioridad alta. Revisa primero caducidad, stock bajo, baja rotación y margen bajo.`;
      }

      if (
        summary.mediumPriority > 0
      ) {
        return `El inventario se mantiene estable, pero hay ${summary.mediumPriority} producto(s) que requieren monitoreo preventivo.`;
      }

      return "El inventario se ve estable. No hay riesgos críticos detectados en este momento.";
    }, [
      productAnalysis.length,
      summary.expired,
      summary.highPriority,
      summary.mediumPriority,
    ]);

  const handleChatScroll = () => {
    const container =
      chatContainerRef.current;

    if (!container) {
      return;
    }

    const distanceToBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    isNearBottomRef.current =
      distanceToBottom < 100;
  };

  const handleCopy = async (
    content: string,
    index: number
  ) => {
    try {
      await copyToClipboard(
        content
      );

      setCopiedIndex(index);

      if (
        copyTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          copyTimerRef.current
        );
      }

      copyTimerRef.current =
        window.setTimeout(() => {
          setCopiedIndex(null);
        }, 1800);
    } catch (error) {
      console.error(
        "No se pudo copiar la respuesta:",
        error
      );
    }
  };

  const askIA = async (
    customQuestion?: string
  ) => {
    const preguntaFinal = (
      customQuestion ?? question
    ).trim();

    if (
      !preguntaFinal ||
      loading
    ) {
      return;
    }

    isNearBottomRef.current =
      true;

    const userMessage: Message = {
      role: "user",
      content: preguntaFinal,
    };

    setMessages(
      (previousMessages) => [
        ...previousMessages,
        userMessage,
      ]
    );

    setQuestion("");
    setLoading(true);

    try {
      const response =
        await apiFetch(
          "/ia/inventario",
          {
            method: "POST",

            body: JSON.stringify({
              pregunta:
                preguntaFinal,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "No se pudo obtener respuesta de RACKNOVA IA."
        );
      }

      const assistantMessage: Message =
        {
          role: "assistant",

          content:
            data?.respuesta ||
            "RACKNOVA IA no generó una respuesta. Intenta con otra pregunta.",

          source:
            data?.fuente ??
            data?.modelo ??
            "racknova",

          warning:
            data?.advertencia ??
            null,

          complete:
            typeof data?.completa ===
            "boolean"
              ? data.completa
              : true,

          continuations:
            Number(
              data?.continuaciones ??
                0
            ),

          finishReason:
            data?.finish_reason ??
            null,

          tokenUsage:
            data?.uso_tokens ??
            null,
        };

      setMessages(
        (previousMessages) => [
          ...previousMessages,
          assistantMessage,
        ]
      );
    } catch (
      error: unknown
    ) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Ocurrió un error conectando con RACKNOVA IA. Revisa el backend.";

      setMessages(
        (previousMessages) => [
          ...previousMessages,

          {
            role: "assistant",
            content: errorMessage,
            source: "error",

            warning:
              "No se pudo completar la consulta.",

            complete: false,
            continuations: 0,

            finishReason:
              "error",
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        ...INITIAL_MESSAGE,

        content:
          "Chat reiniciado. Pregúntame sobre inventario, descuentos, caducidad, ubicación, ventas, rentabilidad o restock.",
      },
    ]);

    setCopiedIndex(null);

    isNearBottomRef.current =
      true;
  };

  const exportCSV = () => {
    const headers = [
      "SKU",
      "Producto",
      "Ubicacion",
      "Cantidad",
      "Stock minimo",
      "Stock alto",
      "Stock status",
      "Caducidad",
      "Dias caducidad",
      "Vendidas",
      "Ingresos",
      "Costos",
      "Ganancia",
      "Margen",
      "Descuento sugerido",
      "Prioridad",
      "Score",
      "Razones",
      "Recomendacion ubicacion",
    ];

    const rows =
      productAnalysis.map(
        (product) => [
          product.sku,
          product.nombre,
          product.locationId,
          product.cantidad,
          product.stockMinimo,
          product.stockAlto,
          product.stockStatus,
          product.caducidad ?? "",
          product.diasCaducidad ??
            "",
          product.cantidadVendida,
          product.ingresos,
          product.costos,
          product.ganancia,
          product.margen,
          product.descuentoSugerido,
          product.prioridad,
          product.score,
          product.razones.join(
            " | "
          ),

          isExpired(product)
            ? "No aplica: producto vencido"
            : locationRecommendations.get(
                  product.sku
                )?.message ?? "",
        ]
      );

    const csvContent = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map(
            (cell) =>
              `"${String(
                cell
              ).replace(
                /"/g,
                '""'
              )}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csvContent],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `racknova-ia-analisis-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen space-y-6 bg-background p-6">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-50 via-white to-slate-100 text-slate-950 shadow-xl dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 dark:text-white">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl dark:bg-blue-500/30" />

        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl dark:bg-emerald-500/20" />

        <div className="relative p-6 md:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-sm text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-blue-50">
                <Bot className="h-4 w-4" />

                Centro inteligente RackNova
              </div>

              <div>
                <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight md:text-4xl">
                  RackNova IA

                  <Sparkles className="h-8 w-8 text-blue-600 dark:text-cyan-300" />
                </h1>

                <p className="mt-2 max-w-2xl text-slate-600 dark:text-blue-100">
                  Análisis inteligente de
                  inventario, caducidad,
                  rotación, rentabilidad,
                  descuentos, ubicación y
                  restock.
                </p>
              </div>

              <div className="max-w-3xl rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/15 dark:bg-white/10">
                <p className="text-sm leading-relaxed text-slate-700 dark:text-blue-50">
                  {executiveMessage}
                </p>
              </div>
            </div>

            <div className="flex min-w-[220px] flex-col gap-2">
              <Button
                onClick={exportCSV}
                className="bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-blue-50"
              >
                <Download className="mr-2 h-4 w-4" />

                Exportar análisis
              </Button>

              <div className="rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/15 dark:bg-white/10">
                <p className="text-sm text-slate-500 dark:text-blue-100">
                  Productos analizados
                </p>

                <p className="text-3xl font-bold">
                  {
                    summary.totalProducts
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/15 dark:bg-white/10">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Prioridad alta
              </p>

              <p className="text-2xl font-bold text-red-600">
                {
                  summary.highPriority
                }
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/15 dark:bg-white/10">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Próximos a caducar
              </p>

              <p className="text-2xl font-bold text-amber-600">
                {summary.expiring}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/15 dark:bg-white/10">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Sin ventas
              </p>

              <p className="text-2xl font-bold text-sky-600">
                {summary.notSold}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/15 dark:bg-white/10">
              <p className="text-sm text-slate-500 dark:text-blue-100">
                Margen bajo
              </p>

              <p className="text-2xl font-bold text-orange-600">
                {
                  summary.lowMargin
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Stock bajo
                </p>

                <p className="text-3xl font-bold text-red-600">
                  {summary.stockLow}
                </p>
              </div>

              <ShieldAlert className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Vencidos
                </p>

                <p className="text-3xl font-bold text-red-600">
                  {summary.expired}
                </p>
              </div>

              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Descuentos sugeridos
                </p>

                <p className="text-3xl font-bold text-amber-600">
                  {
                    summary.totalPotentialDiscounts
                  }
                </p>
              </div>

              <Percent className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Prioridad media
                </p>

                <p className="text-3xl font-bold text-blue-600">
                  {
                    summary.mediumPriority
                  }
                </p>
              </div>

              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="racknova-card xl:col-span-2">
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-600" />

                  Productos con mayor prioridad IA
                </CardTitle>

                <p className="mt-1 text-sm text-muted-foreground">
                  Los puntos IA indican
                  qué tan urgente es
                  revisar un producto.
                  Entre más alto sea el
                  puntaje, mayor
                  prioridad tiene.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="destructive">
                  Alta: 50+ pts
                </Badge>

                <Badge className="bg-amber-500 hover:bg-amber-500">
                  Media: 25-49 pts
                </Badge>

                <Badge className="bg-blue-600 hover:bg-blue-600">
                  Monitoreo: 0-24 pts
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="h-[300px]">
              {
                priorityBarData.length ===
                0 ? (
                  <EmptyState text="No hay datos suficientes para generar prioridades." />
                ) : (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={
                        priorityBarData
                      }
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                      />

                      <XAxis
                        dataKey="sku"
                        stroke="#94a3b8"
                        tick={{
                          fill: "#94a3b8",
                        }}
                      />

                      <YAxis
                        stroke="#94a3b8"
                        tick={{
                          fill: "#94a3b8",
                        }}
                        allowDecimals={
                          false
                        }
                      />

                      <Tooltip
                        contentStyle={
                          TOOLTIP_STYLE
                        }
                        labelStyle={
                          TOOLTIP_LABEL_STYLE
                        }
                        itemStyle={
                          TOOLTIP_ITEM_STYLE
                        }
                        labelFormatter={
                          productTooltipLabel
                        }
                        formatter={(
                          value
                        ) => [
                          `${numberFormat(
                            Number(
                              value
                            )
                          )} puntos`,
                          "Prioridad IA",
                        ]}
                      />

                      <Bar
                        dataKey="score"
                        name="Prioridad IA"
                        fill={
                          CHART_COLORS.primary
                        }
                        radius={[
                          8,
                          8,
                          0,
                          0,
                        ]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="mb-3 flex items-center gap-2 font-semibold">
                <Lightbulb className="h-4 w-4 text-amber-500" />

                ¿Cómo se calculan los puntos IA?
              </p>

              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                {[
                  [
                    "Producto vencido",
                    "+40 pts",
                    "text-red-600",
                  ],
                  [
                    "Caducidad menor o igual a 7 días",
                    "+30 pts",
                    "text-red-600",
                  ],
                  [
                    "Caducidad menor o igual a 15 días",
                    "+25 pts",
                    "text-amber-600",
                  ],
                  [
                    "Stock bajo",
                    "+25 pts",
                    "text-red-600",
                  ],
                  [
                    "Producto sin ventas registradas",
                    "+20 pts",
                    "text-sky-600",
                  ],
                  [
                    "Margen bajo",
                    "+15 pts",
                    "text-orange-600",
                  ],
                  [
                    "Próximo a caducar, hasta 30 días",
                    "+15 pts",
                    "text-amber-600",
                  ],
                  [
                    "Stock alto sin movimiento",
                    "+10 pts",
                    "text-blue-600",
                  ],
                ].map(
                  ([
                    label,
                    points,
                    color,
                  ]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg border bg-background p-3"
                    >
                      <span>
                        {label}
                      </span>

                      <span
                        className={`font-bold ${color}`}
                      >
                        {points}
                      </span>
                    </div>
                  )
                )}
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Un producto puede
                acumular varios puntos
                si tiene más de un
                problema. Un producto
                vencido nunca recibe
                una recomendación de
                reubicación.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />

              Distribución de prioridad
            </CardTitle>
          </CardHeader>

          <CardContent className="h-[340px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={
                    priorityChartData
                  }
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={105}
                  paddingAngle={4}
                  label
                >
                  {
                    priorityChartData.map(
                      (_, index) => (
                        <Cell
                          key={`priority-cell-${index}`}
                          fill={
                            PRIORITY_COLORS[
                              index %
                                PRIORITY_COLORS.length
                            ]
                          }
                        />
                      )
                    )
                  }
                </Pie>

                <Tooltip
                  contentStyle={
                    TOOLTIP_STYLE
                  }
                  labelStyle={
                    TOOLTIP_LABEL_STYLE
                  }
                  itemStyle={
                    TOOLTIP_ITEM_STYLE
                  }
                />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="racknova-card xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />

              Decisiones recomendadas
            </CardTitle>
          </CardHeader>

          <CardContent>
            {
              decisionProducts.length ===
              0 ? (
                <EmptyState text="No hay recomendaciones disponibles." />
              ) : (
                <div className="space-y-3">
                  {
                    decisionProducts.map(
                      (product) => {
                        const recommendation =
                          locationRecommendations.get(
                            product.sku
                          );

                        const expired =
                          isExpired(
                            product
                          );

                        return (
                          <div
                            key={
                              product.sku
                            }
                            className="rounded-xl border bg-background p-4 transition-colors hover:bg-muted/40"
                          >
                            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold">
                                    {
                                      product.nombre
                                    }
                                  </p>

                                  {getPriorityBadge(
                                    product.prioridad
                                  )}

                                  {getStockBadge(
                                    product.stockStatus
                                  )}

                                  {
                                    expired && (
                                      <Badge variant="destructive">
                                        Vencido
                                      </Badge>
                                    )
                                  }
                                </div>

                                <p className="mt-1 text-xs text-muted-foreground">
                                  SKU{" "}
                                  {
                                    product.sku
                                  }{" "}
                                  ·
                                  Ubicación{" "}
                                  {
                                    product.locationId
                                  }{" "}
                                  ·
                                  Stock{" "}
                                  {
                                    product.cantidad
                                  }
                                </p>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {
                                    product
                                      .razones
                                      .length ===
                                    0 ? (
                                      <Badge variant="outline">
                                        Sin
                                        riesgo
                                        crítico
                                      </Badge>
                                    ) : (
                                      product.razones.map(
                                        (
                                          reason
                                        ) => (
                                          <Badge
                                            key={
                                              reason
                                            }
                                            variant="outline"
                                          >
                                            {
                                              reason
                                            }
                                          </Badge>
                                        )
                                      )
                                    )
                                  }
                                </div>
                              </div>

                              <div className="text-sm md:text-right">
                                <p className="text-muted-foreground">
                                  Score IA
                                </p>

                                <p className="text-2xl font-bold text-blue-600">
                                  {
                                    product.score
                                  }
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
                              <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-muted-foreground">
                                  Caducidad
                                </p>

                                <p
                                  className={`font-semibold ${
                                    expired
                                      ? "text-red-600"
                                      : ""
                                  }`}
                                >
                                  {formatDate(
                                    product.caducidad
                                  )}
                                </p>
                              </div>

                              <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-muted-foreground">
                                  Vendidas
                                </p>

                                <p className="font-semibold">
                                  {
                                    product.cantidadVendida
                                  }
                                </p>
                              </div>

                              <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-muted-foreground">
                                  Margen
                                </p>

                                <p
                                  className={`font-semibold ${
                                    product.margen <
                                      15 &&
                                    product.ingresos >
                                      0
                                      ? "text-orange-600"
                                      : "text-emerald-600"
                                  }`}
                                >
                                  {
                                    product.ingresos >
                                    0
                                      ? percent(
                                          product.margen
                                        )
                                      : "-"
                                  }
                                </p>
                              </div>

                              <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-muted-foreground">
                                  Descuento
                                </p>

                                <p className="font-semibold text-amber-600">
                                  {
                                    expired
                                      ? "No aplica"
                                      : product.descuentoSugerido >
                                          0
                                        ? `${product.descuentoSugerido}% sugerido`
                                        : "No requerido"
                                  }
                                </p>
                              </div>
                            </div>

                            {
                              expired && (
                                <div className="mt-4 flex gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">
                                  <AlertTriangle className="h-5 w-5 shrink-0" />

                                  <div>
                                    <p className="font-semibold">
                                      No
                                      se
                                      recomienda
                                      reubicar
                                      este
                                      producto
                                    </p>

                                    <p className="mt-1 text-sm leading-relaxed">
                                      El
                                      producto
                                      está
                                      vencido.
                                      Debe
                                      retirarse
                                      o
                                      bloquearse
                                      del
                                      flujo
                                      de
                                      venta
                                      y
                                      revisarse
                                      conforme
                                      al
                                      procedimiento
                                      interno.
                                      No
                                      se
                                      sugiere
                                      moverlo
                                      cerca
                                      de
                                      productos
                                      de
                                      alta
                                      rotación.
                                    </p>
                                  </div>
                                </div>
                              )
                            }

                            {
                              !expired &&
                                product.cantidadVendida ===
                                  0 &&
                                recommendation && (
                                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                                    <div className="flex items-start gap-3">
                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                                        <MapPinned className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                                      </div>

                                      <div className="min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-semibold text-blue-950 dark:text-blue-100">
                                            Recomendación
                                            de
                                            ubicación
                                          </p>

                                          {
                                            recommendation.alreadyWellPlaced ? (
                                              <Badge
                                                variant="outline"
                                                className="border-emerald-500 text-emerald-700 dark:text-emerald-300"
                                              >
                                                Ya
                                                está
                                                cerca
                                                de
                                                alta
                                                rotación
                                              </Badge>
                                            ) : recommendation.suggestedLocationId ? (
                                              <Badge className="bg-blue-600 hover:bg-blue-600">
                                                Reubicación
                                                sugerida
                                              </Badge>
                                            ) : (
                                              <Badge
                                                variant="outline"
                                                className="border-amber-500 text-amber-700 dark:text-amber-300"
                                              >
                                                Requiere
                                                liberar
                                                espacio
                                              </Badge>
                                            )
                                          }
                                        </div>

                                        <p className="text-sm leading-relaxed text-blue-950/80 dark:text-blue-100/80">
                                          {
                                            recommendation.message
                                          }
                                        </p>

                                        <div className="flex flex-wrap gap-2 pt-1">
                                          <Badge variant="outline">
                                            Posición
                                            actual:{" "}
                                            {
                                              product.locationId
                                            }
                                          </Badge>

                                          {
                                            recommendation.suggestedLocationId && (
                                              <Badge variant="outline">
                                                Posición
                                                sugerida:{" "}
                                                {
                                                  recommendation.suggestedLocationId
                                                }
                                              </Badge>
                                            )
                                          }

                                          <Badge variant="outline">
                                            Cerca
                                            de:{" "}
                                            {
                                              recommendation.referenceName
                                            }
                                          </Badge>

                                          <Badge variant="outline">
                                            Ventas
                                            de
                                            referencia:{" "}
                                            {
                                              recommendation.referenceSales
                                            }
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                            }
                          </div>
                        );
                      }
                    )
                  }
                </div>
              )
            }
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-emerald-600" />

              Estado de stock
            </CardTitle>
          </CardHeader>

          <CardContent className="h-[340px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={stockChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={105}
                  paddingAngle={4}
                  label
                >
                  {
                    stockChartData.map(
                      (_, index) => (
                        <Cell
                          key={`stock-cell-${index}`}
                          fill={
                            STOCK_COLORS[
                              index %
                                STOCK_COLORS.length
                            ]
                          }
                        />
                      )
                    )
                  }
                </Pie>

                <Tooltip
                  contentStyle={
                    TOOLTIP_STYLE
                  }
                  labelStyle={
                    TOOLTIP_LABEL_STYLE
                  }
                  itemStyle={
                    TOOLTIP_ITEM_STYLE
                  }
                />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-500" />

              Descuentos sugeridos por caducidad
            </CardTitle>
          </CardHeader>

          <CardContent>
            {
              discountProducts.length ===
              0 ? (
                <EmptyState text="No hay productos vigentes que requieran descuento por caducidad." />
              ) : (
                <div className="space-y-3">
                  {
                    discountProducts.map(
                      (product) => (
                        <div
                          key={
                            product.sku
                          }
                          className="flex items-center justify-between gap-3 rounded-lg border p-3"
                        >
                          <div>
                            <p className="font-medium">
                              {
                                product.nombre
                              }
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {
                                product.sku
                              }{" "}
                              ·{" "}
                              {formatDate(
                                product.caducidad
                              )}{" "}
                              ·{" "}
                              {
                                product.diasCaducidad
                              }{" "}
                              día(s)
                            </p>
                          </div>

                          <Badge className="bg-amber-500 hover:bg-amber-500">
                            {
                              product.descuentoSugerido
                            }
                            % descuento
                          </Badge>
                        </div>
                      )
                    )
                  }
                </div>
              )
            }
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-red-600" />

                Restock urgente
              </CardTitle>

              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="font-semibold text-foreground">
                  ¿Por qué aparece como restock urgente?
                </p>

                <p className="mt-1 text-muted-foreground">
                  Un producto entra en
                  esta lista cuando su
                  cantidad actual es
                  menor o igual al stock
                  mínimo configurado.
                </p>

                <p className="mt-2 text-xs text-muted-foreground">
                  Fórmula usada:{" "}

                  <span className="font-semibold text-foreground">
                    cantidad actual ≤
                    stock mínimo
                  </span>
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {
              lowStockProducts.length ===
              0 ? (
                <EmptyState text="No hay productos con stock bajo." />
              ) : (
                <div className="space-y-3">
                  {
                    lowStockProducts.map(
                      (product) => {
                        const faltanteSugerido =
                          Math.max(
                            product.stockMinimo -
                              product.cantidad,
                            0
                          );

                        return (
                          <div
                            key={
                              product.sku
                            }
                            className="space-y-3 rounded-lg border p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">
                                  {
                                    product.nombre
                                  }
                                </p>

                                <p className="text-xs text-muted-foreground">
                                  {
                                    product.sku
                                  }{" "}
                                  ·
                                  Ubicación{" "}
                                  {
                                    product.locationId
                                  }
                                </p>
                              </div>

                              <Badge variant="destructive">
                                Restock
                                urgente
                              </Badge>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div className="rounded-md bg-muted/50 p-2">
                                <p className="text-xs text-muted-foreground">
                                  Stock
                                  actual
                                </p>

                                <p className="font-bold text-red-600">
                                  {
                                    product.cantidad
                                  }
                                </p>
                              </div>

                              <div className="rounded-md bg-muted/50 p-2">
                                <p className="text-xs text-muted-foreground">
                                  Stock
                                  mínimo
                                </p>

                                <p className="font-bold">
                                  {
                                    product.stockMinimo
                                  }
                                </p>
                              </div>

                              <div className="rounded-md bg-muted/50 p-2">
                                <p className="text-xs text-muted-foreground">
                                  Faltante
                                  mínimo
                                </p>

                                <p className="font-bold text-orange-600">
                                  {
                                    faltanteSugerido
                                  }
                                </p>
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground">
                              Se
                              recomienda
                              revisar el
                              resurtido
                              porque el
                              stock actual
                              de{" "}

                              <span className="font-semibold text-foreground">
                                {
                                  product.cantidad
                                }
                              </span>{" "}

                              está por
                              debajo o
                              igual al
                              mínimo
                              configurado
                              de{" "}

                              <span className="font-semibold text-foreground">
                                {
                                  product.stockMinimo
                                }
                              </span>
                              .
                            </p>
                          </div>
                        );
                      }
                    )
                  }
                </div>
              )
            }
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageX className="h-5 w-5 text-sky-600" />

              Productos sin venta
            </CardTitle>
          </CardHeader>

          <CardContent>
            {
              notSoldProducts.length ===
              0 ? (
                <EmptyState text="Todos los productos tienen ventas registradas." />
              ) : (
                <div className="space-y-3">
                  {
                    notSoldProducts.map(
                      (product) => (
                        <div
                          key={
                            product.sku
                          }
                          className="flex items-center justify-between gap-3 rounded-lg border p-3"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">
                                {
                                  product.nombre
                                }
                              </p>

                              {
                                isExpired(
                                  product
                                ) && (
                                  <Badge variant="destructive">
                                    Vencido
                                  </Badge>
                                )
                              }
                            </div>

                            <p className="text-xs text-muted-foreground">
                              {
                                product.sku
                              }{" "}
                              ·
                              Ubicación{" "}
                              {
                                product.locationId
                              }
                            </p>

                            {
                              isExpired(
                                product
                              ) && (
                                <p className="mt-1 text-xs font-medium text-red-600">
                                  No
                                  se
                                  generará
                                  recomendación
                                  de
                                  ubicación.
                                </p>
                              )
                            }
                          </div>

                          <div className="text-right">
                            <p className="font-bold text-sky-600">
                              {
                                product.cantidad
                              }
                            </p>

                            <p className="text-xs text-muted-foreground">
                              stock
                            </p>
                          </div>
                        </div>
                      )
                    )
                  }
                </div>
              )
            }
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-600" />

              Margen bajo
            </CardTitle>
          </CardHeader>

          <CardContent>
            {
              lowMarginProducts.length ===
              0 ? (
                <EmptyState text="No hay productos con margen bajo en ventas registradas." />
              ) : (
                <div className="space-y-3">
                  {
                    lowMarginProducts.map(
                      (product) => (
                        <div
                          key={
                            product.sku
                          }
                          className="flex items-center justify-between gap-3 rounded-lg border p-3"
                        >
                          <div>
                            <p className="font-medium">
                              {
                                product.nombre
                              }
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {
                                product.sku
                              }{" "}
                              ·
                              Ganancia{" "}
                              {money(
                                product.ganancia
                              )}
                            </p>
                          </div>

                          <Badge className="bg-orange-500 hover:bg-orange-500">
                            {percent(
                              product.margen
                            )}
                          </Badge>
                        </div>
                      )
                    )
                  }
                </div>
              )
            }
          </CardContent>
        </Card>
      </div>

      <Card className="racknova-card overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />

            Chat completo con RackNova IA
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {
              quickQuestions.map(
                (item) => {
                  const Icon =
                    item.icon;

                  return (
                    <button
                      key={
                        item.title
                      }
                      type="button"
                      onClick={() =>
                        askIA(
                          item.prompt
                        )
                      }
                      disabled={
                        loading
                      }
                      className="rounded-xl border p-4 text-left transition-colors hover:bg-muted/60 disabled:opacity-50"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
                          <Icon className="h-4 w-4 text-blue-600" />
                        </div>

                        <p className="font-semibold">
                          {
                            item.title
                          }
                        </p>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {
                          item.prompt
                        }
                      </p>
                    </button>
                  );
                }
              )
            }
          </div>

          <div
            ref={chatContainerRef}
            onScroll={
              handleChatScroll
            }
            className="h-[55vh] min-h-[420px] max-h-[680px] space-y-4 overflow-y-auto overflow-x-hidden rounded-xl border bg-muted/20 p-4"
          >
            {
              messages.map(
                (
                  message,
                  index
                ) => {
                  const isUser =
                    message.role ===
                    "user";

                  const totalTokens =
                    Number(
                      message
                        .tokenUsage
                        ?.total_tokens ??
                        0
                    );

                  const wasContinued =
                    Number(
                      message.continuations ??
                        0
                    ) > 0;

                  const wasCopied =
                    copiedIndex ===
                    index;

                  return (
                    <div
                      key={`${message.role}-${index}`}
                      className={`flex min-w-0 ${
                        isUser
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`min-w-0 max-w-[92%] overflow-hidden rounded-2xl px-4 py-3 text-sm sm:max-w-[85%] ${
                          isUser
                            ? "bg-primary text-primary-foreground"
                            : "border bg-background"
                        }`}
                      >
                        {
                          !isUser && (
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                                <Bot className="h-3.5 w-3.5" />

                                RACKNOVA
                                IA
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(
                                    message.content,
                                    index
                                  )
                                }
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                title={
                                  wasCopied
                                    ? "Respuesta copiada"
                                    : "Copiar respuesta"
                                }
                                aria-label={
                                  wasCopied
                                    ? "Respuesta copiada"
                                    : "Copiar respuesta"
                                }
                              >
                                {
                                  wasCopied ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )
                                }
                              </button>
                            </div>
                          )
                        }

                        {
                          message.warning && (
                            <div className="mb-3 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                              <AlertTriangle className="h-4 w-4 shrink-0" />

                              <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                                {
                                  message.warning
                                }
                              </span>
                            </div>
                          )
                        }

                        {
                          !isUser &&
                            message.complete ===
                              false && (
                              <div className="mb-3 flex gap-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
                                <AlertTriangle className="h-4 w-4 shrink-0" />

                                <span>
                                  La
                                  respuesta
                                  podría
                                  seguir
                                  incompleta.
                                  Intenta
                                  hacer una
                                  pregunta
                                  más
                                  específica.
                                </span>
                              </div>
                            )
                        }

                        <div className="whitespace-pre-wrap break-words leading-6 [overflow-wrap:anywhere]">
                          {
                            message.content
                          }
                        </div>

                        {
                          !isUser && (
                            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
                              {
                                message.source && (
                                  <span className="rounded-full border bg-muted/40 px-2 py-0.5">
                                    Fuente:{" "}
                                    {sourceLabel(
                                      message.source
                                    )}
                                  </span>
                                )
                              }

                              {
                                wasContinued && (
                                  <span className="rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                                    Respuesta
                                    completada
                                    automáticamente
                                  </span>
                                )
                              }

                              {
                                totalTokens >
                                  0 && (
                                  <span className="rounded-full border bg-muted/40 px-2 py-0.5">
                                    {totalTokens.toLocaleString(
                                      "es-MX"
                                    )}{" "}
                                    tokens
                                  </span>
                                )
                              }

                              {
                                message.finishReason && (
                                  <span className="rounded-full border bg-muted/40 px-2 py-0.5">
                                    Estado:{" "}
                                    {
                                      message.finishReason
                                    }
                                  </span>
                                )
                              }
                            </div>
                          )
                        }
                      </div>
                    </div>
                  );
                }
              )
            }

            {
              loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border bg-background px-4 py-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />

                    Analizando inventario...
                  </div>
                </div>
              )
            }

            <div
              ref={chatEndRef}
              className="h-px"
              aria-hidden="true"
            />
          </div>

          <div className="flex items-end gap-2">
            <textarea
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value
                )
              }
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                    "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();

                  askIA();
                }
              }}
              placeholder="Pregúntale a RackNova IA sobre inventario, ventas, caducidad, descuentos, margen o ubicación..."
              className="max-h-40 min-h-[48px] min-w-0 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
            />

            <Button
              type="button"
              size="icon"
              onClick={() =>
                askIA()
              }
              disabled={
                loading ||
                !question.trim()
              }
              aria-label="Enviar pregunta"
            >
              {
                loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )
              }
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex min-w-0 items-center gap-1">
              <MessageSquare className="h-3 w-3 shrink-0" />

              <span className="truncate">
                Enter para enviar,
                Shift + Enter para
                salto de línea.
              </span>
            </div>

            <button
              type="button"
              onClick={clearChat}
              className="inline-flex shrink-0 items-center gap-1 underline hover:text-foreground"
            >
              <RefreshCcw className="h-3 w-3" />

              Limpiar chat
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
