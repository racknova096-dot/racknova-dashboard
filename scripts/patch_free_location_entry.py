from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"Anchor not found: {label}")
    return text.replace(old, new, 1)


# ==========================================================
# InventoryContext: RNLOC is canonical for new free locations.
# Legacy rack/nivel/slot remains readable for old inventory.
# ==========================================================
path = Path("src/context/InventoryContext.tsx")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '    locationId: `${rack}-${nivel}-${slot}`,\n',
    '    locationId: product.ubicacion_codigo || `${rack}-${nivel}-${slot}`,\n',
    "map backend free location",
)

old = '''      const finalLocationId = existingProduct?.locationId ?? product.locationId;\n\n      const location = locations.find((item) => item.id === finalLocationId);\n\n      if (!location) {\n        alert("❌ La ubicación seleccionada no existe.");\n        return;\n      }\n\n      const isRestock = Boolean(existingProduct);\n\n      if (!isRestock) {\n        if (location.status !== "libre") {\n          alert("❌ El slot no está libre.");\n          return;\n        }\n\n        const slotOccupied = products.some(\n          (item) => item.locationId === finalLocationId\n        );\n\n        if (slotOccupied) {\n          alert("❌ Este slot ya tiene un producto. Primero elimínalo.");\n          return;\n        }\n      }\n\n      const [rack, nivelStr, slotStr] = finalLocationId.split("-");\n'''
new = '''      const finalLocationId =\n        product.locationId || existingProduct?.locationId || "SIN-UBICACION";\n      const isFreeLocation = finalLocationId.startsWith("RNLOC:");\n      const isRestock = Boolean(existingProduct);\n\n      if (!isFreeLocation) {\n        const location = locations.find((item) => item.id === finalLocationId);\n\n        if (!location) {\n          throw new Error("La ubicación heredada seleccionada no existe.");\n        }\n\n        if (!isRestock) {\n          if (location.status !== "libre") {\n            throw new Error("El slot heredado no está libre.");\n          }\n\n          const slotOccupied = products.some(\n            (item) => item.locationId === finalLocationId\n          );\n\n          if (slotOccupied) {\n            throw new Error("Este slot heredado ya tiene un producto.");\n          }\n        }\n      }\n\n      const [rack, nivelStr, slotStr] = isFreeLocation\n        ? ["LIBRE", "0", "0"]\n        : finalLocationId.split("-");\n'''
text = replace_once(text, old, new, "context location validation")

text = replace_once(
    text,
    '''        stock_alto: Number(product.stock_alto ?? 30),\n        rack,\n''',
    '''        stock_alto: Number(product.stock_alto ?? 30),\n        ubicacion_codigo: isFreeLocation ? finalLocationId : null,\n        rack,\n''',
    "backend payload free location",
)

text = replace_once(
    text,
    '''      const [rack, nivelStr, slotStr] = updatedProduct.locationId.split("-");\n\n      const response = await apiFetch(\n''',
    '''      const isFreeLocation = updatedProduct.locationId.startsWith("RNLOC:");\n      const [rack, nivelStr, slotStr] = isFreeLocation\n        ? ["LIBRE", "0", "0"]\n        : updatedProduct.locationId.split("-");\n\n      const response = await apiFetch(\n''',
    "update product location split",
)

text = replace_once(
    text,
    '''          cantidad: updatedProduct.cantidad,\n          rack,\n''',
    '''          cantidad: updatedProduct.cantidad,\n          ubicacion_codigo: isFreeLocation ? updatedProduct.locationId : null,\n          rack,\n''',
    "update payload free location",
)

text = replace_once(
    text,
    '''    } catch (error) {\n      console.error("❌ Error al preparar producto:", error);\n      alert("Error al preparar producto.");\n    }\n  };\n''',
    '''    } catch (error) {\n      console.error("❌ Error al preparar producto:", error);\n      const message =\n        error instanceof Error ? error.message : "Error al preparar producto.";\n      alert(message);\n      throw error instanceof Error ? error : new Error(message);\n    }\n  };\n''',
    "propagate add product errors",
)
path.write_text(text, encoding="utf-8")


