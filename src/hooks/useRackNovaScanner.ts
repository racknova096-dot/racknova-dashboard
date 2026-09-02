import { useEffect, useRef } from "react";
import {
  createRackNovaScanResult,
  emitRackNovaScan,
  type RackNovaScanResult,
} from "@/lib/racknovaScan";

type RackNovaScannerOptions = {
  enabled?: boolean;
  onScan: (result: RackNovaScanResult) => void;
  minLength?: number;
  maxInterKeyMs?: number;
};

const isEditable = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
};

const isMarkedScanInput = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  target.dataset.racknovaScanInput === "true";

export function useRackNovaScanner({
  enabled = true,
  onScan,
  minLength = 4,
  maxInterKeyMs = 85,
}: RackNovaScannerOptions) {
  const callbackRef = useRef(onScan);

  useEffect(() => {
    callbackRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let buffer = "";
    let lastKeyAt = 0;
    let firstKeyAt = 0;

    const reset = () => {
      buffer = "";
      lastKeyAt = 0;
      firstKeyAt = 0;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        reset();
        return;
      }

      const editable = isEditable(event.target);
      const markedInput = isMarkedScanInput(event.target);

      // Never steal normal typing from checkout fields. The POS search input
      // explicitly opts in with data-racknova-scan-input="true".
      if (editable && !markedInput) {
        reset();
        return;
      }

      const now = performance.now();

      if (event.key.length === 1) {
        if (!lastKeyAt || now - lastKeyAt > maxInterKeyMs) {
          buffer = event.key;
          firstKeyAt = now;
        } else {
          buffer += event.key;
        }
        lastKeyAt = now;
        return;
      }

      if (event.key !== "Enter" && event.key !== "Tab") return;

      const duration = firstKeyAt ? now - firstKeyAt : Number.POSITIVE_INFINITY;
      const maxDuration = Math.max(450, buffer.length * maxInterKeyMs + 120);
      const looksLikeScanner =
        buffer.length >= minLength &&
        lastKeyAt > 0 &&
        now - lastKeyAt <= maxInterKeyMs * 2 &&
        duration <= maxDuration;

      if (!looksLikeScanner) {
        reset();
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const result = createRackNovaScanResult(buffer, "hardware");
      reset();
      if (!result.code) return;

      emitRackNovaScan(result);
      callbackRef.current(result);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled, maxInterKeyMs, minLength]);
}
