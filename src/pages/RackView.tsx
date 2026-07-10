import { useEffect, useState } from "react";
import { RadioTower, Wifi, WifiOff } from "lucide-react";

import { onMQTTMessage, publishMQTT } from "../mqtt/mqttClient";
import { PageHero } from "@/components/layout/PageHero";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RackButtonState = {
  pressed?: number;
  estado?: string;
  colocando?: number;
  quitando?: number;
  error?: number;
};

export default function RackView() {
  const [estado, setEstado] = useState<Record<string, RackButtonState>>({});
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    onMQTTMessage((topic, data) => {
      if (topic.includes("buttons/states")) {
        setEstado(data);
      }

      if (topic.includes("system/state")) {
        console.log("Estado sistema:", data);
      }

      if (topic.includes("Salida")) {
        console.log("Mensaje salida:", data);
      }

      setConectado(true);
    });
  }, []);

  const enviar = (pin: number) => {
    publishMQTT("Entrada/L3", `p${pin}c`);
  };

  const botones = Object.entries(estado).filter(([key]) =>
    key.startsWith("p")
  );

  const getSlotColorClass = (slotEstado?: string) => {
    if (slotEstado === "OCUPADO") {
      return "bg-red-500 text-white border-red-600";
    }

    if (slotEstado === "COLOCANDO") {
      return "bg-yellow-400 text-slate-950 border-yellow-500";
    }

    if (slotEstado === "QUITANDO") {
      return "bg-purple-500 text-white border-purple-600";
    }

    return "bg-emerald-500 text-white border-emerald-600";
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHero
        badge="Vista técnica MQTT"
        title="Rack MQTT"
        description="Monitoreo directo de estados recibidos por MQTT para pruebas del rack físico."
        icon={RadioTower}
        stats={[
          {
            label: "Conexión",
            value: conectado ? "Conectado" : "Desconectado",
            tone: conectado ? "green" : "red",
          },
          {
            label: "Protocolo",
            value: "MQTT",
            tone: "purple",
          },
          {
            label: "Nivel",
            value: "L3",
            tone: "blue",
          },
          {
            label: "Modo",
            value: "Prueba",
            tone: "amber",
          },
        ]}
      >
        Esta pantalla se conserva como vista técnica para probar mensajes,
        botones y estados directos del rack.
      </PageHero>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {conectado ? (
              <Wifi className="h-5 w-5 text-emerald-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            Estado de conexión
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Badge variant={conectado ? "default" : "destructive"}>
            {conectado ? "Conectado" : "Desconectado"}
          </Badge>
        </CardContent>
      </Card>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle>Botones recibidos por MQTT</CardTitle>
        </CardHeader>

        <CardContent>
          {botones.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              Todavía no se han recibido estados de botones.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {botones.map(([key, value]) => {
                const pin = Number(key.replace("p", ""));

                return (
                  <Button
                    key={key}
                    type="button"
                    onClick={() => enviar(pin)}
                    className={`h-28 rounded-xl border shadow-lg font-semibold flex flex-col gap-2 ${getSlotColorClass(
                      value.estado
                    )}`}
                  >
                    <span className="text-lg">{key.toUpperCase()}</span>
                    <span className="text-xs opacity-90">
                      {value.estado ?? "SIN ESTADO"}
                    </span>
                    <span className="text-xs opacity-80">Enviar p{pin}c</span>
                  </Button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
