from pathlib import Path

path = Path("src/context/InventoryContext.tsx")
text = path.read_text(encoding="utf-8")

old = '    const [rack, nivelStr, slotStr] = updatedProduct.locationId.split("-");\n\n    const response = await apiFetch(\n'
new = '''    const isFreeLocation = updatedProduct.locationId.startsWith("RNLOC:");\n    const [rack, nivelStr, slotStr] = isFreeLocation\n      ? ["LIBRE", "0", "0"]\n      : updatedProduct.locationId.split("-");\n\n    const response = await apiFetch(\n'''

if new not in text:
    if old not in text:
        raise SystemExit("UpdateProduct location split anchor not found")
    text = text.replace(old, new, 1)

# Free locations are software-defined. They must never be translated to a
# legacy ESP32 rack pin if MQTT is enabled again in the future.
old_mqtt = '''      const nivel = parseInt(nivelStr);\n      const slot = parseInt(slotStr);\n\n      const pinMap: Record<number, number> = {\n'''
new_mqtt = '''      if (isFreeLocation) {\n        console.log(\n          "Ubicación RNLOC: no requiere comando físico de rack:",\n          finalLocationId\n        );\n        return;\n      }\n\n      const nivel = parseInt(nivelStr);\n      const slot = parseInt(slotStr);\n\n      const pinMap: Record<number, number> = {\n'''

if new_mqtt not in text:
    if old_mqtt not in text:
        raise SystemExit("MQTT free-location anchor not found")
    text = text.replace(old_mqtt, new_mqtt, 1)

path.write_text(text, encoding="utf-8")
print("Free-location dashboard anchors stabilized")
