export type RackNovaScanSource = "hardware" | "camera" | "manual";
export type RackNovaScanKind = "product" | "location" | "unknown";

export type RackNovaScanResult = {
  raw: string;
  code: string;
  kind: RackNovaScanKind;
  source: RackNovaScanSource;
  scannedAt: number;
};

export const RACKNOVA_SCAN_EVENT = "racknova:scan";

const LOCATION_PREFIXES = ["RNLOC:", "RNLOC-", "RN-LOC:", "RN-LOC-"];

export const normalizeScanCode = (value: string) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

export const classifyScanCode = (value: string): RackNovaScanKind => {
  const code = normalizeScanCode(value);
  if (!code) return "unknown";

  const upper = code.toUpperCase();
  if (LOCATION_PREFIXES.some((prefix) => upper.startsWith(prefix))) {
    return "location";
  }

  // Product identifiers in RackNova can be EAN/UPC/Code128 values or
  // alphanumeric SKUs. Location labels are intentionally namespaced above.
  if (code.length >= 2) return "product";

  return "unknown";
};

export const createRackNovaScanResult = (
  raw: string,
  source: RackNovaScanSource
): RackNovaScanResult => {
  const code = normalizeScanCode(raw);
  return {
    raw,
    code,
    kind: classifyScanCode(code),
    source,
    scannedAt: Date.now(),
  };
};

export const emitRackNovaScan = (result: RackNovaScanResult) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RackNovaScanResult>(RACKNOVA_SCAN_EVENT, {
      detail: result,
    })
  );
};
