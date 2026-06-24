import { API_URL } from "../config";
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import {
  Product,
  Location,
  ProductWithLocation,
  Rack,
  Nivel,
  SlotStatus,
} from "@/types/inventory";
import { MovementRecord } from "@/types/movement";
import { SaleData } from "@/types/finance";

/**
 * MODO PRUEBA:
 * true  = NO conecta MQTT y permite registrar sin confirmación física.
 * false = usa MQTT normal con ESP32.
 */
const TEST_MODE_NO_MQTT = false;// MUY IMPORTANTE AJUA

interface InventoryContextType {
  products: Product[];
  locations: Location[];
  movements: MovementRecord[];

  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (sku: string, venta?: SaleData) => Promise<void>;

  clearRack: (rack: Rack) => void;
  getProductByLocation: (locationId: string) => Product | undefined;
  getProductsWithLocation: () => ProductWithLocation[];
  getTotalProducts: () => number;
  getLowStockProducts: () => Product[];
  getMovements: () => MovementRecord[];

  updateSlotStatus: (locationId: string, status: SlotStatus) => void;
  startProductPlacement: (locationId: string) => void;
  confirmProductPlacement: (locationId: string) => void;
}

interface PendingDeletion {
  locationId: string;
  venta?: SaleData;
}

const InventoryContext = createContext<InventoryContextType | undefined>(
  undefined
);

const generateLocations = (): Location[] => {
  const locations: Location[] = [];
  const racks: Rack[] = ["A", "B", "C", "D", "E"];

  racks.forEach((rack) => {
    [1, 2, 3].forEach((nivel) => {
      Array.from({ length: 6 }, (_, i) => i + 1).forEach((slot) => {
        locations.push({
          id: `${rack}-${nivel}-${slot}`,
          rack,
          nivel: nivel as Nivel,
          slot,
          status: "libre",
        });
      });
    });
  });

  return locations;
};

