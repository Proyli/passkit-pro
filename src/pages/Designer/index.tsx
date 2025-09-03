// src/pages/Designer/index.tsx
import Google from "./components/Google";


export default function DesignerPage() {
  return (
    <div className="flex gap-6">
      {/* Columna izquierda: preview */}
      <div className="flex-1 flex justify-center">
        <Google
          programName="Distribuidora Alcazarén"
          passTitle="Lealtad Alcazarén"
          infoText="Disfruta un 5% de ahorro en cada compra. Tu lealtad merece un beneficio exclusivo. Aplican restricciones."
          // barcodeValue se puede alimentar desde tu estado si ya lo generas:
          barcodeValue="PK|L00457|blue_5"
        />
      </div>

      {/* Columna derecha: propiedades (lo que ya tengas) */}
      <aside className="w-[360px]">
        {/* tus controles */}
      </aside>
    </div>
  );
}
