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
      return [
        "bg-gradient-slot-free text-slot-free-foreground border-transparent",
        "shadow-sm shadow-green-500/20",
        "hover:shadow-lg hover:shadow-green-500/30",
      ].join(" ");

    case "en_proceso":
    case "colocando":
      return [
        "bg-gradient-slot-placing text-slot-placing-foreground border-transparent",
        "shadow-sm shadow-yellow-500/25 animate-pulse",
        "hover:shadow-lg hover:shadow-yellow-500/35",
      ].join(" ");

    case "quitando":
    case "retiro":
      return [
        "bg-gradient-slot-removing text-slot-removing-foreground border-transparent",
        "shadow-sm shadow-purple-500/25 animate-pulse",
        "hover:shadow-lg hover:shadow-purple-500/35",
      ].join(" ");

    case "ocupado":
      return [
        "bg-gradient-slot-occupied text-slot-occupied-foreground border-transparent",
        "shadow-sm shadow-red-500/25",
        "hover:shadow-lg hover:shadow-red-500/35",
      ].join(" ");

    default:
      return [
        "bg-secondary text-secondary-foreground border-border",
        "hover:bg-muted",
      ].join(" ");
  }
};

          return (
            <Tooltip key={location.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSlotClick(location, hasProduct)}
                  className={`h-14 w-full flex flex-col items-center justify-center rounded-xl text-xs font-bold tracking-wide transition-all duration-300 hover:scale-[1.03] border ${getSlotStyles()}`}
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
