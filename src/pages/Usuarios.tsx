import React, { useEffect, useMemo, useState } from "react";
import {
  Shield,
  UserPlus,
  Users,
  RefreshCcw,
  Pencil,
  UserX,
  UserCheck,
} from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type Usuario = {
  id_usuario: number;
  usuario: string;
  nombre?: string | null;
  rol: "admin" | "operator" | "viewer";
  activo: boolean;
  fecha_creacion?: string;
  ultima_actualizacion?: string;
  ultimo_acceso?: string | null;
};

type RolUsuario = "admin" | "operator" | "viewer";

const formatDate = (value?: string | null) => {
  if (!value) return "Sin registro";

  return new Date(value).toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [usuario, setUsuario] = useState("");
  const [nombre, setNombre] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [rol, setRol] = useState<RolUsuario>("operator");

  const { toast } = useToast();

  const usuariosActivos = useMemo(
    () => usuarios.filter((item) => item.activo).length,
    [usuarios]
  );

  const usuariosInactivos = useMemo(
    () => usuarios.filter((item) => !item.activo).length,
    [usuarios]
  );

  const admins = useMemo(
    () => usuarios.filter((item) => item.rol === "admin").length,
    [usuarios]
  );

  const limpiarFormulario = () => {
    setEditingId(null);
    setUsuario("");
    setNombre("");
    setContrasena("");
    setRol("operator");
  };

  const cargarUsuarios = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/auth/users`);

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setUsuarios(data);
    } catch (error) {
      console.error("Error cargando usuarios:", error);

      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const guardarUsuario = async () => {
    if (!usuario.trim()) {
      toast({
        title: "Faltan datos",
        description: "El usuario/correo es obligatorio.",
        variant: "destructive",
      });
      return;
    }

    if (!editingId && !contrasena.trim()) {
      toast({
        title: "Faltan datos",
        description: "La contraseña es obligatoria para usuarios nuevos.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const payload = {
        usuario: usuario.trim(),
        nombre: nombre.trim() || null,
        contrasena: contrasena.trim() || undefined,
        rol,
      };

      const url = editingId
        ? `${API_URL}/auth/users/${editingId}`
        : `${API_URL}/auth/create_user`;

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      toast({
        title: editingId ? "Usuario actualizado" : "Usuario creado",
        description: editingId
          ? "Los datos del usuario se actualizaron correctamente."
          : "El nuevo usuario ya puede iniciar sesión.",
      });

      limpiarFormulario();
      cargarUsuarios();
    } catch (error) {
      console.error("Error guardando usuario:", error);

      toast({
        title: "Error",
        description: "No se pudo guardar el usuario.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const editarUsuario = (item: Usuario) => {
    setEditingId(item.id_usuario);
    setUsuario(item.usuario);
    setNombre(item.nombre ?? "");
    setContrasena("");
    setRol(item.rol);
  };

  const cambiarEstadoUsuario = async (item: Usuario, activo: boolean) => {
    try {
      const response = await fetch(`${API_URL}/auth/users/${item.id_usuario}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activo,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: activo ? "Usuario activado" : "Usuario desactivado",
        description: `${item.usuario} fue actualizado correctamente.`,
      });

      cargarUsuarios();
    } catch (error) {
      console.error("Error cambiando estado:", error);

      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del usuario.",
        variant: "destructive",
      });
    }
  };

  const getRoleBadge = (userRole: RolUsuario) => {
    if (userRole === "admin") {
      return <Badge className="bg-purple-600 text-white">Administrador</Badge>;
    }

    if (userRole === "viewer") {
      return <Badge variant="outline">Visor</Badge>;
    }

    return <Badge className="bg-blue-600 text-white">Operador</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHero
        badge="Administración de acceso"
        title="Gestión de Usuarios"
        description="Crea, edita, activa y desactiva usuarios internos para operar RackNova."
        icon={Users}
        actions={
          <Button variant="secondary" onClick={cargarUsuarios} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        }
        stats={[
          {
            label: "Usuarios totales",
            value: usuarios.length,
            tone: "blue",
          },
          {
            label: "Activos",
            value: usuariosActivos,
            tone: "green",
          },
          {
            label: "Inactivos",
            value: usuariosInactivos,
            tone: "red",
          },
          {
            label: "Administradores",
            value: admins,
            tone: "purple",
          },
        ]}
      >
        Los usuarios se guardan en la base de datos con contraseña encriptada.
        Más adelante este módulo puede conectarse con permisos por pantalla.
      </PageHero>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="racknova-card xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {editingId ? "Editar usuario" : "Crear nuevo usuario"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Usuario / correo</Label>
              <Input
                value={usuario}
                onChange={(event) => setUsuario(event.target.value)}
                placeholder="Ej: operador@racknova.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Ej: Operador Turno 1"
              />
            </div>

            <div className="space-y-2">
              <Label>
                {editingId
                  ? "Nueva contraseña opcional"
                  : "Contraseña temporal"}
              </Label>
              <Input
                type="password"
                value={contrasena}
                onChange={(event) => setContrasena(event.target.value)}
                placeholder={
                  editingId
                    ? "Déjalo vacío para conservar la actual"
                    : "Contraseña temporal"
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={rol} onValueChange={(value) => setRol(value as RolUsuario)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="operator">Operador</SelectItem>
                  <SelectItem value="viewer">Visor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground flex gap-3">
              <Shield className="h-5 w-5 shrink-0 mt-0.5" />
              <p>
                El administrador tiene control completo. El operador se usa para
                operación diaria. El visor queda pensado para solo consulta.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={guardarUsuario} disabled={saving} className="flex-1">
                {saving
                  ? "Guardando..."
                  : editingId
                    ? "Guardar cambios"
                    : "Crear usuario"}
              </Button>

              {editingId && (
                <Button variant="outline" onClick={limpiarFormulario}>
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card xl:col-span-2">
          <CardHeader>
            <CardTitle>Usuarios registrados</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="rounded-xl border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último acceso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {usuarios.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        No hay usuarios registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    usuarios.map((item) => (
                      <TableRow key={item.id_usuario}>
                        <TableCell className="font-medium">
                          {item.usuario}
                        </TableCell>

                        <TableCell>
                          {item.nombre || (
                            <span className="text-muted-foreground">
                              Sin nombre
                            </span>
                          )}
                        </TableCell>

                        <TableCell>{getRoleBadge(item.rol)}</TableCell>

                        <TableCell>
                          {item.activo ? (
                            <Badge className="bg-green-600 text-white">
                              Activo
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Inactivo</Badge>
                          )}
                        </TableCell>

                        <TableCell>{formatDate(item.ultimo_acceso)}</TableCell>

                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => editarUsuario(item)}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Editar
                            </Button>

                            {item.activo ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => cambiarEstadoUsuario(item, false)}
                              >
                                <UserX className="h-4 w-4 mr-1" />
                                Desactivar
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => cambiarEstadoUsuario(item, true)}
                              >
                                <UserCheck className="h-4 w-4 mr-1" />
                                Activar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
