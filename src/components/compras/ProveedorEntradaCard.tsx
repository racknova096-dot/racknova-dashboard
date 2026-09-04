import { useEffect, useState } from "react";
import { Building2, Plus, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  asignarProveedorPrincipal,
  crearProveedor,
  listarProveedores,
  type Proveedor,
} from "@/lib/compras";

export const ENTRY_PROVIDER_STORAGE_KEY = "racknova:entry-provider-id";

export function ProveedorEntradaCard() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [selected, setSelected] = useState(
    () => sessionStorage.getItem(ENTRY_PROVIDER_STORAGE_KEY) || ""
  );
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [diasEntrega, setDiasEntrega] = useState("0");
  const [notas, setNotas] = useState("");
  const { toast } = useToast();

  const load = async () => {
    try {
      setLoading(true);
      setProveedores(await listarProveedores());
    } catch (error) {
      toast({
        title: "No se cargaron los proveedores",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selected) sessionStorage.setItem(ENTRY_PROVIDER_STORAGE_KEY, selected);
    else sessionStorage.removeItem(ENTRY_PROVIDER_STORAGE_KEY);
  }, [selected]);

  useEffect(() => {
    const onProductSaved = (event: Event) => {
      const detail = (event as CustomEvent<{
        sku?: string;
        costo_proveedor?: number;
      }>).detail;
      const providerId = sessionStorage.getItem(ENTRY_PROVIDER_STORAGE_KEY);
      if (!providerId || !detail?.sku) {
        toast({
          title: "Producto guardado sin proveedor",
          description:
            "Puedes asignarlo después desde Compras → Proveedores. Para las próximas entradas selecciona el proveedor antes de guardar.",
        });
        return;
      }

      void asignarProveedorPrincipal(
        detail.sku,
        providerId,
        Number(detail.costo_proveedor || 0)
      )
        .then(() => {
          const provider = proveedores.find(
            (item) => item.id_proveedor === providerId
          );
          toast({
            title: "Proveedor registrado",
            description: `${detail.sku} quedó asociado a ${provider?.nombre || "su proveedor"}.`,
          });
          setSelected("");
        })
        .catch((error) => {
          toast({
            title: "Producto guardado, proveedor pendiente",
            description:
              error instanceof Error
                ? error.message
                : "No se pudo guardar la asociación con el proveedor.",
            variant: "destructive",
          });
        });
    };

    window.addEventListener("racknova:product-saved", onProductSaved);
    return () =>
      window.removeEventListener("racknova:product-saved", onProductSaved);
  }, [proveedores, toast]);

  const create = async () => {
    if (!nombre.trim()) return;
    try {
      setSaving(true);
      const proveedor = await crearProveedor({
        nombre: nombre.trim(),
        contacto: contacto.trim() || undefined,
        telefono: telefono.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        notas: notas.trim() || undefined,
        tiempo_entrega_dias: Math.max(Number(diasEntrega || 0), 0),
      });
      setProveedores((current) =>
        [...current.filter((item) => item.id_proveedor !== proveedor.id_proveedor), proveedor].sort(
          (a, b) => a.nombre.localeCompare(b.nombre)
        )
      );
      setSelected(proveedor.id_proveedor);
      setDialogOpen(false);
      setNombre("");
      setContacto("");
      setTelefono("");
      setWhatsapp("");
      setEmail("");
      setDiasEntrega("0");
      setNotas("");
      toast({
        title: "Proveedor creado",
        description: `${proveedor.nombre} quedó seleccionado para esta entrada.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo crear el proveedor",
        description: error instanceof Error ? error.message : "Revisa los datos.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="racknova-card border-blue-200/70 dark:border-blue-900/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="h-5 w-5 text-blue-600" />
            Proveedor de esta entrada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={selected}
              onValueChange={setSelected}
              disabled={loading}
            >
              <SelectTrigger className="h-11 flex-1">
                <SelectValue
                  placeholder={
                    loading ? "Cargando proveedores..." : "Selecciona quién surtió este producto"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {proveedores.map((proveedor) => (
                  <SelectItem
                    key={proveedor.id_proveedor}
                    value={proveedor.id_proveedor}
                  >
                    {proveedor.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo proveedor
            </Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            RackNova usará esta relación para agrupar productos críticos y preparar
            la lista de compra correcta para cada proveedor.
          </p>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Nuevo proveedor
            </DialogTitle>
            <DialogDescription>
              Guarda los datos que te sirven para hacer pedidos y seguimiento.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Coca-Cola FEMSA" />
            </div>
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Nombre del vendedor" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="444..." />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="444..." />
            </div>
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ventas@proveedor.com" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Tiempo de entrega aproximado (días)</Label>
              <Input type="number" min="0" value={diasEntrega} onChange={(e) => setDiasEntrega(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notas</Label>
              <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Días de visita, condiciones de compra, pedido mínimo..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void create()} disabled={saving || !nombre.trim()}>
              {saving ? "Guardando..." : "Crear y seleccionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
