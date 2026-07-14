import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
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
import { canModifyInventory } from "@/lib/roles";
import { apiFetch, getAuthToken } from "@/lib/api";

/**
 * MODO PRUEBA:
 * true = NO conecta MQTT y permite registrar sin confirmación física.
 * false = usa MQTT normal con ESP32.
 */
const TEST_MODE_NO_MQTT = true;

interface PhysicalSearchResult {
  ok: boolean;
  topic?: string;
  comando?: string;
  mensaje: string;
  mqttDisabled?: boolean;
}

interface PendingDeletion {
  locationId: string;
  venta?: SaleData;
}

interface InventoryContextType {
  products: Product[];
  locations: Location[];
  movements: MovementRecord[];

  isProductsLoading: boolean;
  isMovementsLoading: boolean;
  isInventoryLoading: boolean;

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

  buscarFisicamente: (locationId: string) => Promise<PhysicalSearchResult>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(
  undefined
);

const generateLocations = (): Location[] => {
  const generatedLocations: Location[] = [];
  const racks: Rack[] = ["A", "B", "C", "D", "E"];

  racks.forEach((rack) => {
    [1, 2, 3].forEach((nivel) => {
      Array.from({ length: 6 }, (_, index) => index + 1).forEach((slot) => {
        generatedLocations.push({
          id: `${rack}-${nivel}-${slot}`,
          rack,
          nivel: nivel as Nivel,
          slot,
          status: "libre",
        });
      });
    });
  });

  return generatedLocations;
};

const mapBackendProduct = (product: any): Product => {
  const rack = product.rack ?? "A";
  const nivel = product.nivel ?? "1";
  const slot = product.slot ?? "1";

  return {
    id: String(
      product.id_producto ?? product.id ?? `${product.sku}-${rack}-${nivel}-${slot}`
    ),
    locationId: `${rack}-${nivel}-${slot}`,
    sku: product.sku,
    nombre: product.nombre,
    descripcion: product.descripcion ?? null,
    cantidad: Number(product.cantidad ?? 0),
    costo_proveedor: Number(product.costo_proveedor ?? 0),
    precio_venta_sugerido: Number(product.precio_venta_sugerido ?? 0),
    caducidad: product.caducidad ?? null,
    stock_minimo: Number(product.stock_minimo ?? 10),
    stock_alto: Number(product.stock_alto ?? 30),
  };
};

const mapBackendMovement = (movement: any): MovementRecord => {
  return {
    id: String(movement.id_mov ?? movement.id ?? Date.now()),
    action: movement.accion,
    productSku: movement.sku,
    productName: movement.producto,
    quantity: Number(movement.cantidad ?? 0),
    location: movement.ubicacion,
    user: movement.usuario,
    timestamp: new Date(movement.fecha),
    costo_proveedor: Number(movement.costo_proveedor ?? 0),
    precio_venta: Number(movement.precio_venta ?? 0),
    ingreso_total: Number(movement.ingreso_total ?? 0),
    costo_total: Number(movement.costo_total ?? 0),
    ganancia: Number(movement.ganancia ?? 0),
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
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>(
    []
  );

  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [isMovementsLoading, setIsMovementsLoading] = useState(true);

  const isInventoryLoading = isProductsLoading || isMovementsLoading;

  const productsRef = useRef(products);
  const pendingProductsRef = useRef(pendingProducts);
  const pendingDeletionsRef = useRef(pendingDeletions);
  const locationsRef = useRef(locations);
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

  const getCurrentUserName = () => {
    const nombre = localStorage.getItem("nombre");
    const usuario = localStorage.getItem("usuario");
    const rol = localStorage.getItem("rol");

    if (nombre && nombre.trim()) return nombre.trim();
    if (usuario && usuario.trim()) return usuario.trim();
    if (rol && rol.trim()) return rol.trim();

    return "Sistema";
  };

 useEffect(() => {
  const loadInitialProducts = async () => {
    const token = getAuthToken();

    if (!token) {
      setIsProductsLoading(false);
      return;
    }

    try {
      setIsProductsLoading(true);

      const response = await apiFetch("/productos");

        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        const loadedProducts: Product[] = data.map(mapBackendProduct);

        setProducts(loadedProducts);
        productsRef.current = loadedProducts;

        setLocations((prev) =>
          prev.map((location) => {
            const hasProduct = loadedProducts.some(
              (product) => product.locationId === location.id
            );

            return hasProduct
              ? { ...location, status: "ocupado" }
              : { ...location, status: "libre" };
          })
        );

        console.log("Inventario inicial cargado:", loadedProducts);
      } catch (error) {
        console.error("❌ Error cargando inventario inicial:", error);
      } finally {
        setIsProductsLoading(false);
      }
    };

    loadInitialProducts();
  }, []);

 useEffect(() => {
  const loadMovements = async () => {
    const token = getAuthToken();

    if (!token) {
      setIsMovementsLoading(false);
      return;
    }

    try {
      setIsMovementsLoading(true);

      const response = await apiFetch("/movimientos");
        if (!response.ok) {
          throw new Error("Error cargando movimientos");
        }

        const data = await response.json();
        const mappedMovements: MovementRecord[] = data.map(mapBackendMovement);

        setMovements(mappedMovements);

        console.log("Movimientos cargados desde backend:", mappedMovements);
      } catch (error) {
        console.error("❌ Error al cargar movimientos:", error);
      } finally {
        setIsMovementsLoading(false);
      }
    };

    loadMovements();
  }, []);

  const addMovement = async (
    movement: Omit<MovementRecord, "id" | "timestamp">
  ) => {
    const currentUser = movement.user || getCurrentUserName();

    const newMovement: MovementRecord = {
      ...movement,
      user: currentUser,
      id: Date.now().toString(),
      timestamp: new Date(),
    };

    setMovements((prev) => [...prev, newMovement]);

    try {
      const response = await apiFetch("/movimientos", {
        method: "POST",
        body: JSON.stringify({
          accion: newMovement.action,
          sku: newMovement.productSku,
          producto: newMovement.productName,
          cantidad: newMovement.quantity,
          ubicacion: newMovement.location,
          usuario: currentUser,
          costo_proveedor: newMovement.costo_proveedor ?? 0,
          precio_venta: newMovement.precio_venta ?? 0,
          ingreso_total: newMovement.ingreso_total ?? 0,
          costo_total: newMovement.costo_total ?? 0,
          ganancia: newMovement.ganancia ?? 0,
        }),
      });

      if (!response.ok) {
        console.error("❌ Error guardando movimiento:", response.status);
      }
    } catch (error) {
      console.error("❌ Error enviando movimiento al backend:", error);
    }
  };

  const addProduct = async (product: Omit<Product, "id">) => {
    if (!canModifyInventory()) {
      alert("Tu usuario es de solo lectura. No puedes agregar productos.");
      return;
    }

    try {
      const existingProduct = products.find((item) => {
        const currentSku = item.sku.trim().toLowerCase();
        const currentName = item.nombre.trim().toLowerCase();
        const newSku = product.sku.trim().toLowerCase();
        const newName = product.nombre.trim().toLowerCase();

        return currentSku === newSku || currentName === newName;
      });

      const finalLocationId = existingProduct?.locationId ?? product.locationId;

      const location = locations.find((item) => item.id === finalLocationId);

      if (!location) {
        alert("❌ La ubicación seleccionada no existe.");
        return;
      }

      const isRestock = Boolean(existingProduct);

      if (!isRestock) {
        if (location.status !== "libre") {
          alert("❌ El slot no está libre.");
          return;
        }

        const slotOccupied = products.some(
          (item) => item.locationId === finalLocationId
        );

        if (slotOccupied) {
          alert("❌ Este slot ya tiene un producto. Primero elimínalo.");
          return;
        }
      }

      const [rack, nivelStr, slotStr] = finalLocationId.split("-");

      const backendProduct = {
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
        id: existingProduct?.id ?? Date.now().toString(),
        locationId: finalLocationId,
        descripcion: product.descripcion ?? null,
        costo_proveedor: Number(product.costo_proveedor ?? 0),
        precio_venta_sugerido: Number(product.precio_venta_sugerido ?? 0),
        caducidad: product.caducidad ?? null,
        stock_minimo: Number(product.stock_minimo ?? 10),
        stock_alto: Number(product.stock_alto ?? 30),
      };

      if (TEST_MODE_NO_MQTT) {
        const response = await apiFetch("/productos", {
          method: "POST",
          body: JSON.stringify(backendProduct),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Error guardando producto:", response.status, errorText);
          alert("No se pudo guardar el producto en backend.");
          return;
        }

        const saved = await response.json();
        const savedProduct = mapBackendProduct(saved);

        setProducts((prev) => {
          const updated = [
            ...prev.filter(
              (item) =>
                item.sku.trim().toLowerCase() !==
                savedProduct.sku.trim().toLowerCase()
            ),
            savedProduct,
          ];

          productsRef.current = updated;
          return updated;
        });

        setLocations((prev) =>
          prev.map((item) =>
            item.id === savedProduct.locationId
              ? { ...item, status: "ocupado" }
              : item
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
          user: getCurrentUserName(),
          costo_proveedor: costoProveedorIngreso,
          precio_venta: 0,
          ingreso_total: 0,
          costo_total: costoTotalIngreso,
          ganancia: 0,
        });

        console.log(
          isRestock
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

      if (pin && topicCorrecto && !isRestock) {
        const comando = `p${pin}c`;
        await sendMQTT(topicCorrecto, comando);
        console.log(`Enviado a ESP32 → ${topicCorrecto} → ${comando}`);
      } else if (isRestock) {
        console.log("Restock detectado. Se conserva ubicación actual:", finalLocationId);
      } else {
        console.warn("⚠️ No existe pin o topic para esta ubicación:", finalLocationId);
      }

      setPendingProducts((prev) => {
        const updated = [...prev, newProduct];
        pendingProductsRef.current = updated;
        return updated;
      });

      if (!isRestock) {
        startProductPlacement(finalLocationId);
      }
    } catch (error) {
      console.error("❌ Error al preparar producto:", error);
      alert("Error al preparar producto.");
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    if (!canModifyInventory()) {
      alert("Tu usuario es de solo lectura. No puedes modificar productos.");
      return;
    }

    const originalProduct = products.find((item) => item.id === id);

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
      stock_alto: Number(updates.stock_alto ?? originalProduct.stock_alto ?? 30),
    };

    const [rack, nivelStr, slotStr] = updatedProduct.locationId.split("-");

    const response = await apiFetch(
      `/productos/${encodeURIComponent(originalProduct.sku)}`,
      {
        method: "PUT",
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
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error actualizando producto:", response.status, errorText);
      throw new Error("No se pudo actualizar el producto en backend.");
    }

    const saved = await response.json();
    const savedProduct = mapBackendProduct(saved);

    setProducts((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? savedProduct : item
      );

      productsRef.current = updated;
      return updated;
    });

    if (updates.cantidad !== undefined) {
      await addMovement({
        action: "Edición",
        productSku: originalProduct.sku,
        productName: originalProduct.nombre,
        quantity: Number(updates.cantidad),
        location: originalProduct.locationId,
        user: getCurrentUserName(),
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
    if (!canModifyInventory()) {
      alert(
        "Tu usuario es de solo lectura. No puedes registrar salidas ni eliminar productos."
      );
      return;
    }

    try {
      const product = products.find((item) => item.sku === sku);

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

        const response = await apiFetch(
          `/productos/sku/${encodeURIComponent(product.sku)}/salida`,
          {
            method: "POST",
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

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "❌ Error guardando salida financiera:",
            response.status,
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
          user: getCurrentUserName(),
          costo_proveedor: costoProveedor,
          precio_venta: precioVenta,
          ingreso_total: ingresoTotal,
          costo_total: costoTotal,
          ganancia,
        });

        if (cantidadVendida === product.cantidad) {
          setProducts((prev) => {
            const updated = prev.filter((item) => item.sku !== sku);
            productsRef.current = updated;
            return updated;
          });

          setLocations((prev) =>
            prev.map((item) =>
              item.id === product.locationId
                ? { ...item, status: "libre" }
                : item
            )
          );
        } else {
          setProducts((prev) => {
            const updated = prev.map((item) =>
              item.sku === sku
                ? { ...item, cantidad: item.cantidad - cantidadVendida }
                : item
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
        const exists = prev.some(
          (item) => item.locationId === product.locationId
        );

        if (exists) return prev;

        const updated = [...prev, pendingDeletion];
        pendingDeletionsRef.current = updated;
        return updated;
      });

      setLocations((prev) =>
        prev.map((item) =>
          item.id === product.locationId ? { ...item, status: "quitando" } : item
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
    if (!canModifyInventory()) {
      alert("Tu usuario es de solo lectura. No puedes limpiar racks.");
      return;
    }

    const rackProducts = products.filter((product) => {
      const location = locations.find((item) => item.id === product.locationId);
      return location?.rack === rack;
    });

    rackProducts.forEach((product) => {
      addMovement({
        action: "Egreso",
        productSku: product.sku,
        productName: product.nombre,
        quantity: product.cantidad,
        location: product.locationId,
        user: getCurrentUserName(),
        costo_proveedor: product.costo_proveedor ?? 0,
        precio_venta: 0,
        ingreso_total: 0,
        costo_total: 0,
        ganancia: 0,
      });
    });

    const rackLocationIds = locations
      .filter((location) => location.rack === rack)
      .map((location) => location.id);

    setProducts((prev) =>
      prev.filter((product) => !rackLocationIds.includes(product.locationId))
    );

    setLocations((prev) =>
      prev.map((location) =>
        location.rack === rack ? { ...location, status: "libre" } : location
      )
    );
  };

  const getProductByLocation = (locationId: string) => {
    return products.find((product) => product.locationId === locationId);
  };

  const getProductsWithLocation = (): ProductWithLocation[] => {
    return products.map((product) => {
      const location = locations.find((item) => item.id === product.locationId)!;

      return {
        ...product,
        location,
      };
    });
  };

  const getTotalProducts = () => products.length;

  const getLowStockProducts = () => {
    return products.filter(
      (product) => product.cantidad <= Number(product.stock_minimo ?? 10)
    );
  };

  const getMovements = () => {
    return [...movements].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  };

  const updateSlotStatus = (locationId: string, status: SlotStatus) => {
    setLocations((prev) =>
      prev.map((location) =>
        location.id === locationId ? { ...location, status } : location
      )
    );
  };

  const startProductPlacement = (locationId: string) => {
    updateSlotStatus(locationId, "en_proceso");
  };

  const confirmProductPlacement = (locationId: string) => {
    updateSlotStatus(locationId, "ocupado");
  };

  const buscarFisicamente = async (
    locationId: string
  ): Promise<PhysicalSearchResult> => {
    const [, nivelStr, slotStr] = locationId.split("-");

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

    const topicByLevel: Record<number, string> = {
      1: "Entrada/L3",
      2: "Entrada/L2",
      3: "Entrada/L1",
    };

    const pin = pinMap[slot];
    const topic = topicByLevel[nivel];

    if (!pin || !topic) {
      return {
        ok: false,
        mensaje: `No hay pin/topic configurado para la ubicación ${locationId}.`,
      };
    }

    const comando = `b${pin}b`;

    if (TEST_MODE_NO_MQTT) {
      console.log("[MODO PRUEBA] Buscar físicamente:", {
        locationId,
        topic,
        comando,
      });

      return {
        ok: true,
        topic,
        comando,
        mqttDisabled: true,
        mensaje: `Modo prueba activo. Se simuló búsqueda física: ${topic} → ${comando}`,
      };
    }

    await sendMQTT(topic, comando);

    console.log("Buscar físicamente enviado:", {
      locationId,
      topic,
      comando,
    });

    return {
      ok: true,
      topic,
      comando,
      mensaje: `Comando enviado: ${topic} → ${comando}`,
    };
  };

  const handleMQTT = useCallback((topic: string, data: any) => {
    if (TEST_MODE_NO_MQTT) return;

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
          prev.map((location) => {
            if (location.id !== slotId) return location;

            let newStatus: SlotStatus = "libre";

            if (estado === "colocando") newStatus = "en_proceso";
            else if (estado === "ocupado") newStatus = "ocupado";
            else if (estado === "quitando") newStatus = "quitando";
            else if (estado === "libre") newStatus = "libre";

            if (location.status !== newStatus) {
              console.log(`Slot ${slotId}: ${location.status} → ${newStatus}`);
              return { ...location, status: newStatus };
            }

            return location;
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

        isProductsLoading,
        isMovementsLoading,
        isInventoryLoading,

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

        buscarFisicamente,
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