# ==========================================================
# InventoryForm: create a free physical location on first entry,
# remember it on restock and optionally verify it by scan.
# ==========================================================
path = Path("src/components/inventory/InventoryForm.tsx")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { QRConfirmationModal } from "./QRConfirmationModal";\n',
    '''import { LocationLabelModal } from "./LocationLabelModal";\nimport { RackNovaScannerDialog } from "@/components/scanner/RackNovaScannerDialog";\nimport { useRackNovaScanner } from "@/hooks/useRackNovaScanner";\nimport type { RackNovaScanResult } from "@/lib/racknovaScan";\nimport {\n  DEFAULT_SCAN_CONFIG,\n  crearUbicacionScan,\n  desactivarUbicacionScan,\n  obtenerConfiguracionScan,\n  type RackNovaLocationIdentity,\n  type RackNovaScanConfig,\n} from "@/lib/scanControl";\n''',
    "inventory free location imports",
)

text = replace_once(
    text,
    '''  Search,\n  Lock,\n''',
    '''  Search,\n  ScanLine,\n  Camera,\n  CheckCircle2,\n  Lock,\n''',
    "location scan icons",
)

old_state = '''  const [showQRConfirmation, setShowQRConfirmation] = useState(false);\n  const [isSaving, setIsSaving] = useState(false);\n\n  const [lastAddedProduct, setLastAddedProduct] = useState<{\n    sku: string;\n    nombre: string;\n    rack: string;\n    nivel: number;\n    slot: number;\n    timestamp: Date;\n    descripcion?: string | null;\n    cantidad?: number;\n    costoProveedor?: number;\n    precioVentaSugerido?: number;\n    caducidad?: string | null;\n  } | null>(null);\n\n  const { products, locations, addProduct, getProductByLocation } =\n    useInventory();\n'''
new_state = '''  const [isSaving, setIsSaving] = useState(false);\n  const [scanConfig, setScanConfig] =\n    useState<RackNovaScanConfig>(DEFAULT_SCAN_CONFIG);\n  const [locationVerified, setLocationVerified] = useState(false);\n  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);\n  const [locationLabel, setLocationLabel] = useState<{\n    location: RackNovaLocationIdentity;\n    productName: string;\n  } | null>(null);\n\n  const { products, addProduct } = useInventory();\n'''
text = replace_once(text, old_state, new_state, "inventory scan/location state")
text = text.replace('  const locationLocked = selectedSource === "inventory";\n', '')

# Remove old rack availability calculation; legacy state remains only for safe reset compatibility.
text = re.sub(
    r'\n  const availableSlots = locations\.filter\(\(loc\) => \{.*?\n  \}\);\n',
    '\n',
    text,
    count=1,
    flags=re.S,
)

text = replace_once(
    text,
    '''    const [rack, nivel, slot] = product.locationId.split("-");\n\n    setSelectedRack(rack);\n    setSelectedNivel(nivel);\n    setSelectedSlot(slot);\n\n    setCatalogResults([]);\n''',
    '''    setSelectedRack("");\n    setSelectedNivel("");\n    setSelectedSlot("");\n    setLocationVerified(false);\n\n    setCatalogResults([]);\n''',
    "inventory product select free location",
)

# Load local per-device scan preferences and listen to same-tab changes.
anchor = '''  const newLotExpiresBeforeCurrent = useMemo(() => {\n    if (!caducidad || !earliestLot?.caducidad) return false;\n\n    const nueva = new Date(`${caducidad}T00:00:00`).getTime();\n    const actual = new Date(`${earliestLot.caducidad}T00:00:00`).getTime();\n\n    return nueva < actual;\n  }, [caducidad, earliestLot]);\n'''
addition = anchor + '''\n  useEffect(() => {\n    void obtenerConfiguracionScan().then(setScanConfig);\n\n    const handleConfig = (event: Event) => {\n      const custom = event as CustomEvent<RackNovaScanConfig>;\n      if (custom.detail) setScanConfig(custom.detail);\n    };\n\n    window.addEventListener("racknova:scan-config-local", handleConfig);\n    return () =>\n      window.removeEventListener("racknova:scan-config-local", handleConfig);\n  }, []);\n\n  const handleLocationScan = (scan: RackNovaScanResult) => {\n    const expected = selectedInventoryProduct?.locationId?.trim();\n    if (!expected || !expected.startsWith("RNLOC:")) return;\n\n    if (scan.code.trim() === expected) {\n      setLocationVerified(true);\n      toast({\n        title: "Ubicación confirmada",\n        description: "La etiqueta coincide con el lugar asignado al producto.",\n      });\n      return;\n    }\n\n    if (scan.code.trim().startsWith("RNLOC:")) {\n      setLocationVerified(false);\n      toast({\n        title: "Ubicación incorrecta",\n        description: "Esa etiqueta pertenece a otro punto físico.",\n        variant: "destructive",\n      });\n    }\n  };\n\n  useRackNovaScanner({\n    enabled:\n      Boolean(selectedInventoryProduct) &&\n      scanConfig.ubicacion_verificacion_requerida &&\n      scanConfig.hid_habilitado,\n    onScan: handleLocationScan,\n  });\n\n  useEffect(() => {\n    setLocationVerified(false);\n  }, [selectedInventoryProduct?.sku]);\n'''
text = replace_once(text, anchor, addition, "scan config effects")

