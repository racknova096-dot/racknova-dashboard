import React, { useState } from "react";
import { Shield, UserPlus, Users } from "lucide-react";

import { API_URL } from "@/config";
import { PageHero } from "@/components/layout/PageHero";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Usuarios() {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [rol, setRol] = useState("operator");
  const [loading, setLoading] = useState(false);

  const crearUsuario = async () => {
    if (!usuario || !contrasena) {
      alert("Faltan datos");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/auth/create_user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usuario,
          contrasena,
          rol,
        }),
      });

      const data = await response.json();
      console.log("Respuesta create_user:", data);

      if (response.ok) {
        alert(`Usuario ${usuario} creado correctamente`);
        setUsuario("");
        setContrasena("");
        setRol("operator");
      } else {
        alert("Error al crear el usuario");
      }
    } catch (error) {
      console.error("Error creando usuario:", error);
      alert("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHero
        badge="Administración de acceso"
        title="Gestión de Usuarios"
        description="Crea usuarios internos para operar el sistema RackNova con roles básicos de administrador u operador."
        icon={Users}
        stats={[
          {
            label: "Módulo",
            value: "Usuarios",
            tone: "blue",
          },
          {
            label: "Rol admin",
            value: "Control total",
            tone: "purple",
          },
          {
            label: "Rol operador",
            value: "Operación",
            tone: "green",
          },
          {
            label: "Estado",
            value: "Activo",
            tone: "cyan",
          },
        ]}
      >
        Esta sección queda preparada para crecer después con permisos, usuarios
        activos/inactivos y administración avanzada.
      </PageHero>

      <Card className="racknova-card max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Crear nuevo usuario
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Usuario</Label>
            <Input
              value={usuario}
              onChange={(event) => setUsuario(event.target.value)}
              placeholder="Ej: admin@racknova.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Contraseña</Label>
            <Input
              type="password"
              value={contrasena}
              onChange={(event) => setContrasena(event.target.value)}
              placeholder="Contraseña temporal"
            />
          </div>

          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={rol} onValueChange={setRol}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="operator">Operador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground flex gap-3">
            <Shield className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              El usuario creado podrá iniciar sesión según el rol asignado. Más
              adelante este módulo puede ampliarse con permisos por pantalla.
            </p>
          </div>

          <Button onClick={crearUsuario} disabled={loading} className="w-full">
            {loading ? "Creando..." : "Crear Usuario"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
