//modificacion inicia

import { publishMQTT, onMQTTMessage } from "@/mqtt/mqttClient";

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

interface InventoryContextType {
  products: Product[];
  locations: Location[];
  movements: MovementRecord[];
  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (sku: string) => Promise<void>;
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

const InventoryContext = createContext<InventoryContextType | undefined>(
  undefined
);

// 🔹 Generar ubicaciones base
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

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>(generateLocations());
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [processedIngresos, setProcessedIngresos] = useState<string[]>([]);

  // 🆕 Slots que están pendientes de eliminación (se dio clic en "Eliminar")
  const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);
  const productsRef = React.useRef(products);
  const pendingProductsRef = React.useRef(pendingProducts);
  const pendingDeletionsRef = React.useRef(pendingDeletions);
  const locationsRef = React.useRef(locations);
  const processedIngresosRef = React.useRef(processedIngresos);

  // Mantener sincronizadas las refs con los estados
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

  // 🟢 Cargar inventario desde el backend al iniciar
  useEffect(() => {
    const loadInitialProducts = async () => {
      try {
        const resp = await fetch(`${API_URL}/productos`);
        if (!resp.ok) throw new Error(`Error HTTP: ${resp.status}`);

        const data = await resp.json();

        // Adaptar la respuesta del backend al tipo Product de tu frontend
        const loaded: Product[] = data.map((p: any) => ({
          id: String(p.id ?? `${p.sku}-${p.rack}-${p.nivel}-${p.slot}`),
          sku: p.sku,
          nombre: p.nombre,
          cantidad: p.cantidad,
          locationId: `${p.rack}-${p.nivel}-${p.slot}`, // ej: "A-1-3"
        }));

        // Guardar en estado
        setProducts(loaded);

        // Marcar los slots como "ocupado" en locations
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

        console.log("🟢 Inventario inicial cargado:", loaded);
      } catch (err) {
        console.error("❌ Error cargando inventario inicial:", err);
      }
    };

    loadInitialProducts();
  }, []);
  // 🟣 Cargar movimientos desde el backend al iniciar
  useEffect(() => {
    const loadMovements = async () => {
      try {
        const resp = await fetch(`${API_URL}/movimientos`);
        if (!resp.ok) throw new Error("Error cargando movimientos");

        const data = await resp.json();

        const mapped = data.map((m: any) => ({
          id: m.id_mov.toString(),
          action: m.accion,
          productSku: m.sku,
          productName: m.producto,
          quantity: m.cantidad,
          location: m.ubicacion,
          user: m.usuario,
          timestamp: new Date(m.fecha),
        }));

        setMovements(mapped);
        console.log("📥 Movimientos cargados desde MySQL:", mapped);
      } catch (err) {
        console.error("❌ Error al cargar movimientos:", err);
      }
    };

    loadMovements();
  }, []);

  // 🧩 Registrar movimiento
  const addMovement = async (movement) => {
    const newMovement = {
      ...movement,
      id: Date.now().toString(),
      timestamp: new Date(),
    };

    setMovements((prev) => [...prev, newMovement]);

    // Enviar al backend
    await fetch(`${API_URL}/movimientos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: movement.action,
        sku: movement.productSku,
        producto: movement.productName,
        cantidad: movement.quantity,
        ubicacion: movement.location,
        usuario: movement.user ?? "Admin",
      }),
    });
  };

  // ✅ AGREGAR PRODUCTO CON BACKEND (espera confirmación del botón físico)
  const addProduct = async (product: Omit<Product, "id">) => {
    try {
      // 🚫 Validar que el slot esté libre (no ocupado ni en proceso)
      const location = locations.find((loc) => loc.id === product.locationId);
      if (location && location.status !== "libre") {
        alert("❌ El slot no está libre. Debes esperar a que quede en verde.");
        return;
      }

      // 🚫 VALIDACIÓN: evitar duplicados
      const yaExiste = products.some(
        (p) => p.locationId === product.locationId
      );
      if (yaExiste) {
        alert("❌ Este slot ya tiene un producto. Primero elimínalo.");
        return;
      }

      // ===============================
      // REGISTRO BACKEND
      // ===============================

      // ===============================
      // ENVIAR A ESP32 (COLOCANDO)
      // ===============================

      // Extraer nivel y slot
      const [, nivelStr, slotStr] = product.locationId.split("-");
      const nivel = parseInt(nivelStr); // 1 = L3, 2 = L2, 3 = L1
      const slot = parseInt(slotStr);

      // Mapa de pines (igual para los 3 racks)
      const pinMap: Record<number, number> = {
        1: 14,
        2: 12,
        3: 32,
        4: 26,
        5: 35,
        6: 33,
      };

      // Mapa de temas MQTT según nivel del Dashboard
      const nivelToTopic: Record<number, string> = {
        1: "Entrada/L3", // Nivel 1 del dashboard → Rack L3 real
        2: "Entrada/L2", // Nivel 2 → Rack L2 real
        3: "Entrada/L1", // Nivel 3 → Rack L1 real
      };

      const topicCorrecto = nivelToTopic[nivel];
      const pin = pinMap[slot];

      if (pin && topicCorrecto) {
        const comando = `p${pin}c`;
        publishMQTT(topicCorrecto, comando);
        console.log(`📡 Enviado a ESP32 → ${topicCorrecto} → ${comando}`);
      } else {
        console.warn(
          "⚠️ No existe pin o topic para esta ubicación:",
          product.locationId
        );
      }

      // ===============================
      // GUARDAR COMO PENDIENTE
      // ===============================
      const newProduct: Product = { ...product, id: Date.now().toString() };
      setPendingProducts((prev) => [...prev, newProduct]);

      // Pintar en proceso
      startProductPlacement(product.locationId);
    } catch (error) {
      console.error("❌ Error al guardar producto:", error);
      alert("Error al guardar producto en el servidor.");
    }
  };

  // 🟨 EDITAR PRODUCTO (local)
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
        });
      }
    }
  };

  // ✅ ELIMINAR PRODUCTO (mandar QUITANDO y marcar pendiente)
  // ✅ ELIMINAR PRODUCTO (mandar QUITANDO y marcar pendiente)
  const deleteProduct = async (sku: string) => {
    try {
      const product = products.find((p) => p.sku === sku);
      if (!product) {
        console.warn(`⚠️ Producto con SKU ${sku} no encontrado localmente`);
        return;
      }

      const [rack, nivelStr, slotStr] = product.locationId.split("-");
      const nivel = parseInt(nivelStr);
      const slot = parseInt(slotStr);

      // ================================
      // MAPEOS POR NIVEL → PIN POR SLOT
      // ================================
      const pinMapByLevel: Record<number, Record<number, number>> = {
        1: { 1: 14, 2: 12, 3: 32, 4: 26, 5: 35, 6: 33 }, // ESP32 L3
        2: { 1: 14, 2: 12, 3: 32, 4: 26, 5: 27, 6: 33 }, // ESP32 L2
        3: { 1: 14, 2: 27, 3: 32, 4: 26, 5: 35, 6: 33 }, // ESP32 L1
      };

      // ================================
      // MAPEO NIVEL DASHBOARD → TOPIC MQTT
      // ================================
      const topicByLevel: Record<number, string> = {
        1: "Entrada/L3", // dashboard nivel 1 → L3 físico
        2: "Entrada/L2",
        3: "Entrada/L1",
      };

      const pin = pinMapByLevel[nivel]?.[slot];
      const topic = topicByLevel[nivel];

      if (pin && topic) {
        const comando = `q${pin}q`;
        publishMQTT(topic, comando);
        console.log(`📡 QUITANDO enviado → ${topic} → ${comando}`);
      } else {
        console.warn("⚠️ No hay pin configurado para este slot:", slot);
      }

      // =======================================
      // ❌ ELIMINAR EN BACKEND INMEDIATAMENTE
      // =======================================
      const response = await fetch(`${API_URL}/productos/sku/${sku}`, {
        method: "DELETE",
      });

      if (!response.ok)
        throw new Error("Error al eliminar producto en el servidor");

      // =======================================
      // 🟣 MARCAR SLOT COMO PENDIENTE (QUITANDO)
      // =======================================
      setPendingDeletions((prev) => [...prev, product.locationId]);

      console.log(
        `🕐 Eliminación pendiente para slot ${product.locationId} (esperando LIBRE)`
      );
    } catch (error) {
      console.error("❌ Error eliminando producto:", error);
      alert("No se pudo eliminar el producto en el servidor.");
    }
  };

  // 🧹 LIMPIAR RACK
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
    movements.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const updateSlotStatus = (locationId: string, status: SlotStatus) => {
    setLocations((prev) =>
      prev.map((loc) => (loc.id === locationId ? { ...loc, status } : loc))
    );
  };

  const startProductPlacement = (locationId: string) =>
    updateSlotStatus(locationId, "en_proceso");

  const confirmProductPlacement = (locationId: string) =>
    updateSlotStatus(locationId, "ocupado");
  // ======================================================
  // 🧠 FUNCIÓN QUE PROCESA TODOS LOS EVENTOS MQTT
  // ======================================================
  const handleMQTT = React.useCallback((topic: string, data: any) => {
    console.log("📡 MQTT recibido:", topic, data);

    if (typeof data !== "object") return;

    // 🛡️ Anti-duplicados: bloquear eventos repetidos en menos de 200ms
    let lastEventTime = 0;

    const now = Date.now();
    if (now - lastEventTime < 200) {
      console.log("⏭ Evento MQTT ignorado por duplicado");
      return;
    }
    lastEventTime = now;

    const pinToSlotMap: Record<number, number> = {
      14: 1,
      12: 2,
      32: 3,
      26: 4,
      35: 5,
      33: 6,
    };

    // 🎯 Solo procesamos estados de botones
    if (topic.includes("buttons/states")) {
      // 👇 NUEVO: decidir el nivel según el topic MQTT
      const level = topic.includes("/L3/")
        ? 1 // rack/L3 → nivel 1
        : topic.includes("/L2/")
        ? 2 // rack/L2 → nivel 2
        : topic.includes("/L1/")
        ? 3 // rack/L1 → nivel 3
        : null;

      Object.entries(data).forEach(([key, value]: any) => {
        if (!key.startsWith("p")) return;

        const pin = parseInt(key.replace("p", ""));
        const slotNumber = pinToSlotMap[pin];
        if (!slotNumber) return;

        const estado = value.estado?.toLowerCase();

        // 👇 ANTES: const slotId = `A-1-${slotNumber}`;
        // 👇 AHORA: usamos el nivel dinámico
        const slotId = `A-${level}-${slotNumber}`;

        // ======================================================
        // 🎨 Actualizar UI (color de slot)
        // ======================================================
        setLocations((prev) =>
          prev.map((loc) => {
            if (loc.id !== slotId) return loc;

            let newStatus: SlotStatus = "libre";
            if (estado === "colocando") newStatus = "en_proceso";
            else if (estado === "ocupado") newStatus = "ocupado";
            else if (estado === "quitando") newStatus = "quitando";
            else if (estado === "libre") newStatus = "libre";

            if (loc.status !== newStatus) {
              console.log(`🎨 Slot ${slotId}: ${loc.status} → ${newStatus}`);
              return { ...loc, status: newStatus };
            }

            return loc;
          })
        );

        // ======================================================
        // 🟢 CONFIRMACIÓN FÍSICA DE INGRESO
        // ======================================================
        // 🟢 CONFIRMACIÓN FÍSICA DE INGRESO
        if (estado === "ocupado") {
          const slotEstadoUI = locationsRef.current.find(
            (loc) => loc.id === slotId
          );

          if (pendingProductsRef.current.length === 0) {
            console.log("⏭ No hay productos pendientes. Ingreso ignorado.");
            return;
          }

          // Si YA estaba en ocupado → ignorar flood
          // ❗ Si este slot NO estaba en proceso, ignorar
          if (slotEstadoUI?.status !== "en_proceso") {
            console.log("⏭ Slot no estaba en proceso. Ignorando ingreso.");
            return;
          }

          // Si YA lo procesamos → ignorar duplicados
          if (processedIngresosRef.current.includes(slotId)) {
            console.log("⏭ Ya procesado antes");
            return;
          }

          // Buscar producto pendiente
          const pending = pendingProductsRef.current.find(
            (p) => p.locationId === slotId
          );

          if (pending) {
            // 🛡️ 1️⃣ Registrar inmediatamente que este slot ya fue procesado
            //     (ANTES de mover, guardar o registrar movimiento)
            if (!processedIngresosRef.current.includes(slotId)) {
              processedIngresosRef.current.push(slotId);
            }

            // 🛡️ Marcar también en React state para persistencia
            setProcessedIngresos((prev) => {
              if (prev.includes(slotId)) return prev;
              const updated = [...prev, slotId];
              processedIngresosRef.current = updated;
              return updated;
            });

            console.log("🛡️ Slot marcado como procesado:", slotId);

            // 2️⃣ Mover a inventario final
            setProducts((prev) => {
              const updated = [
                ...prev.filter((p) => p.locationId !== slotId),
                pending,
              ];
              productsRef.current = updated;
              return updated;
            });

            // 3️⃣ Quitar del arreglo de pendientes
            setPendingProducts((prev) => {
              const updated = prev.filter((p) => p.locationId !== slotId);
              pendingProductsRef.current = updated;
              return updated;
            });

            // 4️⃣ Guardar en la base de datos SOLO una vez (confirmación física)
            (async () => {
              try {
                const [rack, nivelStr, slotStr] = slotId.split("-");

                const nuevoProducto = {
                  sku: pending.sku,
                  nombre: pending.nombre,
                  cantidad: pending.cantidad,
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
                  console.log("💾 Producto guardado **UNA SOLA VEZ**:", saved);
                }
              } catch (e) {
                console.error("❌ Error en guardado backend tras INGRESO:", e);
              }
            })();

            // 5️⃣ Registrar movimiento (una sola vez)
            addMovement({
              action: "Ingreso",
              productSku: pending.sku,
              productName: pending.nombre,
              quantity: pending.cantidad,
              location: slotId,
              user: "Admin",
            });

            console.log("🟢 INGRESO registrado correctamente (solo 1 vez)");
          }
        }

        // ======================================================
        // 🟣 CONFIRMACIÓN FÍSICA DE EGRESO
        // ======================================================
        if (estado === "libre") {
          if (pendingDeletionsRef.current.includes(slotId)) {
            console.log(`🟣 Confirmado egreso de ${slotId}`);

            // 🚫 BLOQUEAR AHORA MISMO PARA EVITAR DUPLICADOS
            pendingDeletionsRef.current = pendingDeletionsRef.current.filter(
              (id) => id !== slotId
            );

            // Registrar movimiento y eliminar producto
            setProducts((prev) => {
              const product = prev.find((p) => p.locationId === slotId);

              if (product) {
                addMovement({
                  action: "Egreso",
                  productSku: product.sku,
                  productName: product.nombre,
                  quantity: product.cantidad,
                  location: slotId,
                  user: "Admin",
                });
              }

              const updated = prev.filter((p) => p.locationId !== slotId);
              productsRef.current = updated;
              return updated;
            });

            // Quitar de pendientes EN ESTADO DE REACT (sin urgencia)
            setPendingDeletions((prev) => {
              const updated = prev.filter((id) => id !== slotId);
              pendingDeletionsRef.current = updated;
              return updated;
            });
          }
        }
      });
    }

    if (topic.includes("system/state")) {
      console.log("🔐 Estado del sistema:", data);
    }

    if (topic.includes("Salida")) {
      console.log("💬 Mensaje desde ESP32:", data);
    }
  }, []);

  // ======================================================
  // 🌐 LISTENER MQTT ESTÁTICO — SOLO UNA VEZ
  // ======================================================
  useEffect(() => {
    onMQTTMessage((topic, data) => {
      handleMQTT(topic, data);
    });
  }, []);

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

//modificacion cierra
