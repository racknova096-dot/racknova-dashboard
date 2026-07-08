import { API_URL } from "../config";
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
  useCallback,
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
 * true = NO conecta MQTT y permite registrar sin confirmación física.
 * false = usa MQTT normal con ESP32.
 */
const TEST_MODE_NO_MQTT = true;

interface InventoryContextType {
  products: Product[];
  locations: Location[];
  movements: MovementRecord[];

  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
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

const mapBackendProduct = (p: any): Product => {
  const rack = p.rack ?? "A";
  const nivel = p.nivel ?? "1";
  const slot = p.slot ?? "1";

  return {
    id: String(p.id_producto ?? p.id ?? `${p.sku}-${rack}-${nivel}-${slot}`),
    locationId: `${rack}-${nivel}-${slot}`,

    sku: p.sku,
    nombre: p.nombre,
    descripcion: p.descripcion ?? null,

    cantidad: Number(p.cantidad ?? 0),

    costo_proveedor: Number(p.costo_proveedor ?? 0),
    precio_venta_sugerido: Number(p.precio_venta_sugerido ?? 0),

    caducidad: p.caducidad ?? null,

    stock_minimo: Number(p.stock_minimo ?? 10),
    stock_alto: Number(p.stock_alto ?? 30),
  };
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

  const productsRef = useRef<Product[]>(products);
  const pendingProductsRef = useRef<Product[]>(pendingProducts);
  const pendingDeletionsRef = useRef<PendingDeletion[]>(pendingDeletions);
  const locationsRef = useRef<Location[]>(locations);
  const processedIngresosRef = useRef<string[]>(processedIngresos);
  const lastEventTimeRef = useRef(0);

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
        const loaded: Product[] = data.map(mapBackendProduct);

        setProducts(loaded);
        productsRef.current = loaded;

        setLocations((prev) =>
          prev.map((loc) => {
            const hayProducto = loaded.some(
              (prod) => prod.locationId === loc.id
            );

            if (hayProducto) {
              return { ...loc, status: "ocupado" };
            }

            return { ...loc, status: "libre" };
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
      const productoExistente = products.find(
        (p) =>
          p.sku.trim().toLowerCase() === product.sku.trim().toLowerCase()
      );

      const finalLocationId =
        productoExistente?.locationId ?? product.locationId;

      const location = locations.find((loc) => loc.id === finalLocationId);

      if (!location) {
        alert("❌ La ubicación seleccionada no existe.");
        return;
      }

      const esRestock = Boolean(productoExistente);

      if (!esRestock) {
        if (location.status !== "libre") {
          alert("❌ El slot no está libre.");
          return;
        }

        const slotOcupado = products.some(
          (p) => p.locationId === finalLocationId
        );

        if (slotOcupado) {
          alert("❌ Este slot ya tiene un producto. Primero elimínalo.");
          return;
        }
      }

      const [rack, nivelStr, slotStr] = finalLocationId.split("-");

      const productoBackend = {
        sku: product.sku,
        nombre: product.nombre,
        descripcion: product.descripcion ?? null,
        cantidad: Number(product.cantidad ?? 0),
        costo_proveedor: Number(product.costo_proveedor ?? 0),
        precio_venta_sugerido: Number(product.precio_venta_sugerido ?? 0),
        caducidad: product.caducidad || null,
        stock_minimo: Number(product.stock_minimo ?? 10),
        stock_alto: Number(product.stock_alto ?? 30),
        rack,
        nivel: nivelStr,
        slot: slotStr,
      };

      const newProduct: Product = {
        ...product,
        id: productoExistente?.id ?? Date.now().toString(),
        locationId: finalLocationId,
        descripcion: product.descripcion ?? null,
        costo_proveedor: Number(product.costo_proveedor ?? 0),
        precio_venta_sugerido: Number(product.precio_venta_sugerido ?? 0),
        caducidad: product.caducidad ?? null,
        stock_minimo: Number(product.stock_minimo ?? 10),
        stock_alto: Number(product.stock_alto ?? 30),
      };

      if (TEST_MODE_NO_MQTT) {
        const resp = await fetch(`${API_URL}/productos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(productoBackend),
        });

        if (!resp.ok) {
          const errorText = await resp.text();
          console.error("❌ Error guardando producto:", resp.status, errorText);
          alert("No se pudo guardar el producto en backend.");
          return;
        }

        const saved = await resp.json();
        const savedProduct = mapBackendProduct(saved);

        setProducts((prev) => {
          const updated = [
            ...prev.filter(
              (p) =>
                p.sku.trim().toLowerCase() !==
                savedProduct.sku.trim().toLowerCase()
            ),
            savedProduct,
          ];

          productsRef.current = updated;
          return updated;
        });

        setLocations((prev) =>
          prev.map((loc) =>
            loc.id === savedProduct.locationId
              ? { ...loc, status: "ocupado" }
              : loc
          )
        );

        const costoProveedorIngreso = Number(product.costo_proveedor ?? 0);
        const cantidadIngreso = Number(product.cantidad ?? 0);
        const costoTotalIngreso = costoProveedorIngreso * cantidadIngreso;

        await addMovement({
          action: "Ingreso",
          productSku: savedProduct.sku,
          productName: savedProduct.nombre,
          quantity: cantidadIngreso,
          location: savedProduct.locationId,
          user: "Admin",
          costo_proveedor: costoProveedorIngreso,
          precio_venta: 0,
          ingreso_total: 0,
          costo_total: costoTotalIngreso,
          ganancia: 0,
        });

        console.log(
          esRestock
            ? "[MODO PRUEBA] Restock registrado sin MQTT:"
            : "[MODO PRUEBA] Producto registrado sin MQTT:",
          savedProduct
        );

        return;
      }

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

      if (pin && topicCorrecto && !esRestock) {
        const comando = `p${pin}c`;
        await sendMQTT(topicCorrecto, comando);
        console.log(`Enviado a ESP32 → ${topicCorrecto} → ${comando}`);
      } else if (esRestock) {
        console.log(
          "Restock detectado. Se conserva ubicación actual:",
          finalLocationId
        );
      } else {
        console.warn(
          "⚠️ No existe pin o topic para esta ubicación:",
          finalLocationId
        );
      }

      setPendingProducts((prev) => {
        const updated = [...prev, newProduct];
        pendingProductsRef.current = updated;
        return updated;
      });

      if (!esRestock) {
        startProductPlacement(finalLocationId);
      }
    } catch (error) {
      console.error("❌ Error al preparar producto:", error);
      alert("Error al preparar producto.");
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const originalProduct = products.find((p) => p.id === id);

    if (!originalProduct) {
      console.warn("Producto no encontrado para actualizar:", id);
      return;
    }

    const updatedProduct: Product = {
      ...originalProduct,
      ...updates,
      descripcion: updates.descripcion ?? originalProduct.descripcion ?? null,
      costo_proveedor: Number(
        updates.costo_proveedor ?? originalProduct.costo_proveedor ?? 0
      ),
      precio_venta_sugerido: Number(
        updates.precio_venta_sugerido ??
          originalProduct.precio_venta_sugerido ??
          0
      ),
      caducidad: updates.caducidad ?? originalProduct.caducidad ?? null,
      stock_minimo: Number(
        updates.stock_minimo ?? originalProduct.stock_minimo ?? 10
      ),
      stock_alto: Number(
        updates.stock_alto ?? originalProduct.stock_alto ?? 30
      ),
    };

    const [rack, nivelStr, slotStr] = updatedProduct.locationId.split("-");

    const resp = await fetch(`${API_URL}/productos/${originalProduct.sku}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sku: updatedProduct.sku,
        nombre: updatedProduct.nombre,
        descripcion: updatedProduct.descripcion ?? null,
        cantidad: updatedProduct.cantidad,
        rack,
        nivel: nivelStr,
        slot: slotStr,
        costo_proveedor: Number(updatedProduct.costo_proveedor ?? 0),
        precio_venta_sugerido: Number(
          updatedProduct.precio_venta_sugerido ?? 0
        ),
        caducidad: updatedProduct.caducidad || null,
        stock_minimo: Number(updatedProduct.stock_minimo ?? 10),
        stock_alto: Number(updatedProduct.stock_alto ?? 30),
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("❌ Error actualizando producto:", resp.status, errorText);
      throw new Error("No se pudo actualizar el producto en backend.");
    }

    const saved = await resp.json();
    const savedProduct = mapBackendProduct(saved);

    setProducts((prev) =>
      prev.map((p) => (p.id === id ? savedProduct : p))
    );

    if (updates.cantidad !== undefined) {
      await addMovement({
        action: "Edición",
        productSku: originalProduct.sku,
        productName: originalProduct.nombre,
        quantity: Number(updates.cantidad),
        location: originalProduct.locationId,
        user: "Admin",
        previousQuantity: originalProduct.cantidad,
        newQuantity: Number(updates.cantidad),
        costo_proveedor:
          updates.costo_proveedor ?? originalProduct.costo_proveedor ?? 0,
        precio_venta: 0,
        ingreso_total: 0,
        costo_total: 0,
        ganancia: 0,
      });
    }
  };

  const deleteProduct = async (sku: string, venta?: SaleData) => {
    try {
      const product = products.find((p) => p.sku === sku);

      if (!product) {
        console.warn(`⚠️ Producto con SKU ${sku} no encontrado localmente`);
        return;
      }

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

        if (!salidaResp.ok) {
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
              loc.id === product.locationId ? { ...loc, status: "libre" } : loc
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
      addMovement({
        action: "Egreso",
        productSku: product.sku,
        productName: product.nombre,
        quantity: product.cantidad,
        location: product.locationId,
        user: "Admin",
        costo_proveedor: product.costo_proveedor ?? 0,
        precio_venta: 0,
        ingreso_total: 0,
        costo_total: 0,
        ganancia: 0,
      });
    });

    const rackLocationIds = locations
      .filter((loc) => loc.rack === rack)
      .map((loc) => loc.id);

    setProducts((prev) =>
      prev.filter((p) => !rackLocationIds.includes(p.locationId))
    );

    setLocations((prev) =>
      prev.map((loc) =>
        loc.rack === rack ? { ...loc, status: "libre" } : loc
      )
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

  const getLowStockProducts = () =>
    products.filter((p) => p.cantidad <= Number(p.stock_minimo ?? 10));

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

  const handleMQTT = useCallback((topic: string, data: any) => {
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
      console.warn("MODO PRUEBA ACTIVO: MQTT desactivado.");
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
