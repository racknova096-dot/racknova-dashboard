from pathlib import Path
import re

path = Path("src/components/scanner/ScanControlPanel.tsx")
text = path.read_text(encoding="utf-8")

pattern = re.compile(
    r'\n  \{\n    key: "ubicacion_verificacion_requerida",.*?\n  \},',
    re.S,
)
text, count = pattern.subn("", text, count=1)
if count != 1 and 'key: "ubicacion_verificacion_requerida"' in text:
    raise SystemExit("Could not remove stale POS location item")

text = text.replace('  | "ubicacion_verificacion_requerida"\n', '', 1)

if "MapPinCheck" in text:
    raise SystemExit("MapPinCheck must not remain in POS scan control")

path.write_text(text, encoding="utf-8")
print("Stale POS location control removed")
