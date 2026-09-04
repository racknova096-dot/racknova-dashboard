from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"Anchor not found: {label}")
    return text.replace(old, new, 1)


# Entrada owns physical-location verification controls.
path = Path("src/components/inventory/InventoryForm.tsx")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { Label } from "@/components/ui/label";\n',
    'import { Label } from "@/components/ui/label";\nimport { Switch } from "@/components/ui/switch";\n',
    "Switch import",
)
text = replace_once(
    text,
    '  desactivarUbicacionScan,\n  obtenerConfiguracionScan,\n',
    '  desactivarUbicacionScan,\n  obtenerConfiguracionScan,\n  guardarConfiguracionScan,\n',
    "guardarConfiguracionScan import",
)

anchor = '''  const handleSubmit = async (e: React.FormEvent) => {\n'''
handler = '''  const updateEntryScanPreference = async (\n    patch: Partial<RackNovaScanConfig>\n  ) => {\n    const previous = scanConfig;\n    const optimistic = { ...scanConfig, ...patch };\n    setScanConfig(optimistic);\n\n    try {\n      const saved = await guardarConfiguracionScan(patch);\n      setScanConfig(saved);\n    } catch (error) {\n      setScanConfig(previous);\n      toast({\n        title: "No se pudo guardar la preferencia",\n        description:\n          error instanceof Error\n            ? error.message\n            : "Intenta nuevamente.",\n        variant: "destructive",\n      });\n    }\n  };\n\n  const handleSubmit = async (e: React.FormEvent) => {\n'''
text = replace_once(text, anchor, handler, "entry scan preference handler")

card_anchor = '''                <CardContent className="space-y-4">\n                  {!isRestock && (\n'''
card_controls = '''                <CardContent className="space-y-4">\n                  <div className="rounded-2xl border border-border/70 bg-background p-4">\n                    <div className="mb-4">\n                      <p className="text-sm font-bold">Control de acomodo en este dispositivo</p>\n                      <p className="mt-1 text-xs leading-5 text-muted-foreground">\n                        Estas opciones son locales. Cambiarlas aquí no obliga a otras\n                        cajas, computadoras o celulares a trabajar igual.\n                      </p>\n                    </div>\n\n                    <div className="grid gap-3 md:grid-cols-3">\n                      <label className="flex items-center justify-between gap-3 rounded-xl border p-3">\n                        <div>\n                          <p className="text-sm font-semibold">Confirmar acomodo</p>\n                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">\n                            Exige escanear la ubicación al reabastecer.\n                          </p>\n                        </div>\n                        <Switch\n                          checked={scanConfig.ubicacion_verificacion_requerida}\n                          disabled={!scanConfig.hid_habilitado && !scanConfig.camara_habilitada}\n                          onCheckedChange={(value) =>\n                            void updateEntryScanPreference({\n                              ubicacion_verificacion_requerida: value,\n                            })\n                          }\n                          aria-label="Confirmar acomodo con escaneo"\n                        />\n                      </label>\n\n                      <label className="flex items-center justify-between gap-3 rounded-xl border p-3">\n                        <div>\n                          <p className="text-sm font-semibold">Pistola USB / Bluetooth</p>\n                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">\n                            Acepta lectores tipo teclado HID.\n                          </p>\n                        </div>\n                        <Switch\n                          checked={scanConfig.hid_habilitado}\n                          onCheckedChange={(value) =>\n                            void updateEntryScanPreference({ hid_habilitado: value })\n                          }\n                          aria-label="Lector HID para entrada"\n                        />\n                      </label>\n\n                      <label className="flex items-center justify-between gap-3 rounded-xl border p-3">\n                        <div>\n                          <p className="text-sm font-semibold">Cámara</p>\n                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">\n                            Permite confirmar con cámara del dispositivo.\n                          </p>\n                        </div>\n                        <Switch\n                          checked={scanConfig.camara_habilitada}\n                          onCheckedChange={(value) =>\n                            void updateEntryScanPreference({ camara_habilitada: value })\n                          }\n                          aria-label="Cámara para entrada"\n                        />\n                      </label>\n                    </div>\n\n                    {!scanConfig.hid_habilitado && !scanConfig.camara_habilitada && (\n                      <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">\n                        Activa al menos un lector antes de exigir confirmación de acomodo.\n                      </p>\n                    )}\n                  </div>\n\n                  {!isRestock && (\n'''
text = replace_once(text, card_anchor, card_controls, "entry scan controls card")
path.write_text(text, encoding="utf-8")

# POS no owns location verification anymore. It retains sale verification and
# shared reader toggles for the checkout workflow.
path = Path("src/components/scanner/ScanControlPanel.tsx")
text = path.read_text(encoding="utf-8")
location_item = '''  {\n    key: "ubicacion_verificacion_requerida",\n    title: "Confirmar ubicación con escaneo",\n    description:\n      "En Entrada de producto, pide escanear la etiqueta del lugar asignado antes de confirmar un reabastecimiento. Puedes dejarlo apagado.",\n    icon: MapPinCheck,\n    accent: "text-violet-600",\n  },\n'''
if location_item in text:
    text = text.replace(location_item, "", 1)
text = text.replace('  MapPinCheck,\n', '', 1)
path.write_text(text, encoding="utf-8")

print("Entry-owned location controls patch applied")
