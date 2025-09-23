import React from "react";
import Apple from "@/components/Apple";     // ← usa el de src/components

export default function DesignerApple() {
  return (
    <div className="flex justify-center p-6">
      <Apple
        programName="Distribuidora Alcazarén"
        passTitle="Tarjeta de lealtad tipo premium"
        infoText="Vive la experiencia premium de nuestra tarjeta."
        barcodeValue="${pid}"
        // tierId="gold_15"
        // logoUrl="/logo.png"
        // imageUrl="/banner-gold.jpg"
      />
    </div>
  );
}
