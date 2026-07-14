import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock, User } from "lucide-react";

import { API_URL } from "../config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BlockingLoader } from "@/components/ui/blocking-loader";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async () => {
    if (loading) return;

    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Captura usuario y contraseña.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();
      console.log("Respuesta del servidor:", data);

      if (!response.ok) {
        setError(data.detail || "Usuario o contraseña incorrectos");
        return;
      }

      const user = data.user;
      const role = user?.role;

      if (!role) {
        setError("El servidor no regresó el rol del usuario.");
        return;
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("usuario", user?.email || username);
      localStorage.setItem("nombre", user?.name || username);
      localStorage.setItem("rol", role);

      navigate("/");
    } catch (error) {
      console.error("Error en login:", error);
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <BlockingLoader
        show={loading}
        title="Iniciando sesión"
        description="Estamos validando tus credenciales. No cierres la página."
      />

      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md racknova-card">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              RackNova - Acceso Seguro
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Usuario o correo"
                className="pl-9"
                disabled={loading}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Contraseña"
                className="pl-9"
                disabled={loading}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleLogin();
                  }
                }}
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-200">
                {error}
              </div>
            )}

            <Button onClick={handleLogin} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
