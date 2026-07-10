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
import { onMQTTMessage } from "@/mqtt/mqttClient";
import { LocateFixed } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SlotGridProps {
  rack: string;
  nivel: Nivel;
  onSlotClick: (location: Location, hasProduct: boolean) => void;
}

export function SlotGrid({ rack, nivel, onSlotClick }: SlotGridProps) {
  const { locations, getProductByLocation, buscarFisicamente } =
    useInventory();

  const { toast } = useToast();

  const [estadoMQTT, setEstadoMQTT] = useState<any>({});

  useEffect(() => {
    const cleanup = onMQTTMessage((topic, data) => {
      if (topic.includes("rack/") && topic.includes("buttons/states")) {
        console.log("Estado MQTT recibido:", data);
        setEstadoMQTT(data);
      }
    });

    return () => {
      if (typeof cleanup === "function") {
        cleanup();
      }
    };
  }, []);

  const rackLocations = locations
    .filter((loc) => loc.rack === rack && loc.nivel === nivel)
    .sort((a, b) => a.slot - b.slot);

  const handleBuscarFisicamente = async (
    event: React.MouseEvent,
    location: Location
  ) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      const result = await buscarFisicamente(location.id);

      toast({
        title: result.ok ? "Buscar físicamente" : "No se pudo buscar",
        description: result.mensaje,
        variant: result.ok ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Error buscando físicamente:", error);

      toast({
        title: "Error",
        description: "No se pudo enviar la búsqueda física.",
        variant: "destructive",
      });
    }
  };

  return (
    <TooltipProvider>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3 p-6 bg-card rounded-lg">
        {rackLocations.map((location) => {
          const product = getProductByLocation(location.id);
          const hasProduct = !!product;

          const slotKey = `p${location.slot}`;
          const mqttInfo = estadoMQTT[slotKey];
          const mqttEstado = mqttInfo?.estado?.toLowerCase();

          const status = mqttEstado || location.status;

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

          const estadoTexto =
            status === "libre"
              ? "Libre"
              : status === "en_proceso" || status === "colocando"
              ? "En proceso de colocación"
              : status === "quitando" || status === "retiro"
              ? "Quitando"
              : "Ocupado";

          return (
            <div key={location.id} className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSlotClick(location, hasProduct)}
                    className={`h-16 w-full flex flex-col items-center justify-center rounded-xl text-xs font-bold tracking-wide transition-all duration-300 hover:scale-[1.03] border ${getSlotStyles()}`}
                  >
                    <span className="text-[10px] font-bold">
                      {location.slot}
                    </span>

                    {hasProduct && product && (
                      <span className="text-[8px] truncate w-full text-center px-1">
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
                      <strong>Estado:</strong> {estadoTexto}
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

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(event) =>
                      handleBuscarFisicamente(event, location)
                    }
                    className="absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full bg-background border shadow-md flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-muted"
                    aria-label={`Buscar físicamente ${location.id}`}
                  >
                    <LocateFixed className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>

                <TooltipContent>
                  <p>Buscar físicamente {location.id}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
