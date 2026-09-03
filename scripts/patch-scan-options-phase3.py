from pathlib import Path

path = Path("src/pages/PuntoVenta.tsx")
text = path.read_text(encoding="utf-8")

if "RACKNOVA_SCAN_OPTIONS_PHASE3" in text:
    print("Scan options phase 3 already applied")
    raise SystemExit(0)

# Imports
text = text.replace(
    'import { RackNovaScannerDialog } from "@/components/scanner/RackNovaScannerDialog";\n',
    'import { RackNovaScannerDialog } from "@/components/scanner/RackNovaScannerDialog";\n'
    'import { ScanControlPanel } from "@/components/scanner/ScanControlPanel";\n'
    'import { LocationIdentityPanel } from "@/components/scanner/LocationIdentityPanel";\n',
    1,
)
text = text.replace(
    'import type { RackNovaScanResult } from "@/lib/racknovaScan";\n',
    'import type { RackNovaScanResult } from "@/lib/racknovaScan";\n'
    'import { DEFAULT_SCAN_CONFIG, obtenerConfiguracionScan, type RackNovaScanConfig } from "@/lib/scanControl";\n',
    1,
)

# Marker and state after workspace scanner state.
state_anchor = '''  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);\n  const [lastScanSource, setLastScanSource] = useState<RackNovaScanResult["source"] | null>(null);'''
state_replacement = state_anchor + '''\n  // RACKNOVA_SCAN_OPTIONS_PHASE3\n  const [scanConfig, setScanConfig] = useState<RackNovaScanConfig>(DEFAULT_SCAN_CONFIG);\n  const canManageScan = role === "admin" || role === "owner";\n  const canManageLocations = canManageScan || role === "operator";'''
if state_anchor not in text:
    raise SystemExit("scanner state anchor not found")
text = text.replace(state_anchor, state_replacement, 1)

# Load configuration before loadState.
load_anchor = '  const loadState = useCallback(async () => {'
load_block = '''  useEffect(() => {\n    let cancelled = false;\n    void obtenerConfiguracionScan()\n      .then((config) => {\n        if (!cancelled) setScanConfig(config);\n      })\n      .catch(() => {\n        if (!cancelled) setScanConfig(DEFAULT_SCAN_CONFIG);\n      });\n    return () => {\n      cancelled = true;\n    };\n  }, []);\n\n  useEffect(() => {\n    if (!scanConfig.pos_verificacion_requerida) return;\n    setCart((current) =>\n      current.map((item) =>\n        item.verifiedSource\n          ? item\n          : {\n              ...item,\n              verificationStatus: "pending",\n              verifiedCode: null,\n              verifiedAt: null,\n              verifiedSource: null,\n            }\n      )\n    );\n  }, [scanConfig.pos_verificacion_requerida]);\n\n'''
if load_anchor not in text:
    raise SystemExit("load state anchor not found")
text = text.replace(load_anchor, load_block + load_anchor, 1)

# Pending memo only applies when feature enabled.
old_pending = '''  const pendingVerificationCount = useMemo(\n    () => cart.filter((item) => item.verificationStatus !== "verified").length,\n    [cart]\n  );'''
new_pending = '''  const pendingVerificationCount = useMemo(\n    () =>\n      scanConfig.pos_verificacion_requerida\n        ? cart.filter((item) => item.verificationStatus !== "verified").length\n        : 0,\n    [cart, scanConfig.pos_verificacion_requerida]\n  );'''
if old_pending not in text:
    raise SystemExit("pending memo anchor not found")
text = text.replace(old_pending, new_pending, 1)

# Manual products are effectively verified when enforcement is disabled.
old_verified = '    const verified = Boolean(options?.verified);'
new_verified = '    const verified = !scanConfig.pos_verificacion_requerida || Boolean(options?.verified);'
if old_verified not in text:
    raise SystemExit("verified variable anchor not found")
text = text.replace(old_verified, new_verified, 1)

