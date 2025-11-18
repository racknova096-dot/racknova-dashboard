import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, User } from "lucide-react";
import { API_URL } from "../config";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      console.log("📦 Respuesta del servidor:", data);

      // ✅ Verificamos la respuesta HTTP
      if (!response.ok) {
        setError(data.detail || "Usuario o contraseña incorrectos");
        return;
      }

      // ✅ Login exitoso
      console.log("✅ Login exitoso:", data);

      // (Opcional) Guarda el usuario en localStorage
      localStorage.setItem("usuario", username);
      localStorage.setItem("rol", data.rol);

      // 🚀 Redirige al dashboard principal
      navigate("/");
    } catch (error) {
      console.error("⚠️ Error en login:", error);
      setError("No se pudo conectar al servidor");
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <Card className="w-full max-w-md shadow-lg border border-blue-200">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold text-blue-800">
            RackNova - Acceso Seguro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <User className="text-blue-600" />
            <Input
              placeholder="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Lock className="text-blue-600" />
            <Input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button className="w-full mt-4" onClick={handleLogin}>
            Iniciar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
