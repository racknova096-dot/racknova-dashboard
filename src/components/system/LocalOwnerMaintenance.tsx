import { useEffect, useRef, useState } from "react";
import {
  DatabaseBackup,
  Loader2,
  LockKeyhole,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  borrarBaseLocal,
  obtenerEstadoBorradoLocal,
  type LocalOwnerResetStatus,
} from "@/lib/localOwnerReset";

const DEFAULT_CONFIRMATION = "BORRAR RACKNOVA LOCAL";

export function LocalOwnerMaintenance() {
  const role = (localStorage.getItem("rol") || "").toLowerCase();
  const [status, setStatus] = useState<LocalOwnerResetStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [working, setWorking] = useState(false);
  const [unlockClicks, setUnlockClicks] = useState(0);
  const unlockStartedAt = useRef(0);

  useEffect(() => {
    if (role !== "admin") return;

    let mounted = true;
    void obtenerEstadoBorradoLocal()
      .then((value) => {
        if (mounted) setStatus(value);
      })
      .catch(() => {
        // En RackNova Cloud esta ruta no existe: no mostramos ningún control.
        if (mounted) setStatus(null);
      });

    return () => {
      mounted = false;
    };
  }, [role]);

  if (role !== "admin" || !status?.available || !status.is_owner) {
    return null;
  }

  const expected = status.confirmation_text || DEFAULT_CONFIRMATION;

  const handleHiddenUnlock = () => {
    const now = Date.now();

    if (!unlockStartedAt.current || now - unlockStartedAt.current > 5000) {
      unlockStartedAt.current = now;
      setUnlockClicks(1);
      return;
    }

    const next = unlockClicks + 1;
    if (next >= 5) {
      unlockStartedAt.current = 0;
      setUnlockClicks(0);
      setOpen(true);
      return;
    }

    setUnlockClicks(next);
  };

  const closeDialog = (nextOpen: boolean) => {
    if (working) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setPassword("");
      setConfirmation("");
    }
  };

  const handleReset = async () => {
    if (confirmation.trim() !== expected || !password) return;

    setWorking(true);
    try {
      const result = await borrarBaseLocal({
        password,
        confirmation: confirmation.trim(),
      });

      toast.success(
        `Base local limpia. Se eliminaron ${result.rows_removed} registros.`
      );
      toast.message("Respaldo automático creado antes del borrado.", {
        description: result.backup,
        duration: 8000,
      });

      setOpen(false);
      window.setTimeout(() => {
        window.location.reload();
      }, 1400);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No fue posible limpiar la base de datos local."
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <div className="flex justify-center py-1">
        <button
          type="button"
          onClick={handleHiddenUnlock}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-muted-foreground/25 transition-colors hover:text-muted-foreground/50"
          aria-label="RackNova Local"
          title="RackNova Local"
        >
          <LockKeyhole className="h-3 w-3" />
          RackNova Local
        </button>
      </div>

      <AlertDialog open={open} onOpenChange={closeDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle>Zona del propietario</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left leading-6">
              <span className="block">
                Esta acción elimina los datos operativos guardados en
                <strong> esta computadora</strong>: productos, catálogo,
                movimientos, ventas, compras y demás información comercial.
              </span>
              <span className="block">
                RackNova crea primero un respaldo completo de PostgreSQL. Se
                conservan la instalación, la activación Cloud, el nodo y la
                cuenta propietaria.
              </span>
              <span className="block font-semibold text-foreground">
                No elimina la base de RackNova Cloud. Si Cloud todavía contiene
                información, los cambios futuros de sincronización pueden volver
                a reflejar datos en este equipo.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
              <div className="flex gap-3">
                <DatabaseBackup className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-bold">Respaldo obligatorio</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Si RackNova no puede crear el respaldo automático, el
                    borrado se cancela y no modifica la base.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Contraseña de propietario
              </label>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={working}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Confirma tu contraseña"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Escribe exactamente:
              </label>
              <code className="mb-2 block rounded-lg bg-secondary px-3 py-2 text-xs font-bold">
                {expected}
              </code>
              <Input
                value={confirmation}
                disabled={working}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={expected}
                autoComplete="off"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={working}
              onClick={() => closeDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                working ||
                !password ||
                confirmation.trim() !== expected
              }
              onClick={() => void handleReset()}
            >
              {working ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {working ? "Creando respaldo y borrando..." : "Borrar base local"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
