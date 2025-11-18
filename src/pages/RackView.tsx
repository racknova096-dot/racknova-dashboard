import { useEffect, useState } from "react";
import { onMQTTMessage, publishMQTT } from "../mqtt/mqttClient";

export default function RackView() {
  const [estado, setEstado] = useState<any>({});
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    onMQTTMessage((topic, data) => {
      if (topic.includes("buttons/states")) {
        setEstado(data);
      }
      if (topic.includes("system/state")) {
        console.log("🔐 Estado sistema:", data);
      }
      if (topic.includes("Salida")) {
        console.log("💬 Mensaje salida:", data);
      }
      setConectado(true);
    });
  }, []);

  const enviar = (pin: number) => {
    publishMQTT("Entrada/L3", `p${pin}c`);
  };

  return (
    <div className="p-6 text-center text-white">
      <h1 className="text-2xl font-bold mb-4">Rack L3 MQTT</h1>
      <p>Estado: {conectado ? "🟢 Conectado" : "🔴 Desconectado"}</p>

      <div className="grid grid-cols-3 gap-4 mt-6">
        {Object.entries(estado)
          .filter(([k]) => k.startsWith("p"))
          .map(([k, v]: any) => (
            <button
              key={k}
              onClick={() => enviar(Number(k.replace("p", "")))}
              className="rounded-lg p-4 shadow-lg font-semibold"
              style={{
                backgroundColor:
                  v.estado === "OCUPADO"
                    ? "#ef4444"
                    : v.estado === "COLOCANDO"
                    ? "#facc15"
                    : "#22c55e",
              }}
            >
              {k.toUpperCase()} <br /> {v.estado}
            </button>
          ))}
      </div>
    </div>
  );
}
