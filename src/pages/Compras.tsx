import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Download,
  FileSpreadsheet,
  Mail,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ShoppingBasket,
  Trash2,
  Truck,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import { PageHero } from "@/components/layout/PageHero";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  actualizarProveedor,
  asignarProveedorPrincipal,
  crearProveedor,
  desactivarProveedor,
  listarProveedores,
  obtenerReabastecimiento,
  type Proveedor,
  type ProveedorInput,
  type ReabastecimientoGrupo,
  type ReabastecimientoResumen,
} from "@/lib/compras";

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const emptyForm: ProveedorInput = {
  nombre: "",
  contacto: "",
  telefono: "",
  whatsapp: "",
  email: "",
  notas: "",
  tiempo_entrega_dias: 0,
};

export default function Compras() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [reabastecimiento, setReabastecimiento] =
    useState<ReabastecimientoResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerDialog, setProviderDialog] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [form, setForm] = useState<ProveedorInput>(emptyForm);
  const [savingProvider, setSavingProvider] = useState(false);
  const [assigningSku, setAssigningSku] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      setLoading(true);
      const [providerData, restockData] = await Promise.all([
        listarProveedores(),
        obtenerReabastecimiento(),
      ]);
      setProveedores(providerData);
      setReabastecimiento(restockData);
    } catch (error) {
      toast({
        title: "No se pudo cargar Compras",
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

  const grupos = reabastecimiento?.grupos || [];
  const unassignedCount = useMemo(
    () =>
      grupos
        .filter((group) => !group.id_proveedor)
        .reduce((total, group) => total + group.total_productos, 0),
    [grupos]
  );

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setProviderDialog(true);
  };

  const openEdit = (provider: Proveedor) => {
    setEditing(provider);
    setForm({
      nombre: provider.nombre,
      contacto: provider.contacto || "",
      telefono: provider.telefono || "",
      whatsapp: provider.whatsapp || "",
      email: provider.email || "",
      notas: provider.notas || "",
      tiempo_entrega_dias: provider.tiempo_entrega_dias || 0,
    });
    setProviderDialog(true);
  };

  const saveProvider = async () => {
    if (!form.nombre.trim()) return;
    try {
      setSavingProvider(true);
      if (editing) {
        await actualizarProveedor(editing.id_proveedor, form);
        toast({ title: "Proveedor actualizado" });
      } else {
        await crearProveedor(form);
        toast({ title: "Proveedor creado" });
      }
      setProviderDialog(false);
      await load();
    } catch (error) {
      toast({
        title: "No se guardó el proveedor",
        description: error instanceof Error ? error.message : "Revisa los datos.",
        variant: "destructive",
      });
    } finally {
      setSavingProvider(false);
    }
  };

  const disableProvider = async (provider: Proveedor) => {
    if (!window.confirm(`¿Desactivar a ${provider.nombre}?`)) return;
    try {
      await desactivarProveedor(provider.id_proveedor);
      toast({ title: "Proveedor desactivado" });
      await load();
    } catch (error) {
      toast({
        title: "No se pudo desactivar",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const assignProvider = async (sku: string, idProveedor: string, costo: number) => {
    try {
      setAssigningSku(sku);
      await asignarProveedorPrincipal(sku, idProveedor, costo);
      toast({ title: "Proveedor asignado", description: `${sku} ya quedó agrupado para compras.` });
      await load();
    } catch (error) {
      toast({
        title: "No se pudo asignar",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setAssigningSku(null);
    }
  };

  const downloadPdf = (group: ReabastecimientoGrupo) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("RackNova · Lista de compra", 14, 18);
    doc.setFontSize(12);
    doc.text(`Proveedor: ${group.proveedor}`, 14, 28);
    doc.text(`Fecha: ${new Date().toLocaleDateString("es-MX")}`, 14, 35);
    if (group.contacto) doc.text(`Contacto: ${group.contacto}`, 14, 42);
    if (group.telefono || group.whatsapp) {
      doc.text(`Teléfono/WhatsApp: ${group.whatsapp || group.telefono}`, 14, 49);
    }

    autoTable(doc, {
      startY: group.contacto || group.telefono || group.whatsapp ? 56 : 43,
      head: [["SKU", "Producto", "Actual", "Mínimo", "Objetivo", "Pedir", "Costo", "Subtotal"]],
      body: group.productos.map((item) => [
        item.sku,
        item.nombre,
        item.stock_actual,
        item.stock_minimo,
        item.stock_objetivo,
        item.cantidad_sugerida,
        money(item.costo_unitario),
        money(item.subtotal_estimado),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fontStyle: "bold" },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 80;
    doc.setFontSize(11);
    doc.text(`Total estimado: ${money(group.total_estimado)}`, 14, finalY + 10);
    doc.save(`lista-compra-${slug(group.proveedor)}.pdf`);
  };

  const downloadExcel = async (group: ReabastecimientoGrupo) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Lista de compra");
    sheet.addRow(["RackNova · Lista de compra"]);
    sheet.addRow(["Proveedor", group.proveedor]);
    sheet.addRow(["Fecha", new Date().toLocaleDateString("es-MX")]);
    sheet.addRow([]);
    sheet.addRow([
      "SKU",
      "Producto",
      "Stock actual",
      "Stock mínimo",
      "Stock objetivo",
      "Cantidad sugerida",
      "Costo unitario",
      "Subtotal estimado",
    ]);
    group.productos.forEach((item) => {
      sheet.addRow([
        item.sku,
        item.nombre,
        item.stock_actual,
        item.stock_minimo,
        item.stock_objetivo,
        item.cantidad_sugerida,
        item.costo_unitario,
        item.subtotal_estimado,
      ]);
    });
    sheet.addRow([]);
    sheet.addRow(["Total estimado", group.total_estimado]);
    sheet.columns.forEach((column) => {
      column.width = 18;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `lista-compra-${slug(group.proveedor)}.xlsx`
    );
  };

  return (
    <main className="space-y-6">
      <PageHero
        badge="Abastecimiento y proveedores"
        title="Compras"
        description="Convierte el stock crítico en listas de compra ordenadas por proveedor."
        icon={ShoppingBasket}
        stats={[
          { label: "Por surtir", value: String(reabastecimiento?.total_productos || 0), tone: "amber" },
          { label: "Proveedores", value: String(reabastecimiento?.total_proveedores || 0), tone: "blue" },
          { label: "Sin proveedor", value: String(unassignedCount), tone: unassignedCount ? "amber" : "green" },
          { label: "Compra estimada", value: money(reabastecimiento?.total_estimado || 0), tone: "green" },
        ]}
        actions={
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        }
      >
        RackNova considera crítico un producto cuando su stock actual es menor o igual al mínimo y sugiere comprar hasta recuperar el stock objetivo.
      </PageHero>

      <Tabs defaultValue="reabastecimiento" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="reabastecimiento">Reabastecimiento</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
        </TabsList>

        <TabsContent value="reabastecimiento" className="space-y-4">
          {!loading && grupos.length === 0 && (
            <Card className="racknova-card">
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <PackageCheck className="h-10 w-10 text-emerald-600" />
                <p className="font-bold">No hay productos en stock crítico</p>
                <p className="text-sm text-muted-foreground">Las listas aparecerán automáticamente cuando algún producto llegue a su mínimo.</p>
              </CardContent>
            </Card>
          )}

          {grupos.map((group) => (
            <Card key={group.id_proveedor || "sin-proveedor"} className="racknova-card overflow-hidden">
              <CardHeader className="border-b border-border/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5 text-blue-600" />
                      {group.proveedor}
                    </CardTitle>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{group.total_productos} productos</Badge>
                      {group.tiempo_entrega_dias > 0 && (
                        <Badge variant="outline">Entrega aprox. {group.tiempo_entrega_dias} días</Badge>
                      )}
                      <Badge variant="outline">Estimado {money(group.total_estimado)}</Badge>
                    </div>
                  </div>
                  {group.id_proveedor && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => downloadPdf(group)}>
                        <Download className="mr-2 h-4 w-4" />PDF
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void downloadExcel(group)}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />Excel
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-secondary/40 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Producto</th>
                        <th className="px-4 py-3">Actual</th>
                        <th className="px-4 py-3">Mínimo</th>
                        <th className="px-4 py-3">Objetivo</th>
                        <th className="px-4 py-3">Pedir</th>
                        <th className="px-4 py-3">Estimado</th>
                        {!group.id_proveedor && <th className="px-4 py-3">Asignar proveedor</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {group.productos.map((item) => (
                        <tr key={item.sku} className="border-t border-border/60">
                          <td className="px-4 py-3">
                            <p className="font-semibold">{item.nombre}</p>
                            <p className="text-xs text-muted-foreground">{item.sku}</p>
                          </td>
                          <td className="px-4 py-3 font-semibold text-amber-700 dark:text-amber-300">{item.stock_actual}</td>
                          <td className="px-4 py-3">{item.stock_minimo}</td>
                          <td className="px-4 py-3">{item.stock_objetivo}</td>
                          <td className="px-4 py-3 font-black text-blue-700 dark:text-blue-300">{item.cantidad_sugerida}</td>
                          <td className="px-4 py-3">{money(item.subtotal_estimado)}</td>
                          {!group.id_proveedor && (
                            <td className="px-4 py-3">
                              <Select
                                disabled={assigningSku === item.sku}
                                onValueChange={(value) => void assignProvider(item.sku, value, item.costo_unitario)}
                              >
                                <SelectTrigger className="h-9 min-w-[180px]">
                                  <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                  {proveedores.map((provider) => (
                                    <SelectItem key={provider.id_proveedor} value={provider.id_proveedor}>
                                      {provider.nombre}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="proveedores" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />Nuevo proveedor
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {proveedores.map((provider) => (
              <Card key={provider.id_proveedor} className="racknova-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    {provider.nombre}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {provider.contacto && <p className="font-medium">{provider.contacto}</p>}
                  {provider.telefono && (
                    <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{provider.telefono}</p>
                  )}
                  {provider.email && (
                    <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />{provider.email}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Entrega aproximada: {provider.tiempo_entrega_dias || 0} días
                  </p>
                  {provider.notas && <p className="rounded-lg bg-secondary/40 p-2 text-xs text-muted-foreground">{provider.notas}</p>}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(provider)}>
                      <Pencil className="mr-2 h-4 w-4" />Editar
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => void disableProvider(provider)}>
                      <Trash2 className="mr-2 h-4 w-4" />Desactivar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={providerDialog} onOpenChange={setProviderDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
            <DialogDescription>Datos para pedidos y reabastecimiento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm((v) => ({ ...v, nombre: e.target.value }))} />
            </div>
            <div className="space-y-2"><Label>Contacto</Label><Input value={form.contacto || ""} onChange={(e) => setForm((v) => ({ ...v, contacto: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Teléfono</Label><Input value={form.telefono || ""} onChange={(e) => setForm((v) => ({ ...v, telefono: e.target.value }))} /></div>
            <div className="space-y-2"><Label>WhatsApp</Label><Input value={form.whatsapp || ""} onChange={(e) => setForm((v) => ({ ...v, whatsapp: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Correo</Label><Input value={form.email || ""} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Tiempo de entrega aproximado (días)</Label>
              <Input type="number" min="0" value={form.tiempo_entrega_dias || 0} onChange={(e) => setForm((v) => ({ ...v, tiempo_entrega_dias: Number(e.target.value || 0) }))} />
            </div>
            <div className="space-y-2 sm:col-span-2"><Label>Notas</Label><Textarea value={form.notas || ""} onChange={(e) => setForm((v) => ({ ...v, notas: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProviderDialog(false)}>Cancelar</Button>
            <Button onClick={() => void saveProvider()} disabled={savingProvider || !form.nombre.trim()}>
              {savingProvider ? "Guardando..." : "Guardar proveedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
