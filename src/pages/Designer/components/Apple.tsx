// src/pages/Designer/components/Apple.tsx
import React from "react";

export default function Apple() {
  return (
    <div className="w-[360px] rounded-[28px] bg-black text-white shadow-2xl overflow-hidden">
      <div className="p-4 text-sm opacity-90">Distribuidora Alcazarén</div>
      <div className="px-4 text-[22px] font-semibold">Lealtad Alcazarén (Apple)</div>
      <div className="p-4 text-sm opacity-80">
        Vista previa estilo Apple Wallet. (Aquí puedes renderizar tu QR/Code128 cuando quieras).
      </div>
      <div className="p-4">
        <div className="rounded-xl bg-white text-black p-6 text-center">
          Código (pendiente)
        </div>
      </div>
    </div>
  );
}
