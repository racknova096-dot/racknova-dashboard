import { useEffect, useState } from "react";
import { DatabaseBackup, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiJson } from "@/lib/api";

type OwnerResetStatus = {
  ok: boolean;
  available: boolean;
  runtime: string;
  role: string;
  confirmation_phrase: string;
  preserves: string[];
};

type OwnerResetResult = {
  ok: boolean;
  message: string;
  backup_path: string;
  cleared_tables: number;
  node_code: string;
};

export function OwnerLocalResetCard() {
  const [status, setStatus] = useState<OwnerResetStatus | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    void apiJson<OwnerResetStatus>("/racknova-native/owner-reset/status")
      .then((data) => {
        if (mounted && data.available) setStatus(data);
      })
      .catch(() => {
        if (mounted) setStatus(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!status?.available) return null;

  const runReset = async () => {
    if (busy) return;

    if (!password.trim()) {
      toast.error("Captura tu contraseña de propietario.");
      return;
    }

    if (confirmation.trim() !== status.confirmation_phrase) {
      toast.error(
        `Escribe exactamente: ${status.confirmation_phrase}`
      );
      return;
    }

    const accepted = window.confirm(
      "Esta acción vaciará los datos operativos de ESTA computadora. " +
        "RackNova creará un respaldo antes de borrar. " +
        "Usuarios, empresa, activación y vínculo Cloud se conservarán. " +
        "Si Cloud aún contiene información, Sync puede volver a descargarla. ¿Continuar?"
    );

    if (!accepted) return;

    try {
      setBusy(true);
      const result = await apiJson<OwnerResetResult>(
        "/racknova-native/owner-reset",
        {
          method: "POST",
          body: JSON.stringify({
            password,
            confirmation: confirmation.trim(),
          }),
        }
      );

      toast.success(
        `Datos locales eliminados. Respaldo creado antes del borrado. Tablas limpiadas: ${result.cleared_tables}.`
      );
      setPassword("");
      setConfirmation("");
      setExpanded(false);

      window.dispatchEvent(
        new CustomEvent("racknova:local-reset-completed", {
          detail: result,
        })
      );

      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo completar el borrado local."
      );
    } finally {
      setBusy(false);
    }
  };

  if (!expanded) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[11px] font-semibold text-muted-foreground/55 transition-colors hover:text-muted-foreground"
          aria-label="Abrir mantenimiento local avanzado"
        >
          Mantenimiento local avanzado
        </button>
      </div>
    );
  }

  return (
    <Card className="racknova-card overflow-hidden border-destructive/30">
      <CardHeader className="border-b border-destructive/15 bg-destructive/[0.025]">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          Borrado maestro local
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.04] p-4">
          <div className="flex items-start gap-3">
            <DatabaseBackup className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-black">
                Exclusivo del propietario en RackNova Local
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Antes de borrar, RackNova genera automáticamente un respaldo completo
                de PostgreSQL. Se conservan usuarios, empresa, activación, vínculo
                con RackNova Cloud e identidad de este nodo.
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Importante: si RackNova Cloud todavía contiene productos,
                movimientos o ventas, la sincronización puede volver a descargarlos
                después del borrado local.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold">
              Contraseña del propietario
            </label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={busy}
              placeholder="Tu contraseña actual"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold">
              Confirmación
            </label>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={busy}
              placeholder={status.confirmation_phrase}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Escribe exactamente: <strong>{status.confirmation_phrase}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setExpanded(false);
              setPassword("");
              setConfirmation("");
            }}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            variant="destructive"
            disabled={
              busy ||
              !password.trim() ||
              confirmation.trim() !== status.confirmation_phrase
            }
            onClick={() => void runReset()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {busy ? "Respaldando y borrando..." : "Borrar datos locales"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
