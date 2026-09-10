import { useEffect, useState } from "react";
import { DatabaseBackup, Loader2, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiJson } from "@/lib/api";

type ResetCapability = {
  native: boolean;
  allowed: boolean;
  confirmation?: string | null;
};

type ResetResult = {
  ok: boolean;
  message: string;
  tables_cleared: string[];
  backup: string;
};

const REQUIRED_TAPS = 7;
const DEFAULT_CONFIRMATION = "BORRAR RACKNOVA LOCAL";

export function LocalOwnerReset() {
  const [capability, setCapability] = useState<ResetCapability | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let mounted = true;

    apiJson<ResetCapability>("/racknova-native/owner-reset/capability")
      .then((value) => {
        if (mounted) setCapability(value);
      })
      .catch(() => {
        if (mounted) setCapability(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!capability?.native || !capability.allowed) {
    return null;
  }

  const requiredConfirmation =
    capability.confirmation || DEFAULT_CONFIRMATION;

  const handleHiddenAccess = () => {
    if (unlocked) return;

    const next = tapCount + 1;
    setTapCount(next);

    if (next >= REQUIRED_TAPS) {
      setUnlocked(true);
      setTapCount(0);
      toast.info("Zona del propietario desbloqueada.");
    }
  };

  const performReset = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (resetting) return;

    setResetting(true);
    try {
      const result = await apiJson<ResetResult>(
        "/racknova-native/owner-reset",
        {
          method: "POST",
          body: JSON.stringify({
            password,
            confirmation,
          }),
        }
      );

      toast.success("RackNova Local quedó limpio.", {
        description: "Respaldo creado en " + result.backup,
        duration: 7000,
      });
      setDialogOpen(false);
      setPassword("");
      setConfirmation("");

      window.setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No fue posible limpiar RackNova Local."
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <section className="pt-2">
      {!unlocked ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleHiddenAccess}
            className="select-none text-[10px] font-medium tracking-wide text-muted-foreground/30 transition-colors hover:text-muted-foreground/50"
            aria-label="Información de RackNova Local"
          >
            RackNova Local
          </button>
        </div>
      ) : (
        <Card className="overflow-hidden border-destructive/30 bg-destructive/[0.025]">
          <CardHeader className="border-b border-destructive/15">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Zona del propietario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="rounded-xl border border-destructive/20 bg-background p-4">
              <div className="flex items-start gap-3">
                <DatabaseBackup className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-black">Restablecer datos locales</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Vacía inventario, catálogo, lotes, movimientos, ventas,
                    compras y demás información operativa de esta computadora.
                    Conserva tu usuario, activación, empresa, Sync Secret y
                    configuración de RackNova Local.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs leading-5 text-muted-foreground">
              Antes de borrar, RackNova crea automáticamente un respaldo completo
              de PostgreSQL. Esta acción no elimina información de RackNova Cloud;
              si Cloud todavía contiene datos, la sincronización puede volver a
              descargarlos.
            </p>

            <Button
              type="button"
              variant="destructive"
              onClick={() => setDialogOpen(true)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restablecer RackNova Local
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Vaciar todos los datos operativos locales?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Se generará un respaldo antes del borrado. Tu cuenta,
                activación y conexión con RackNova Cloud se conservarán.
              </span>
              <span className="block font-semibold text-destructive">
                Cloud no se modifica desde esta acción.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                Escribe exactamente:
              </p>
              <code className="block rounded-lg bg-muted px-3 py-2 text-sm font-bold">
                {requiredConfirmation}
              </code>
              <Input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={requiredConfirmation}
                autoComplete="off"
                disabled={resetting}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">
                Contraseña del propietario
              </p>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                disabled={resetting}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={performReset}
              disabled={
                resetting ||
                confirmation.trim().toUpperCase() !== requiredConfirmation ||
                password.length === 0
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando respaldo...
                </>
              ) : (
                "Crear respaldo y borrar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
