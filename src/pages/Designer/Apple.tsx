// src/pages/Designer/Apple.tsx
import React from "react";
import AppleCard from "@/components/Apple"; // 👈 usa el componente compartido de src/components

export default function DesignerApple() {
  return (
    <div className="flex justify-center p-6">
      <AppleCard
        programName="Distribuidora Alcazarén"
        passTitle="Tarjeta de lealtad tipo premium"
        infoText="Vive la experiencia premium de nuestra tarjeta."
        barcodeValue="PK|L00457|gold_15" // ejemplo: cámbialo por lo que necesites
        // tierId="gold_15"
        // logoUrl="/logo.png"
        // imageUrl="/banner-gold.jpg"
      />
    </div>
  );
}
