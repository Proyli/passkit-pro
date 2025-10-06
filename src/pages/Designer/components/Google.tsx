// src/pages/Designer/components/Google.tsx
import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

type Props = {
  programName?: string;     // header arriba
  passTitle?: string;       // título grande
  infoText?: string;        // párrafo de beneficios
  logoUrl?: string;         // logo circular
  bannerUrl?: string;       // imagen inferior
  barcodeValue?: string;    // ej: "PK|L00457|blue_5"
  showPid?: boolean;        // muestra ${pid} debajo
  externalId?: string;      // opcional: mostrar externalId debajo del barcode
};

const makeSvgResponsive = (svg: SVGSVGElement) => {
  const bbox = svg.getBBox();
  svg.setAttribute("viewBox", `0 0 ${bbox.width} ${bbox.height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
};

export default function Google({
  programName = "Distribuidora Alcazarén",
  passTitle = "Lealtad Alcazarén",
  infoText = "Disfruta un 5% de ahorro en cada compra. Tu lealtad merece un beneficio exclusivo. Aplican restricciones.",
  logoUrl = "https://raw.githubusercontent.com/Proyli/wallet-assets/main/program-logo.png",
  bannerUrl = "https://raw.githubusercontent.com/Proyli/wallet-assets/main/hero-celebremos.jpg",
  barcodeValue = "PK|L00457|blue_5",
  showPid = true,
  externalId,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;

    // Render del Code128 (barras nítidas y contenidas)
    JsBarcode(svg, barcodeValue, {
      format: "CODE128",
      displayValue: false,
      lineColor: "#111",
      height: 72,
      margin: 0,
      width: 1.4, // ajusta 1.2–1.8 si lo quieres más fino/grueso
    });
    makeSvgResponsive(svg);
  }, [barcodeValue]);

  return (
    <div className="w-[360px] rounded-[28px] bg-[#0b1626] text-white shadow-2xl overflow-hidden">
      {/* Header con logo y nombre del programa */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <img src={logoUrl} className="h-8 w-8 rounded-full ring-1 ring-white/20" alt="logo" />
        <div className="text-sm opacity-90">{programName}</div>
      </div>

      {/* Título */}
      <div className="px-4 pb-1">
        <div className="text-[22px] font-semibold tracking-wide">{passTitle}</div>
      </div>

      {/* Campo Name (placeholder) */}
      <div className="px-4 py-3 border-y border-white/10">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[13px] opacity-70">Name</div>
            <div className="text-[15px] font-medium">[displayName]</div>
          </div>
          <div className="text-xl leading-none opacity-70 select-none">+</div>
        </div>
      </div>

      {/* Información */}
      <div className="px-4 py-3">
        <div className="text-[13px] opacity-70">Information</div>
        <p className="text-[14px] leading-5 mt-1 opacity-95">{infoText}</p>
      </div>

      {/* Acción extra (+) */}
      <div className="px-4 pb-2">
        <div className="text-xl leading-none opacity-70 select-none">+</div>
      </div>

      {/* Código de barras con borde degradado */}
      <div className="px-4 pb-4">
        <div className="p-[6px] rounded-2xl bg-gradient-to-r from-fuchsia-500 via-orange-400 to-yellow-300">
          <div className="rounded-xl bg-white p-3 flex items-center justify-center">
            <svg ref={svgRef} className="w-full h-auto block" />
          </div>
        </div>
        {showPid && (
          <div className="text-center text-xs mt-1 opacity-80">{externalId ? externalId : "${{pid}}"}</div>
        )}
      </div>

      {/* Imagen inferior */}
      <div className="h-[98px]">
        <img src={bannerUrl} alt="banner" className="w-full h-full object-cover" />
      </div>
    </div>
  );
}