# Replace mandatory rack selection with RNLOC creation/verification logic.
pattern = re.compile(
    r'    let locationId = "";\n\n    if \(selectedInventoryProduct\) \{.*?\n    const \[finalRack, finalNivel, finalSlot\] = locationId\.split\("-"\);\n',
    re.S,
)
replacement = '''    let locationId = selectedInventoryProduct?.locationId?.trim() || "";\n    const alreadyHasFreeLocation = locationId.startsWith("RNLOC:");\n\n    if (\n      isRestock &&\n      alreadyHasFreeLocation &&\n      scanConfig.ubicacion_verificacion_requerida &&\n      !locationVerified\n    ) {\n      toast({\n        title: "Confirma la ubicación",\n        description:\n          "Escanea la etiqueta física asignada antes de registrar este restock.",\n        variant: "destructive",\n      });\n      return;\n    }\n\n    let createdLocationForThisEntry: RackNovaLocationIdentity | null = null;\n    let inventorySaved = false;\n'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1 and 'createdLocationForThisEntry' not in text:
    raise SystemExit("Anchor not found: submit location block")

text = replace_once(
    text,
    '''    try {\n      setIsSaving(true);\n\n\n      const unitResponse = await apiFetch(\n''',
    '''    try {\n      setIsSaving(true);\n\n      if (!locationId.startsWith("RNLOC:")) {\n        createdLocationForThisEntry = await crearUbicacionScan({\n          nombre: `Ubicación de ${finalNombre}`,\n          descripcion: `Punto físico asignado a ${finalNombre} (${finalSku}).`,\n        });\n        locationId = createdLocationForThisEntry.codigo_ubicacion;\n      }\n\n      const unitResponse = await apiFetch(\n''',
    "create free location before inventory save",
)

# Product registration now carries RNLOC directly.
old_success = '''      await addProduct({\n        locationId,\n        sku: finalSku,\n        nombre: finalNombre,\n        descripcion: finalDescripcion || null,\n        cantidad: cantidadNum,\n        costo_proveedor: costoProveedorNum,\n        precio_venta_sugerido: precioVentaSugeridoNum,\n        caducidad: caducidadValue,\n        stock_minimo: stockMinimoNum,\n        stock_alto: stockAltoNum,\n      });\n\n      setLastAddedProduct({\n        sku: finalSku,\n        nombre: finalNombre,\n        rack: finalRack,\n        nivel: parseInt(finalNivel),\n        slot: parseInt(finalSlot),\n        timestamp: new Date(),\n        descripcion: finalDescripcion || null,\n        cantidad: cantidadComercial,\n        costoProveedor: costoProveedorComercial,\n        precioVentaSugerido: precioVentaSugeridoNum,\n        caducidad: caducidadValue,\n      });\n\n      setShowQRConfirmation(true);\n'''
new_success = '''      await addProduct({\n        locationId,\n        sku: finalSku,\n        nombre: finalNombre,\n        descripcion: finalDescripcion || null,\n        cantidad: cantidadNum,\n        costo_proveedor: costoProveedorNum,\n        precio_venta_sugerido: precioVentaSugeridoNum,\n        caducidad: caducidadValue,\n        stock_minimo: stockMinimoNum,\n        stock_alto: stockAltoNum,\n      });\n      inventorySaved = true;\n\n      if (createdLocationForThisEntry) {\n        setLocationLabel({\n          location: createdLocationForThisEntry,\n          productName: finalNombre,\n        });\n      }\n'''
text = replace_once(text, old_success, new_success, "inventory success free label")

text = replace_once(
    text,
    '''    } catch (error) {\n      console.error("Error agregando producto:", error);\n\n      toast({\n''',
    '''    } catch (error) {\n      console.error("Error agregando producto:", error);\n\n      if (createdLocationForThisEntry && !inventorySaved) {\n        void desactivarUbicacionScan(createdLocationForThisEntry.id_ubicacion).catch(\n          () => undefined\n        );\n      }\n\n      toast({\n''',
    "cleanup unused location",
)

# Restock explanation should use universal free location language.
text = replace_once(
    text,
    '''                          Este producto ya existe en inventario. RackNova sumará\n                          la nueva cantidad, conservará la ubicación{" "}\n                          <strong>{selectedInventoryProduct.locationId}</strong>\n                          , recalculará el costo promedio y creará un lote nuevo\n                          con la caducidad capturada.\n''',
    '''                          Este producto ya existe en inventario. RackNova sumará\n                          la nueva cantidad y lo mantendrá asociado a{" "}\n                          <strong>{selectedInventoryProduct.locationId}</strong>.\n                          Si todavía usa una ubicación heredada, esta entrada la\n                          convertirá a una etiqueta libre RNLOC.\n''',
    "restock copy",
)

# Replace rack/nivel/slot card with free-location operational card.
location_pattern = re.compile(
    r'\n              <Card>\n                <CardHeader className="pb-4">\n                  <CardTitle className="flex items-center gap-2 text-lg">\n                    <MapPin className="h-4 w-4" />\n                    Ubicación en Inventario\n                  </CardTitle>\n                </CardHeader>.*?\n              </Card>\n\n              <div className="flex flex-col gap-3 pt-4',
    re.S,
)
new_card = '''\n              <Card className="overflow-hidden border-violet-500/20">\n                <CardHeader className="pb-4">\n                  <CardTitle className="flex items-center gap-2 text-lg">\n                    <MapPin className="h-4 w-4 text-violet-600" />\n                    Ubicación física libre\n                  </CardTitle>\n                </CardHeader>\n\n                <CardContent className="space-y-4">\n                  {!isRestock && (\n                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">\n                      <p className="font-semibold">Tú decides dónde va el producto</p>\n                      <p className="mt-2 text-sm leading-6 text-muted-foreground">\n                        No necesitas crear racks, niveles ni posiciones. Al guardar,\n                        RackNova generará una etiqueta QR + Code128. Coloca el\n                        producto donde quieras y pega la etiqueta exactamente ahí.\n                      </p>\n                    </div>\n                  )}\n\n                  {isRestock && selectedInventoryProduct?.locationId.startsWith("RNLOC:") && (\n                    <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">\n                      <div>\n                        <p className="text-sm font-semibold">Ubicación asignada</p>\n                        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">\n                          {selectedInventoryProduct.locationId}\n                        </p>\n                      </div>\n\n                      {scanConfig.ubicacion_verificacion_requerida ? (\n                        <div className={`rounded-xl border p-3 ${locationVerified ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>\n                          <div className="flex items-start gap-3">\n                            {locationVerified ? (\n                              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />\n                            ) : (\n                              <ScanLine className="mt-0.5 h-5 w-5 text-amber-600" />\n                            )}\n                            <div className="flex-1">\n                              <p className="text-sm font-semibold">\n                                {locationVerified\n                                  ? "Ubicación confirmada"\n                                  : "Escanea la etiqueta donde vas a acomodarlo"}\n                              </p>\n                              <p className="mt-1 text-xs leading-5 text-muted-foreground">\n                                {locationVerified\n                                  ? "La lectura coincide con la ubicación guardada."\n                                  : "Esto confirma físicamente que el reabastecimiento va al mismo lugar."}\n                              </p>\n                              {!locationVerified && scanConfig.camara_habilitada && (\n                                <Button\n                                  type="button"\n                                  variant="outline"\n                                  size="sm"\n                                  className="mt-3"\n                                  onClick={() => setCameraScannerOpen(true)}\n                                >\n                                  <Camera className="mr-2 h-4 w-4" />\n                                  Usar cámara\n                                </Button>\n                              )}\n                            </div>\n                          </div>\n                        </div>\n                      ) : (\n                        <p className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs leading-5 text-muted-foreground">\n                          La confirmación física está desactivada en este dispositivo.\n                          RackNova te muestra la ubicación, pero no te obliga a escanearla.\n                        </p>\n                      )}\n                    </div>\n                  )}\n\n                  {isRestock && selectedInventoryProduct && !selectedInventoryProduct.locationId.startsWith("RNLOC:") && (\n                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">\n                      <p className="font-semibold">Migración automática a ubicación libre</p>\n                      <p className="mt-2 text-sm leading-6 text-muted-foreground">\n                        Este producto todavía usa la ubicación anterior{" "}\n                        <strong>{selectedInventoryProduct.locationId}</strong>. Al\n                        registrar esta entrada, RackNova generará una nueva etiqueta\n                        RNLOC para que la pegues donde realmente guardas el artículo.\n                      </p>\n                    </div>\n                  )}\n                </CardContent>\n              </Card>\n\n              <div className="flex flex-col gap-3 pt-4'''
text, count = location_pattern.subn(new_card, text, count=1)
if count != 1 and 'Ubicación física libre' not in text:
    raise SystemExit("Anchor not found: free location card")

# Replace old product QR modal with location label + optional camera scanner.
old_modal = '''        <QRConfirmationModal\n          isOpen={showQRConfirmation}\n          onClose={() => setShowQRConfirmation(false)}\n          productData={lastAddedProduct}\n        />\n'''
new_modal = '''        <LocationLabelModal\n          open={Boolean(locationLabel)}\n          onOpenChange={(open) => {\n            if (!open) setLocationLabel(null);\n          }}\n          location={locationLabel?.location ?? null}\n          productName={locationLabel?.productName ?? null}\n        />\n\n        <RackNovaScannerDialog\n          open={cameraScannerOpen}\n          onOpenChange={setCameraScannerOpen}\n          onScan={handleLocationScan}\n          title="Confirmar ubicación de acomodo"\n          description="Escanea la etiqueta RackNova pegada en el lugar donde vas a colocar este producto."\n        />\n'''
text = replace_once(text, old_modal, new_modal, "replace QR modal")
path.write_text(text, encoding="utf-8")


# ==========================================================
# Add Product hero: universal physical location, no rack requirement.
# ==========================================================
path = Path("src/pages/AddProduct.tsx")
text = path.read_text(encoding="utf-8")
text = text.replace(
    'description="Registra productos nuevos, reabastece productos existentes y controla caducidad, costos, ubicación y stock crítico."',
    'description="Registra entradas, crea una ubicación física libre para productos nuevos y guía cada reabastecimiento hacia el mismo lugar."',
)
text = text.replace('value: "Rack / Nivel / Slot",', 'value: "Libre · RNLOC",')
text = text.replace(
    '''        Si el producto ya existe, RackNova lo detecta como restock y conserva su\n        ubicación. Si es nuevo, se registra en inventario y catálogo.\n''',
    '''        Si el producto es nuevo, RackNova genera una etiqueta para el lugar\n        físico que tú elijas. En entradas futuras puede pedirte escanear esa misma\n        etiqueta antes de confirmar el acomodo.\n''',
)
path.write_text(text, encoding="utf-8")


# ==========================================================
# POS: remove location creation/administration. POS remains an output flow.
# Scanner preferences remain as device tools.
# ==========================================================
path = Path("src/pages/PuntoVenta.tsx")
text = path.read_text(encoding="utf-8")
text = text.replace('import { LocationIdentityPanel } from "@/components/scanner/LocationIdentityPanel";\n', '')
text = text.replace(
    '  const canManageScan = role === "admin" || role === "owner";\n  const canManageLocations = canManageScan || role === "operator";\n',
    '  const canManageScan = role === "admin" || role === "owner" || role === "operator";\n',
)
text = text.replace('        <LocationIdentityPanel canManage={canManageLocations} />\n', '')
path.write_text(text, encoding="utf-8")


# Scanner copy: location verification now belongs to Entrada.
path = Path("src/components/scanner/ScanControlPanel.tsx")
text = path.read_text(encoding="utf-8")
text = text.replace(
    '"Prepara RackNova para exigir ubicación + producto en los flujos de acomodo y reubicación. Se aplicará en la siguiente fase operativa.",',
    '"En Entrada de producto, pide escanear la etiqueta del lugar asignado antes de confirmar un reabastecimiento. Puedes dejarlo apagado.",',
)
text = text.replace('Solo administración puede cambiar estas preferencias.', 'Tu perfil es de solo lectura para estas preferencias.')
path.write_text(text, encoding="utf-8")

print("Free-location dashboard patch applied")
