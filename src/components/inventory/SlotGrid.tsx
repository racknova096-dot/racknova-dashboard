import React, { useEffect, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { Location, Nivel } from "@/types/inventory";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { onMQTTMessage } from "@/mqtt/mqttClient"; // ✅ Escucha mensajes MQTT

interface SlotGridProps {
  rack: string;
  nivel: Nivel;
  onSlotClick: (location: Location, hasProduct: boolean) => void;
}

export function SlotGrid({ rack, nivel, onSlotClick }: SlotGridProps) {
  const { locations, getProductByLocation } = useInventory();

  // 🧠 Nuevo estado local para lo que llegue del ESP32
  const [estadoMQTT, setEstadoMQTT] = useState<any>({});

  // 🛰️ Escucha mensajes del broker (ESP32 → Frontend)
  useEffect(() => {
    onMQTTMessage((topic, data) => {
      if (topic.includes("rack/") && topic.includes("buttons/states")) {
        console.log("📡 Estado MQTT recibido:", data);
        setEstadoMQTT(data); // Guarda el JSON con p14, p35, etc.
      }
    });
  }, []);

  const rackLocations = locations
    .filter((loc) => loc.rack === rack && loc.nivel === nivel)
    .sort((a, b) => a.slot - b.slot);

  return (
    <TooltipProvider>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3 p-6 bg-card rounded-lg">
        {rackLocations.map((location) => {
          const product = getProductByLocation(location.id);
          const hasProduct = !!product;

          // 🔍 Buscamos si este slot tiene estado MQTT
          const slotKey = `p${location.slot}`; // Ej: p14, p27...
          const mqttInfo = estadoMQTT[slotKey];
          const mqttEstado = mqttInfo?.estado?.toLowerCase();

          // 🧩 Prioriza el estado MQTT sobre el local si existe
          const status = mqttEstado || location.status;

          // 🎨 Mantiene tu mismo esquema de colores pero dinámico
          const getSlotStyles = () => {
            switch (status) {
              case "libre":
                return "bg-gradient-to-br from-green-100 to-green-200 text-green-800 border-green-300 hover:from-green-200 hover:to-green-300";
              case "en_proceso":
              case "colocando": // por si el ESP32 manda "COLOCANDO"
                return "bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-300 hover:from-yellow-200 hover:to-yellow-300 animate-pulse";
              case "ocupado":
                return "bg-gradient-to-br from-red-100 to-red-200 text-red-800 border-red-300 hover:from-red-200 hover:to-red-300";
              default:
                return "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-800 border-gray-300";
            }
          };

          return (
            <Tooltip key={location.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSlotClick(location, hasProduct)}
                  className={`
                    h-12 w-full flex flex-col items-center justify-center text-xs font-medium
                    transition-all duration-300 hover:scale-105 hover:shadow-md
                    ${getSlotStyles()}
                  `}
                >
                  <span className="text-[10px] font-bold">{location.slot}</span>
                  {hasProduct && (
                    <span className="text-[8px] truncate w-full text-center">
                      {product.sku}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  <p className="font-medium">
                    Slot {rack}-{nivel}-{location.slot}
                  </p>
                  <p className="text-sm">
                    <strong>Estado:</strong>{" "}
                    {status === "libre"
                      ? "Libre"
                      : status === "en_proceso" || status === "colocando"
                      ? "En proceso de colocación"
                      : "Ocupado"}
                  </p>
                  {product ? (
                    <div className="mt-1">
                      <p>
                        <strong>SKU:</strong> {product.sku}
                      </p>
                      <p>
                        <strong>Producto:</strong> {product.nombre}
                      </p>
                      <p>
                        <strong>Cantidad:</strong> {product.cantidad}
                      </p>
                    </div>
                  ) : status === "en_proceso" || status === "colocando" ? (
                    <p className="text-muted-foreground mt-1">
                      Esperando confirmación del hardware...
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-1">
                      Slot disponible
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
