import Catalogo from "./Catalogo";
import { CatalogoImagenesPanel } from "@/components/catalog/CatalogoImagenesPanel";

export default function CatalogoApp() {
  return (
    <div className="space-y-8">
      <Catalogo />
      <CatalogoImagenesPanel />
    </div>
  );
}
