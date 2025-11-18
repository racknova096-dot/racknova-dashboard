import mqtt from "mqtt";

// ✅ Configuración del broker (usa WSS para navegador seguro)
const MQTT_URL = "wss://ib197277.ala.dedicated.aws.emqxcloud.com:8084/mqtt";

const options = {
  username: "rack-esp32",
  password: "clave-esp32",
  reconnectPeriod: 2000,
};

// 🔹 Crear cliente MQTT
const client = mqtt.connect(MQTT_URL, options);

// 🔹 Tópicos relevantes del ESP32
const TOPICS = [
  // L3 → Dashboard nivel 1
  "rack/L3/buttons/states",
  "rack/L3/system/state",
  "Salida/L3",
  "Entrada/L3",

  // L2 → Dashboard nivel 2
  "rack/L2/buttons/states",
  "rack/L2/system/state",
  "Salida/L2",
  "Entrada/L2",

  // L1 → Dashboard nivel 3
  "rack/L1/buttons/states",
  "rack/L1/system/state",
  "Salida/L1",
  "Entrada/L1",
];


// 🔹 Cuando se conecte correctamente
client.on("connect", () => {
  console.log("✅ Conectado al broker EMQX (L1, L2, L3)");
  TOPICS.forEach((t) => client.subscribe(t));
});

// 🔹 Escucha mensajes del broker → React
export function onMQTTMessage(callback: (topic: string, data: any) => void) {
  client.on("message", (topic, message) => {
    try {
      const text = message.toString();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
      console.log(`📩 [${topic}]`, parsed);
      callback(topic, parsed);
    } catch (error) {
      console.error("❌ Error parseando MQTT:", error);
    }
  });
}

// 🔹 Publicar mensajes desde React → Broker → ESP32
export function publishMQTT(topic: string, message: string) {
  if (client.connected) {
    client.publish(topic, message);
    console.log(`📤 Publicado → ${topic}: ${message}`);
  } else {
    console.warn("⚠️ Cliente MQTT no conectado");
  }
}

export { client };