# Do not try verification matching when setting is disabled.
verify_anchor = '''  const verifyPendingProduct = (\n    product: POSProducto,\n    scan: RackNovaScanResult\n  ) => {\n    const pending = cart.filter('''
verify_replacement = '''  const verifyPendingProduct = (\n    product: POSProducto,\n    scan: RackNovaScanResult\n  ) => {\n    if (!scanConfig.pos_verificacion_requerida) return false;\n\n    const pending = cart.filter('''
if verify_anchor not in text:
    raise SystemExit("verify function anchor not found")
text = text.replace(verify_anchor, verify_replacement, 1)

# HID option controls global scanner listener.
old_enabled = '''      Boolean(sesion?.estado === "ABIERTA") &&\n      workspacePanel === "sale" &&\n      !cameraScannerOpen,'''
new_enabled = '''      Boolean(sesion?.estado === "ABIERTA") &&\n      workspacePanel === "sale" &&\n      scanConfig.hid_habilitado &&\n      !cameraScannerOpen,'''
if old_enabled not in text:
    raise SystemExit("HID enabled anchor not found")
text = text.replace(old_enabled, new_enabled, 1)

# Camera button respects preference.
old_camera_button = '''                    onClick={() => setCameraScannerOpen(true)}\n                    aria-label="Escanear con cámara"\n                    title="Escanear con cámara"'''
new_camera_button = '''                    onClick={() => setCameraScannerOpen(true)}\n                    disabled={!scanConfig.camara_habilitada}\n                    aria-label="Escanear con cámara"\n                    title={scanConfig.camara_habilitada ? "Escanear con cámara" : "Cámara desactivada por configuración"}'''
if old_camera_button not in text:
    raise SystemExit("camera button anchor not found")
text = text.replace(old_camera_button, new_camera_button, 1)

# Status line shows scanner ownership clearly.
old_hid_label = '''                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />\n                  <ScanLine className="h-3.5 w-3.5" /> Pistola USB / Bluetooth lista'''
new_hid_label = '''                  <span className={`h-2 w-2 rounded-full ${scanConfig.hid_habilitado ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" : "bg-slate-400"}`} />\n                  <ScanLine className="h-3.5 w-3.5" /> {scanConfig.hid_habilitado ? "Pistola USB / Bluetooth lista" : "Pistola desactivada"}'''
if old_hid_label not in text:
    raise SystemExit("HID label anchor not found")
text = text.replace(old_hid_label, new_hid_label, 1)

# Verification badge shown only when policy is enabled.
old_badge = '''{item.verificationStatus === "verified" ? <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Verificado</span> : <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300"><ScanLine className="h-3.5 w-3.5" />Pendiente de escaneo</span>}'''
new_badge = '''{scanConfig.pos_verificacion_requerida && (item.verificationStatus === "verified" ? <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Verificado</span> : <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300"><ScanLine className="h-3.5 w-3.5" />Pendiente de escaneo</span>)}'''
if old_badge not in text:
    raise SystemExit("verification badge anchor not found")
text = text.replace(old_badge, new_badge, 1)

# Verification panel only shown when enabled.
old_panel = '{cart.length > 0 && <div className={`mt-3 rounded-2xl border p-3 ${pendingVerificationCount > 0 ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}'
new_panel = '{scanConfig.pos_verificacion_requerida && cart.length > 0 && <div className={`mt-3 rounded-2xl border p-3 ${pendingVerificationCount > 0 ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}'
if old_panel not in text:
    raise SystemExit("verification panel anchor not found")
text = text.replace(old_panel, new_panel, 1)

# Add controls + location identities to Tools, before legacy advanced tools.
tools_anchor = '''      {workspacePanel === "tools" && <section className="space-y-4"><div className="rn-pos-surface flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">'''
tools_replacement = '''      {workspacePanel === "tools" && <section className="space-y-4">\n        <ScanControlPanel config={scanConfig} canManage={canManageScan} onChange={setScanConfig} />\n        <LocationIdentityPanel canManage={canManageLocations} />\n        <div className="rn-pos-surface flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">'''
if tools_anchor not in text:
    raise SystemExit("tools section anchor not found")
text = text.replace(tools_anchor, tools_replacement, 1)

path.write_text(text, encoding="utf-8")
print("Applied RackNova Scan Options + Location Identity UI")
