import mqtt from "mqtt";

/**
 * MODO PRUEBA GLOBAL MQTT
 *
 * false = bloquea por completo la conexión MQTT.
 * true  = activa conexión MQTT real con EMQX.
 */
const MQTT_ENABLED = true;

const MQTT_URL = "wss://l006040f.ala.dedicated.aws.emqxcloud.com:8084/mqtt";

const options = {
  username: "rack-esp32",
  password: "clave-esp32",
  reconnectPeriod: 2000,
};

const TOPICS = [
  "rack/L3/buttons/states",
  "rack/L3/system/state",
  "Salida/L3",
  "Entrada/L3",

  "rack/L2/buttons/states",
  "rack/L2/system/state",
  "Salida/L2",
  "Entrada/L2",

  "rack/L1/buttons/states",
  "rack/L1/system/state",
  "Salida/L1",
  "Entrada/L1",
];

let client: mqtt.MqttClient | null = null;

if (MQTT_ENABLED) {
  client = mqtt.connect(MQTT_URL, options);

  client.on("connect", () => {
    console.log("✅ Conectado al broker EMQX (L1, L2, L3)");
    TOPICS.forEach((t) => client?.subscribe(t));
  });

  client.on("error", (error) => {
    console.error("❌ Error MQTT:", error);
  });
} else {
  console.warn("🟡 MODO PRUEBA GLOBAL: MQTT completamente bloqueado.");
}

export function onMQTTMessage(callback: (topic: string, data: any) => void) {
  if (!MQTT_ENABLED || !client) {
    console.warn("🟡 MQTT desactivado: listener ignorado.");
    return () => {};
  }

  const handler = (topic: string, message: Buffer) => {
    try {
      const text = message.toString();
      let parsed: any;

      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      console.log(` [${topic}]`, parsed);
      callback(topic, parsed);
    } catch (error) {
      console.error("❌ Error parseando MQTT:", error);
    }
  };

  client.on("message", handler);

  return () => {
    client?.off("message", handler);
  };
}

export function publishMQTT(topic: string, message: string) {
  if (!MQTT_ENABLED || !client) {
    console.warn("[MODO PRUEBA GLOBAL] Publicación MQTT bloqueada:", {
      topic,
      message,
    });
    return;
  }

  if (client.connected) {
    client.publish(topic, message);
    console.log(` Publicado → ${topic}: ${message}`);
  } else {
    console.warn("⚠️ Cliente MQTT no conectado");
  }
}

export { client };
