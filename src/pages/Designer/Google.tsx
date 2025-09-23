import React from "react";
// antes: import Google from "./components/Google";
import Google from "@/components/Google";   // ← usa el de src/components

export default function DesignerGoogle() {
  return (
    <div className="flex justify-center p-6">
      <Google
        programName="Distribuidora Alcazarén"
        passTitle="Lealtad Alcazarén"
        infoText="Disfruta un 5% de ahorro en cada compra. Tu lealtad merece un beneficio exclusivo. Aplican restricciones."
        barcodeValue="PK|L00457|blue_5"
        // tierId="blue_5"
        // logoUrl="/logo.png"
        // imageUrl="/banner-blue.jpg"
      />
    </div>
  );
}
