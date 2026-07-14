import React, { useEffect, useMemo, useState } from "react";
import {
  Shield,
  UserPlus,
  Users,
  RefreshCcw,
  Pencil,
  UserX,
  UserCheck,
  Search,
  X,
  Save,
  Filter,
  Clock,
  Mail,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import { PageHero } from "@/components/layout/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";

type RolUsuario = "admin" | "operator" | "viewer";
type StatusFilter = "all" | "active" | "inactive";

type Usuario = {
  id_usuario: number;
  usuario: string;
  nombre?: string | null;
  rol: RolUsuario;
  activo: boolean;
  fecha_creacion?: string | null;
  ultima_actualizacion?: string | null;
  ultimo_acceso?: string | null;
};

type UserForm = {
  usuario: string;
  nombre: string;
  contrasena: string;
  rol: RolUsuario;
  activo: boolean;
};

const emptyForm: UserForm = {
  usuario: "",
  nombre: "",
  contrasena: "",
  rol: "operator",
  activo: true,
};

const getRoleLabel = (rol: RolUsuario) => {
  if (rol === "admin") return "Administrador";
  if (rol === "operator") return "Operador";
  return "Visor";
};

const getRoleDescription = (rol: RolUsuario) => {
  if (rol === "admin") return "Acceso completo al sistema.";
  if (rol === "operator")
    return "Puede operar inventario, catálogo, reportes operativos e IA.";
  return "Solo lectura. No puede modificar ni usar IA.";
};

const getRoleBadgeClass = (rol: RolUsuario) => {
  if (rol === "admin") {
    return "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-900";
  }

  if (rol === "operator") {
    return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900";
  }

  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700";
};

const getStatusBadgeClass = (activo: boolean) => {
  if (activo) {
    return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-900";
  }

  return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Sin registro";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin registro";
  }

  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | RolUsuario>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  const editingUser = useMemo(
    () => usuarios.find((item) => item.id_usuario === editingId) ?? null,
    [usuarios, editingId]
  );

  const activeAdmins = useMemo(
    () =>
      usuarios.filter((item) => item.rol === "admin" && item.activo).length,
    [usuarios]
  );

  const filteredUsuarios = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return usuarios.filter((item) => {
      const matchesSearch =
        !term ||
        item.usuario.toLowerCase().includes(term) ||
        String(item.nombre ?? "").toLowerCase().includes(term) ||
        getRoleLabel(item.rol).toLowerCase().includes(term);

      const matchesRole = roleFilter === "all" || item.rol === roleFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.activo) ||
        (statusFilter === "inactive" && !item.activo);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [usuarios, searchTerm, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = usuarios.length;
    const activos = usuarios.filter((item) => item.activo).length;
    const inactivos = total - activos;
    const admins = usuarios.filter((item) => item.rol === "admin").length;
    const operadores = usuarios.filter((item) => item.rol === "operator")
      .length;
    const visores = usuarios.filter((item) => item.rol === "viewer").length;

    return {
      total,
      activos,
      inactivos,
      admins,
      operadores,
      visores,
    };
  }, [usuarios]);

  const updateForm = <K extends keyof UserForm>(key: K, value: UserForm[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const cargarUsuarios = async () => {
    try {
      setLoading(true);

      const response = await apiFetch("/auth/users");

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
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

  const validarFormulario = () => {
    const usuarioLimpio = form.usuario.trim();
    const nombreLimpio = form.nombre.trim();
    const contrasenaLimpia = form.contrasena.trim();

    if (!usuarioLimpio) {
      toast({
        title: "Falta usuario",
        description: "Captura el correo o usuario de acceso.",
        variant: "destructive",
      });

      return false;
    }

    if (!nombreLimpio) {
      toast({
        title: "Falta nombre",
        description: "Captura el nombre del usuario.",
        variant: "destructive",
      });

      return false;
    }

    if (!editingId && !contrasenaLimpia) {
      toast({
        title: "Falta contraseña",
        description: "Para crear un usuario nuevo debes capturar contraseña.",
        variant: "destructive",
      });

      return false;
    }

    if (contrasenaLimpia && contrasenaLimpia.length < 6) {
      toast({
        title: "Contraseña corta",
        description: "Usa una contraseña de mínimo 6 caracteres.",
        variant: "destructive",
      });

      return false;
    }

    if (
      editingUser &&
      editingUser.rol === "admin" &&
      editingUser.activo &&
      activeAdmins <= 1 &&
      form.rol !== "admin"
    ) {
      toast({
        title: "Acción bloqueada",
        description: "No puedes quitar el rol del último administrador activo.",
        variant: "destructive",
      });

      return false;
    }

    if (
      editingUser &&
      editingUser.rol === "admin" &&
      editingUser.activo &&
      activeAdmins <= 1 &&
      !form.activo
    ) {
      toast({
        title: "Acción bloqueada",
        description: "No puedes desactivar el último administrador activo.",
        variant: "destructive",
      });

      return false;
    }

    return true;
  };

  const guardarUsuario = async () => {
    if (!validarFormulario()) return;

    try {
      setSaving(true);

      const payload: Record<string, unknown> = {
        usuario: form.usuario.trim(),
        nombre: form.nombre.trim(),
        rol: form.rol,
      };

      if (editingId) {
        payload.activo = form.activo;

        if (form.contrasena.trim()) {
          payload.contrasena = form.contrasena.trim();
        }
      } else {
        payload.contrasena = form.contrasena.trim();
      }

      const response = await apiFetch(
  editingId ? `/auth/users/${editingId}` : "/auth/create_user",
  {
    method: editingId ? "PUT" : "POST",
    body: JSON.stringify(payload),
  }
);

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "No se pudo guardar el usuario.");
      }

      toast({
        title: editingId ? "Usuario actualizado" : "Usuario creado",
        description: editingId
          ? "Los cambios del usuario se guardaron correctamente."
          : "El usuario ya puede iniciar sesión con su rol asignado.",
      });

      resetForm();
      await cargarUsuarios();
    } catch (error) {
      console.error("Error guardando usuario:", error);

      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el usuario.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const editarUsuario = (item: Usuario) => {
    setEditingId(item.id_usuario);
    setForm({
      usuario: item.usuario,
      nombre: item.nombre ?? "",
      contrasena: "",
      rol: item.rol,
      activo: item.activo,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const desactivarUsuario = async (item: Usuario) => {
    if (item.rol === "admin" && item.activo && activeAdmins <= 1) {
      toast({
        title: "Acción bloqueada",
        description: "No puedes desactivar el último administrador activo.",
        variant: "destructive",
      });

      return;
    }

    const confirmar = window.confirm(
      `¿Seguro que quieres desactivar a ${item.nombre || item.usuario}?`
    );

    if (!confirmar) return;

    try {
     const response = await apiFetch(`/auth/users/${item.id_usuario}`, {
  method: "DELETE",
});

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      toast({
        title: "Usuario desactivado",
        description: "El usuario ya no podrá iniciar sesión.",
      });

      if (editingId === item.id_usuario) {
        resetForm();
      }

      await cargarUsuarios();
    } catch (error) {
      console.error("Error desactivando usuario:", error);

      toast({
        title: "Error",
        description: "No se pudo desactivar el usuario.",
        variant: "destructive",
      });
    }
  };

  const activarUsuario = async (item: Usuario) => {
    const confirmar = window.confirm(
      `¿Seguro que quieres activar a ${item.nombre || item.usuario}?`
    );

    if (!confirmar) return;

    try {
      const response = await apiFetch(`/auth/users/${item.id_usuario}`, {
  method: "PUT",
  body: JSON.stringify({
    activo: true,
  }),
});

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      toast({
        title: "Usuario activado",
        description: "El usuario ya puede iniciar sesión nuevamente.",
      });

      await cargarUsuarios();
    } catch (error) {
      console.error("Error activando usuario:", error);

      toast({
        title: "Error",
        description: "No se pudo activar el usuario.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <PageHero
        badge="Administración de acceso"
        title="Usuarios"
        description="Administra cuentas reales, roles, accesos activos e historial de último ingreso."
        icon={Users}
        stats={[
          {
            label: "Usuarios",
            value: stats.total,
            tone: "blue",
          },
          {
            label: "Activos",
            value: stats.activos,
            tone: "green",
          },
          {
            label: "Inactivos",
            value: stats.inactivos,
            tone: "red",
          },
          {
            label: "Admins",
            value: stats.admins,
            tone: "purple",
          },
        ]}
      >
        Define quién puede operar el sistema. El administrador tiene acceso
        completo, el operador trabaja con inventario y el visor solo consulta
        información.
      </PageHero>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="racknova-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
                <Shield className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Administradores</p>
                <p className="text-2xl font-bold">{stats.admins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-3 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                <UserCheck className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Operadores</p>
                <p className="text-2xl font-bold">{stats.operadores}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="racknova-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <Users className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Visores</p>
                <p className="text-2xl font-bold">{stats.visores}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="racknova-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {editingId ? (
              <Pencil className="h-5 w-5" />
            ) : (
              <UserPlus className="h-5 w-5" />
            )}
            {editingId ? "Editar usuario" : "Crear nuevo usuario"}
          </CardTitle>

          <p className="text-sm text-muted-foreground">
            {editingId
              ? "Modifica datos, rol, estado o contraseña del usuario seleccionado."
              : "Crea cuentas para administradores, operadores o visores."}
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Usuario / correo</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={form.usuario}
                  onChange={(event) =>
                    updateForm("usuario", event.target.value)
                  }
                  placeholder="Ej: operador1@racknova.com"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input
                value={form.nombre}
                onChange={(event) => updateForm("nombre", event.target.value)}
                placeholder="Ej: Operador Turno 1"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Contraseña{" "}
                {editingId && (
                  <span className="text-xs text-muted-foreground">
                    opcional
                  </span>
                )}
              </Label>
              <Input
                type="password"
                value={form.contrasena}
                onChange={(event) =>
                  updateForm("contrasena", event.target.value)
                }
                placeholder={
                  editingId
                    ? "Dejar vacío para conservar la contraseña actual"
                    : "Contraseña temporal"
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={form.rol}
                onValueChange={(value) =>
                  updateForm("rol", value as RolUsuario)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona rol" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="operator">Operador</SelectItem>
                  <SelectItem value="viewer">Visor</SelectItem>
                </SelectContent>
              </Select>

              <p className="text-xs text-muted-foreground">
                {getRoleDescription(form.rol)}
              </p>
            </div>

            {editingId && (
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={form.activo ? "active" : "inactive"}
                  onValueChange={(value) =>
                    updateForm("activo", value === "active")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona estado" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {editingId
                ? `Editando: ${editingUser?.nombre || editingUser?.usuario}`
                : "El usuario creado podrá iniciar sesión con el rol asignado."}
            </div>

            <div className="flex gap-2">
              {editingId && (
                <Button variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}

              <Button onClick={guardarUsuario} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving
                  ? "Guardando..."
                  : editingId
                    ? "Guardar cambios"
                    : "Crear usuario"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="racknova-card">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuarios registrados
              </CardTitle>

              <p className="text-sm text-muted-foreground mt-1">
                Consulta, filtra, edita, activa o desactiva usuarios del
                sistema.
              </p>
            </div>

            <Button variant="outline" onClick={cargarUsuarios} disabled={loading}>
              <RefreshCcw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nombre, usuario o rol..."
                className="pl-9"
              />
            </div>

            <Select
              value={roleFilter}
              onValueChange={(value) =>
                setRoleFilter(value as "all" | RolUsuario)
              }
            >
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Rol" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="admin">Administradores</SelectItem>
                <SelectItem value="operator">Operadores</SelectItem>
                <SelectItem value="viewer">Visores</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="rounded-xl border bg-muted/30 p-8 text-center text-muted-foreground">
              Cargando usuarios...
            </div>
          ) : filteredUsuarios.length === 0 ? (
            <div className="rounded-xl border bg-muted/30 p-8 text-center text-muted-foreground">
              No hay usuarios que coincidan con los filtros.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="racknova-table-header">
                  <tr>
                    <th className="px-4 py-3 text-left">Usuario</th>
                    <th className="px-4 py-3 text-left">Rol</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-left">Último acceso</th>
                    <th className="px-4 py-3 text-left">Creado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsuarios.map((item) => (
                    <tr
                      key={item.id_usuario}
                      className="border-t hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="font-medium">
                            {item.nombre || "Sin nombre"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.usuario}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getRoleBadgeClass(
                            item.rol
                          )}`}
                        >
                          {getRoleLabel(item.rol)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                            item.activo
                          )}`}
                        >
                          {item.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {formatDateTime(item.ultimo_acceso)}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(item.fecha_creacion)}
                      </td>

                      <td className="px-4 py-3">
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
                              onClick={() => desactivarUsuario(item)}
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Desactivar
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => activarUsuario(item)}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Activar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
            Protección incluida: no permite desactivar ni quitar el rol del
            último administrador activo desde esta pantalla.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
