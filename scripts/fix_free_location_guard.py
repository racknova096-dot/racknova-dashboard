from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"Anchor not found: {label}")
    return text.replace(old, new, 1)


# Prevent a failed inventory save from being treated as success.
path = Path("src/context/InventoryContext.tsx")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '''        if (!response.ok) {\n          const errorText = await response.text();\n          console.error("❌ Error guardando producto:", response.status, errorText);\n          alert("No se pudo guardar el producto en backend.");\n          return;\n        }\n''',
    '''        if (!response.ok) {\n          const errorText = await response.text();\n          console.error("❌ Error guardando producto:", response.status, errorText);\n          throw new Error("No se pudo guardar el producto en backend.");\n        }\n''',
    "propagate backend product save failure",
)
path.write_text(text, encoding="utf-8")


# Make location verification impossible to deadlock when all scanners are off.
path = Path("src/components/inventory/InventoryForm.tsx")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '''  const stockActualComercial = selectedInventoryProduct\n    ? Number(selectedInventoryProduct.cantidad || 0) / factorInventario\n    : 0;\n\n\n  const searchTerm = useMemo(() => {\n''',
    '''  const stockActualComercial = selectedInventoryProduct\n    ? Number(selectedInventoryProduct.cantidad || 0) / factorInventario\n    : 0;\n  const locationVerificationActive =\n    scanConfig.ubicacion_verificacion_requerida &&\n    (scanConfig.hid_habilitado || scanConfig.camara_habilitada);\n\n\n  const searchTerm = useMemo(() => {\n''',
    "effective location verification state",
)
text = text.replace(
    '''      scanConfig.ubicacion_verificacion_requerida &&\n      scanConfig.hid_habilitado,\n''',
    '''      locationVerificationActive &&\n      scanConfig.hid_habilitado,\n''',
    1,
)
text = text.replace(
    '''      scanConfig.ubicacion_verificacion_requerida &&\n      !locationVerified\n''',
    '''      locationVerificationActive &&\n      !locationVerified\n''',
    1,
)
text = text.replace(
    '''                      {scanConfig.ubicacion_verificacion_requerida ? (\n''',
    '''                      {locationVerificationActive ? (\n''',
    1,
)
old_pref = '''  const updateEntryScanPreference = async (\n    patch: Partial<RackNovaScanConfig>\n  ) => {\n    const previous = scanConfig;\n    const optimistic = { ...scanConfig, ...patch };\n    setScanConfig(optimistic);\n\n    try {\n      const saved = await guardarConfiguracionScan(patch);\n'''
new_pref = '''  const updateEntryScanPreference = async (\n    patch: Partial<RackNovaScanConfig>\n  ) => {\n    const previous = scanConfig;\n    const normalizedPatch: Partial<RackNovaScanConfig> = { ...patch };\n    const nextHid = patch.hid_habilitado ?? scanConfig.hid_habilitado;\n    const nextCamera = patch.camara_habilitada ?? scanConfig.camara_habilitada;\n\n    if (!nextHid && !nextCamera) {\n      normalizedPatch.ubicacion_verificacion_requerida = false;\n    }\n\n    const optimistic = { ...scanConfig, ...normalizedPatch };\n    setScanConfig(optimistic);\n\n    try {\n      const saved = await guardarConfiguracionScan(normalizedPatch);\n'''
text = replace_once(text, old_pref, new_pref, "normalize scanner preference")
path.write_text(text, encoding="utf-8")
