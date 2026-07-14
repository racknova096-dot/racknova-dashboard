import React from "react";
import { Loader2 } from "lucide-react";

interface BlockingLoaderProps {
  show: boolean;
  title?: string;
  description?: string;
}

export function BlockingLoader({
  show,
  title = "Cargando...",
  description = "Espera un momento.",
}: BlockingLoaderProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/75 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border bg-background p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>

        <h2 className="text-lg font-bold">{title}</h2>

        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
