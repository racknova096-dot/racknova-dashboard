import Configuracion from "./Configuracion";
import { PwaInstallCard } from "@/components/pwa/PwaInstallCard";

export default function ConfiguracionApp() {
  return (
    <div className="space-y-6">
      <Configuracion />
      <PwaInstallCard />
    </div>
  );
}