async function sendMQTT(topic: string, message: string) {
  if (TEST_MODE_NO_MQTT) {
    console.log("[MODO PRUEBA] MQTT desactivado:", topic, message);
    return;
  }

  const { publishMQTT } = await import("@/mqtt/mqttClient");
  publishMQTT(topic, message);
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>(generateLocations());
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [processedIngresos, setProcessedIngresos] = useState<string[]>([]);
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>(
    []
  );

  const productsRef = React.useRef(products);
  const pendingProductsRef = React.useRef(pendingProducts);
  const pendingDeletionsRef = React.useRef(pendingDeletions);
  const locationsRef = React.useRef(locations);
  const processedIngresosRef = React.useRef(processedIngresos);
  const lastEventTimeRef = React.useRef(0);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    pendingProductsRef.current = pendingProducts;
  }, [pendingProducts]);

  useEffect(() => {
    pendingDeletionsRef.current = pendingDeletions;
  }, [pendingDeletions]);

  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);

  useEffect(() => {
    processedIngresosRef.current = processedIngresos;
  }, [processedIngresos]);

  useEffect(() => {
    const loadInitialProducts = async () => {
      try {
        const resp = await fetch(`${API_URL}/productos`);

        if (!resp.ok) {
          throw new Error(`Error HTTP: ${resp.status}`);
        }

        const data = await resp.json();

        const loaded: Product[] = data.map((p: any) => ({
          id: String(
            p.id_producto ?? p.id ?? `${p.sku}-${p.rack}-${p.nivel}-${p.slot}`
          ),
          sku: p.sku,
          nombre: p.nombre,
          cantidad: Number(p.cantidad ?? 0),
          costo_proveedor: Number(p.costo_proveedor ?? 0),
          locationId: `${p.rack}-${p.nivel}-${p.slot}`,
        }));

        setProducts(loaded);
        productsRef.current = loaded;

        setLocations((prev) =>
          prev.map((loc) => {
            const hayProducto = loaded.some(
              (prod) => prod.locationId === loc.id
            );

            if (hayProducto && loc.status !== "ocupado") {
              return { ...loc, status: "ocupado" };
            }

            return loc;
          })
        );

        console.log("Inventario inicial cargado:", loaded);
      } catch (err) {
        console.error("❌ Error cargando inventario inicial:", err);
      }
    };

    loadInitialProducts();
  }, []);

  useEffect(() => {
    const loadMovements = async () => {
      try {
        const resp = await fetch(`${API_URL}/movimientos`);

        if (!resp.ok) {
          throw new Error("Error cargando movimientos");
        }

        const data = await resp.json();

        const mapped: MovementRecord[] = data.map((m: any) => ({
          id: String(m.id_mov ?? m.id ?? Date.now()),
          action: m.accion,
          productSku: m.sku,
          productName: m.producto,
          quantity: Number(m.cantidad ?? 0),
          location: m.ubicacion,
          user: m.usuario,
          timestamp: new Date(m.fecha),

          costo_proveedor: Number(m.costo_proveedor ?? 0),
          precio_venta: Number(m.precio_venta ?? 0),
          ingreso_total: Number(m.ingreso_total ?? 0),
          costo_total: Number(m.costo_total ?? 0),
          ganancia: Number(m.ganancia ?? 0),
        }));

        setMovements(mapped);

        console.log("Movimientos cargados desde MySQL:", mapped);
      } catch (err) {
        console.error("❌ Error al cargar movimientos:", err);
      }
    };

    loadMovements();
  }, []);

  const addMovement = async (
    movement: Omit<MovementRecord, "id" | "timestamp">
  ) => {
    const newMovement: MovementRecord = {
      ...movement,
      id: Date.now().toString(),
      timestamp: new Date(),
    };

    setMovements((prev) => [...prev, newMovement]);

    try {
      const resp = await fetch(`${API_URL}/movimientos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accion: movement.action,
          sku: movement.productSku,
          producto: movement.productName,
          cantidad: movement.quantity,
          ubicacion: movement.location,
          usuario: movement.user ?? "Admin",

          costo_proveedor: movement.costo_proveedor ?? 0,
          precio_venta: movement.precio_venta ?? 0,
          ingreso_total: movement.ingreso_total ?? 0,
          costo_total: movement.costo_total ?? 0,
          ganancia: movement.ganancia ?? 0,
        }),
      });

      if (!resp.ok) {
        console.error("❌ Error guardando movimiento:", resp.status);
      }
    } catch (error) {
      console.error("❌ Error enviando movimiento al backend:", error);
    }
  };

  const addProduct = async (product: Omit<Product, "id">) => {
    try {
      const location = locations.find((loc) => loc.id === product.locationId);

      if (location && location.status !== "libre") {
        alert("❌ El slot no está libre.");
        return;
      }

      const yaExiste = products.some(
        (p) => p.locationId === product.locationId
      );

      if (yaExiste) {
        alert("❌ Este slot ya tiene un producto. Primero elimínalo.");
        return;
      }

      const newProduct: Product = {
        ...product,
        costo_proveedor: Number(product.costo_proveedor ?? 0),
        id: Date.now().toString(),
      };

      /**
       * MODO PRUEBA SIN MQTT:
       * Guarda directo en backend y actualiza la interfaz sin esperar ESP32.
       */
      if (TEST_MODE_NO_MQTT) {
        const [rack, nivelStr, slotStr] = product.locationId.split("-");

        const nuevoProductoBackend = {
          sku: product.sku,
          nombre: product.nombre,
          cantidad: product.cantidad,
          costo_proveedor: Number(product.costo_proveedor ?? 0),
          descripcion: "Agregado desde modo prueba RackNova",
          rack,
          nivel: parseInt(nivelStr),
          slot: parseInt(slotStr),
        };

        const resp = await fetch(`${API_URL}/productos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(nuevoProductoBackend),
        });

        if (!resp.ok) {
          const errorText = await resp.text();
          console.error("❌ Error guardando producto:", resp.status, errorText);
          alert("No se pudo guardar el producto en backend.");
          return;
        }

        setProducts((prev) => {
          const updated = [...prev, newProduct];
          productsRef.current = updated;
          return updated;
        });

        setLocations((prev) =>
          prev.map((loc) =>
            loc.id === product.locationId ? { ...loc, status: "ocupado" } : loc
          )
        );

        await addMovement({
          action: "Ingreso",
          productSku: product.sku,
          productName: product.nombre,
          quantity: product.cantidad,
          location: product.locationId,
          user: "Admin",

          costo_proveedor: Number(product.costo_proveedor ?? 0),
          precio_venta: 0,
          ingreso_total: 0,
          costo_total: 0,
          ganancia: 0,
        });

        console.log("[MODO PRUEBA] Producto registrado sin MQTT:", newProduct);
        return;
      }

      /**
       * MODO NORMAL CON MQTT:
       * Envía comando al ESP32 y espera confirmación física.
       */
      const [, nivelStr, slotStr] = product.locationId.split("-");
      const nivel = parseInt(nivelStr);
      const slot = parseInt(slotStr);

      const pinMap: Record<number, number> = {
        1: 14,
        2: 12,
        3: 32,
        4: 26,
        5: 27,
        6: 33,
      };

      const nivelToTopic: Record<number, string> = {
        1: "Entrada/L3",
        2: "Entrada/L2",
        3: "Entrada/L1",
      };

      const topicCorrecto = nivelToTopic[nivel];
      const pin = pinMap[slot];

      if (pin && topicCorrecto) {
        const comando = `p${pin}c`;
        await sendMQTT(topicCorrecto, comando);
        console.log(`Enviado a ESP32 → ${topicCorrecto} → ${comando}`);
      } else {
        console.warn(
          "⚠️ No existe pin o topic para esta ubicación:",
          product.locationId
        );
      }

      setPendingProducts((prev) => {
        const updated = [...prev, newProduct];
        pendingProductsRef.current = updated;
        return updated;
      });

      startProductPlacement(product.locationId);
    } catch (error) {
      console.error("❌ Error al preparar producto:", error);
      alert("Error al preparar producto.");
    }
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    const originalProduct = products.find((p) => p.id === id);

    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );

    if (originalProduct && updates.cantidad !== undefined) {
      const location = locations.find(
        (loc) => loc.id === originalProduct.locationId
      );

      if (location) {
        addMovement({
          action: "Edición",
          productSku: originalProduct.sku,
          productName: originalProduct.nombre,
          quantity: updates.cantidad,
          location: `${location.rack}-${location.nivel}-${location.slot}`,
          user: "Admin",
          previousQuantity: originalProduct.cantidad,
          newQuantity: updates.cantidad,

          costo_proveedor:
            updates.costo_proveedor ?? originalProduct.costo_proveedor ?? 0,
          precio_venta: 0,
          ingreso_total: 0,
          costo_total: 0,
          ganancia: 0,
        });
      }
    }
  };

  const deleteProduct = async (sku: string, venta?: SaleData) => {
    try {
      const product = products.find((p) => p.sku === sku);

      if (!product) {
        console.warn(`⚠️ Producto con SKU ${sku} no encontrado localmente`);
        return;
      }

      /**
       * MODO PRUEBA SIN MQTT:
       * Registra la salida inmediatamente, sin esperar estado LIBRE del ESP32.
       */
      if (TEST_MODE_NO_MQTT) {
        const cantidadVendida = venta?.cantidad_vendida ?? product.cantidad;
        const precioVenta = venta?.precio_venta ?? 0;
        const costoProveedor = product.costo_proveedor ?? 0;

        if (cantidadVendida <= 0) {
          alert("La cantidad vendida debe ser mayor a 0.");
          return;
        }

        if (cantidadVendida > product.cantidad) {
          alert("No puedes vender más cantidad de la existente.");
          return;
        }

        const ingresoTotal = precioVenta * cantidadVendida;
        const costoTotal = costoProveedor * cantidadVendida;
        const ganancia = ingresoTotal - costoTotal;

        const salidaResp = await fetch(
          `${API_URL}/productos/sku/${product.sku}/salida`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              cantidad_vendida: cantidadVendida,
              precio_venta: precioVenta,
              costo_proveedor: costoProveedor,
              ingreso_total: ingresoTotal,
              costo_total: costoTotal,
              ganancia,
            }),
          }
        );

        if (salidaResp.status === 404) {
          console.warn(
            "⚠️ Endpoint /salida no existe. Usando DELETE anterior sin finanzas completas."
          );

          await fetch(`${API_URL}/productos/sku/${product.sku}`, {
            method: "DELETE",
          });
        } else if (!salidaResp.ok) {
          const errorText = await salidaResp.text();
          console.error(
            "❌ Error guardando salida financiera:",
            salidaResp.status,
            errorText
          );
          alert("No se pudo registrar la salida en backend.");
          return;
        }

        await addMovement({
          action: "Egreso",
          productSku: product.sku,
          productName: product.nombre,
          quantity: cantidadVendida,
          location: product.locationId,
          user: "Admin",

          costo_proveedor: costoProveedor,
          precio_venta: precioVenta,
          ingreso_total: ingresoTotal,
          costo_total: costoTotal,
          ganancia,
        });

        if (cantidadVendida === product.cantidad) {
          setProducts((prev) => {
            const updated = prev.filter((p) => p.sku !== sku);
            productsRef.current = updated;
            return updated;
          });

          setLocations((prev) =>
            prev.map((loc) =>
              loc.id === product.locationId
                ? { ...loc, status: "libre" }
                : loc
            )
          );
        } else {
          setProducts((prev) => {
            const updated = prev.map((p) =>
              p.sku === sku
                ? { ...p, cantidad: p.cantidad - cantidadVendida }
                : p
            );

            productsRef.current = updated;
            return updated;
          });
        }

        console.log("[MODO PRUEBA] Salida registrada sin MQTT:", {
          sku,
          cantidadVendida,
          precioVenta,
          ingresoTotal,
          costoTotal,
          ganancia,
        });

        return;
      }

      /**
       * MODO NORMAL CON MQTT:
       * Envía QUITANDO al ESP32 y espera confirmación física LIBRE.
       */
      const [, nivelStr, slotStr] = product.locationId.split("-");
      const nivel = parseInt(nivelStr);
      const slot = parseInt(slotStr);

      const pinMapByLevel: Record<number, Record<number, number>> = {
        1: { 1: 14, 2: 12, 3: 32, 4: 26, 5: 27, 6: 33 },
        2: { 1: 14, 2: 12, 3: 32, 4: 26, 5: 27, 6: 33 },
        3: { 1: 14, 2: 12, 3: 32, 4: 26, 5: 27, 6: 33 },
      };

      const topicByLevel: Record<number, string> = {
        1: "Entrada/L3",
        2: "Entrada/L2",
        3: "Entrada/L1",
      };

      const pin = pinMapByLevel[nivel]?.[slot];
      const topic = topicByLevel[nivel];

      if (pin && topic) {
        const comando = `q${pin}q`;
        await sendMQTT(topic, comando);
        console.log(`QUITANDO enviado → ${topic} → ${comando}`);
      } else {
        console.warn("⚠️ No hay pin configurado para este slot:", slot);
      }

      const pendingDeletion: PendingDeletion = {
        locationId: product.locationId,
        venta,
      };

      setPendingDeletions((prev) => {
        const yaExiste = prev.some(
          (item) => item.locationId === product.locationId
        );

        if (yaExiste) {
          return prev;
        }

        const updated = [...prev, pendingDeletion];
        pendingDeletionsRef.current = updated;
        return updated;
      });

      setLocations((prev) =>
        prev.map((loc) =>
          loc.id === product.locationId ? { ...loc, status: "quitando" } : loc
        )
      );

      console.log(
        `Eliminación pendiente para slot ${product.locationId} esperando LIBRE`
      );
    } catch (error) {
      console.error("❌ Error preparando salida de producto:", error);
      alert("No se pudo preparar la salida del producto.");
    }
  };

  const clearRack = (rack: Rack) => {
    const rackProducts = products.filter((p) => {
      const location = locations.find((loc) => loc.id === p.locationId);
      return location?.rack === rack;
    });

    rackProducts.forEach((product) => {
      const location = locations.find((loc) => loc.id === product.locationId);

      if (location) {
        addMovement({
          action: "Egreso",
          productSku: product.sku,
          productName: product.nombre,
          quantity: product.cantidad,
          location: `${location.rack}-${location.nivel}-${location.slot}`,
          user: "Admin",

          costo_proveedor: product.costo_proveedor ?? 0,
          precio_venta: 0,
          ingreso_total: 0,
          costo_total: 0,
          ganancia: 0,
        });
      }
    });

    const rackLocationIds = locations
      .filter((loc) => loc.rack === rack)
      .map((loc) => loc.id);

    setProducts((prev) =>
      prev.filter((p) => !rackLocationIds.includes(p.locationId))
    );

    setLocations((prev) =>
      prev.map((loc) => (loc.rack === rack ? { ...loc, status: "libre" } : loc))
    );
  };

  const getProductByLocation = (locationId: string) =>
    products.find((p) => p.locationId === locationId);

  const getProductsWithLocation = (): ProductWithLocation[] =>
    products.map((product) => {
      const location = locations.find((loc) => loc.id === product.locationId)!;
      return { ...product, location };
    });

  const getTotalProducts = () => products.length;

  const getLowStockProducts = () => products.filter((p) => p.cantidad <= 10);

  const getMovements = () =>
    [...movements].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

  const updateSlotStatus = (locationId: string, status: SlotStatus) => {
    setLocations((prev) =>
      prev.map((loc) => (loc.id === locationId ? { ...loc, status } : loc))
    );
  };

  const startProductPlacement = (locationId: string) =>
    updateSlotStatus(locationId, "en_proceso");

  const confirmProductPlacement = (locationId: string) =>
    updateSlotStatus(locationId, "ocupado");

  const handleMQTT = React.useCallback((topic: string, data: any) => {
    if (TEST_MODE_NO_MQTT) {
      return;
    }

    console.log("MQTT recibido:", topic, data);

    if (typeof data !== "object" || data === null) return;

    const now = Date.now();

    if (now - lastEventTimeRef.current < 200) {
      console.log("⏭ Evento MQTT ignorado por duplicado");
      return;
    }

    lastEventTimeRef.current = now;

    const pinToSlotMap: Record<number, number> = {
      14: 1,
      12: 2,
      32: 3,
      26: 4,
      27: 5,
      33: 6,
    };

    if (topic.includes("buttons/states")) {
      const level = topic.includes("/L3/")
        ? 1
        : topic.includes("/L2/")
        ? 2
        : topic.includes("/L1/")
        ? 3
        : null;

      if (level === null) {
        console.warn("⚠️ No se pudo detectar nivel en topic:", topic);
        return;
      }

      Object.entries(data).forEach(([key, value]: any) => {
        if (!key.startsWith("p")) return;

        const pin = parseInt(key.replace("p", ""));
        const slotNumber = pinToSlotMap[pin];

        if (!slotNumber) return;

        const estado = value.estado?.toLowerCase();
        const slotId = `A-${level}-${slotNumber}`;

        setLocations((prev) =>
          prev.map((loc) => {
            if (loc.id !== slotId) return loc;

            let newStatus: SlotStatus = "libre";

            if (estado === "colocando") newStatus = "en_proceso";
            else if (estado === "ocupado") newStatus = "ocupado";
            else if (estado === "quitando") newStatus = "quitando";
            else if (estado === "libre") newStatus = "libre";

            if (loc.status !== newStatus) {
              console.log(`Slot ${slotId}: ${loc.status} → ${newStatus}`);
              return { ...loc, status: newStatus };
            }

            return loc;
          })
        );

        if (estado === "ocupado") {
          const slotEstadoUI = locationsRef.current.find(
            (loc) => loc.id === slotId
          );

          if (pendingProductsRef.current.length === 0) {
            console.log("⏭ No hay productos pendientes. Ingreso ignorado.");
            return;
          }

          if (slotEstadoUI?.status !== "en_proceso") {
            console.log("⏭ Slot no estaba en proceso. Ignorando ingreso.");
            return;
          }

          if (processedIngresosRef.current.includes(slotId)) {
            console.log("⏭ Ingreso ya procesado antes:", slotId);
            return;
          }

          const pending = pendingProductsRef.current.find(
            (p) => p.locationId === slotId
          );

          if (!pending) return;

          setProcessedIngresos((prev) => {
            if (prev.includes(slotId)) return prev;

            const updated = [...prev, slotId];
            processedIngresosRef.current = updated;
            return updated;
          });

          setProducts((prev) => {
            const updated = [
              ...prev.filter((p) => p.locationId !== slotId),
              pending,
            ];

            productsRef.current = updated;
            return updated;
          });

          setPendingProducts((prev) => {
            const updated = prev.filter((p) => p.locationId !== slotId);
            pendingProductsRef.current = updated;
            return updated;
          });

          (async () => {
            try {
              const [rack, nivelStr, slotStr] = slotId.split("-");

              const nuevoProducto = {
                sku: pending.sku,
                nombre: pending.nombre,
                cantidad: pending.cantidad,
                costo_proveedor: pending.costo_proveedor ?? 0,
                descripcion: "Agregado desde interfaz RackNova",
                rack,
                nivel: parseInt(nivelStr),
                slot: parseInt(slotStr),
              };

              const resp = await fetch(`${API_URL}/productos`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(nuevoProducto),
              });

              if (!resp.ok) {
                console.error(
                  "❌ Error guardando producto en backend:",
                  resp.status
                );
              } else {
                const saved = await resp.json();
                console.log("Producto guardado una sola vez:", saved);
              }
            } catch (e) {
              console.error("❌ Error en guardado backend tras ingreso:", e);
            }
          })();

          addMovement({
            action: "Ingreso",
            productSku: pending.sku,
            productName: pending.nombre,
            quantity: pending.cantidad,
            location: slotId,
            user: "Admin",

            costo_proveedor: pending.costo_proveedor ?? 0,
            precio_venta: 0,
            ingreso_total: 0,
            costo_total: 0,
            ganancia: 0,
          });

          console.log("Ingreso registrado correctamente:", slotId);
        }

        if (estado === "libre") {
          const deletion = pendingDeletionsRef.current.find(
            (item) => item.locationId === slotId
          );

          if (!deletion) return;

          console.log(`Confirmado egreso de ${slotId}`);

          pendingDeletionsRef.current = pendingDeletionsRef.current.filter(
            (item) => item.locationId !== slotId
          );

          const product = productsRef.current.find(
            (p) => p.locationId === slotId
          );

          if (product) {
            const cantidadVendida =
              deletion.venta?.cantidad_vendida ?? product.cantidad;

            const precioVenta = deletion.venta?.precio_venta ?? 0;
            const costoProveedor = product.costo_proveedor ?? 0;

            const ingresoTotal = precioVenta * cantidadVendida;
            const costoTotal = costoProveedor * cantidadVendida;
            const ganancia = ingresoTotal - costoTotal;

            (async () => {
              try {
                const salidaResp = await fetch(
                  `${API_URL}/productos/sku/${product.sku}/salida`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      cantidad_vendida: cantidadVendida,
                      precio_venta: precioVenta,
                      costo_proveedor: costoProveedor,
                      ingreso_total: ingresoTotal,
                      costo_total: costoTotal,
                      ganancia,
                    }),
                  }
                );

                if (salidaResp.status === 404) {
                  console.warn(
                    "⚠️ Endpoint /salida no existe. Usando DELETE anterior sin finanzas."
                  );

                  await fetch(`${API_URL}/productos/sku/${product.sku}`, {
                    method: "DELETE",
                  });
                } else if (!salidaResp.ok) {
                  console.error(
                    "❌ Error guardando salida financiera:",
                    salidaResp.status
                  );
                }
              } catch (error) {
                console.error("❌ Error en salida financiera:", error);
              }
            })();

            addMovement({
              action: "Egreso",
              productSku: product.sku,
              productName: product.nombre,
              quantity: cantidadVendida,
              location: slotId,
              user: "Admin",

              costo_proveedor: costoProveedor,
              precio_venta: precioVenta,
              ingreso_total: ingresoTotal,
              costo_total: costoTotal,
              ganancia,
            });
          }

          setPendingDeletions((prev) => {
            const updated = prev.filter((item) => item.locationId !== slotId);
            pendingDeletionsRef.current = updated;
            return updated;
          });

          setProducts((prev) => {
            const updated = prev.filter((p) => p.locationId !== slotId);
            productsRef.current = updated;
            return updated;
          });

          setProcessedIngresos((prev) => {
            const updated = prev.filter((id) => id !== slotId);
            processedIngresosRef.current = updated;
            return updated;
          });
        }
      });
    }

    if (topic.includes("system/state")) {
      console.log("Estado del sistema:", data);
    }

    if (topic.includes("Salida")) {
      console.log("Mensaje desde ESP32:", data);
    }
  }, []);

  useEffect(() => {
    if (TEST_MODE_NO_MQTT) {
      console.warn("🟡 MODO PRUEBA ACTIVO: MQTT desactivado.");
      return;
    }

    let cleanup: void | (() => void);
    let cancelled = false;

    import("@/mqtt/mqttClient").then(({ onMQTTMessage }) => {
      if (cancelled) return;

      cleanup = onMQTTMessage((topic: string, data: any) => {
        handleMQTT(topic, data);
      }) as unknown as void | (() => void);
    });

    return () => {
      cancelled = true;

      if (typeof cleanup === "function") {
        cleanup();
      }
    };
  }, [handleMQTT]);

  return (
    <InventoryContext.Provider
      value={{
        products,
        locations,
        movements,
        addProduct,
        updateProduct,
        deleteProduct,
        clearRack,
        getProductByLocation,
        getProductsWithLocation,
        getTotalProducts,
        getLowStockProducts,
        getMovements,
        updateSlotStatus,
        startProductPlacement,
        confirmProductPlacement,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);

  if (context === undefined) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }

  return context;
}
