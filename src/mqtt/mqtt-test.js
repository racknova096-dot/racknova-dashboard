import mqtt from "mqtt";

// 🔗 Dirección del broker (usa el puerto WebSocket 8083)
const client = mqtt.connect("wss://l006040f.ala.dedicated.aws.emqxcloud.com:8084/mqtt", {
  username: "rack-esp32",   // 👈 Reemplaza aquí
  password: "clave-esp32" // 👈 Reemplaza aquí
});

client.on("connect", () => {
  console.log("✅ Conectado a EMQX correctamente");

  // Suscribirse a un tópico (por ejemplo, el que usará tu ESP32)
  client.subscribe("racknova/slots/update", (err) => {
    if (!err) {
      console.log("📡 Suscrito al tópico: racknova/slots/update");

      // Enviamos un mensaje de prueba
      client.publish("racknova/slots/update", "🧠 Prueba desde Node.js");
    } else {
      console.error("❌ Error al suscribirse:", err.message);
    }
  });
});

client.on("message", (topic, message) => {
  console.log(`📨 Mensaje recibido [${topic}]:`, message.toString());
});

client.on("error", (err) => {
  console.error("❌ Error MQTT:", err.message);
});
