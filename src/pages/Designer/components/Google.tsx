// src/pages/Designer/components/Google.tsx
import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

type Props = {
  programName?: string;     // header arriba
  passTitle?: string;       // título grande
  infoText?: string;        // párrafo de beneficios
  logoUrl?: string;         // logo circular
  bannerUrl?: string;       // imagen inferior opcional
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
  infoText,
  logoUrl = "https://raw.githubusercontent.com/Proyli/wallet-assets/main/program-logo.png",
  bannerUrl = "/0S2A8207.png",
  barcodeValue = "PK|L00457|blue_5",
  showPid = false,
  externalId,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;

    JsBarcode(svg, barcodeValue, {
      format: "CODE128",
      displayValue: false,
      lineColor: "#111",
      height: 72,
      margin: 0,
      width: 1.4,
    });
    makeSvgResponsive(svg);
  }, [barcodeValue]);

  const fallbackInfo = barcodeValue.includes("gold")
    ? "Disfruta un 15% de ahorro en cada compra. Tu lealtad merece un beneficio dorado."
    : "Disfruta un 5% de ahorro en cada compra. Tu lealtad merece un beneficio exclusivo.";
  const resolvedInfo = infoText ?? fallbackInfo;

  const isGold = /gold|_15|15%|\bg15\b/i.test(String(barcodeValue));
  const bgColor = isGold ? "#b27740" : "#0b1626"; // gold vs blue

  return (
    <div className="w-[360px] mx-auto rounded-[28px] text-white shadow-2xl overflow-hidden" style={{ backgroundColor: bgColor }}>
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <img src={logoUrl} className="h-8 w-8 rounded-full ring-1 ring-white/20" alt="logo" />
        <div className="text-sm opacity-90">{programName}</div>
      </div>

      <div className="px-4 pb-1 text-center">
        <div className="text-[22px] font-semibold tracking-wide">{passTitle}</div>
      </div>

      <div className="px-4 py-3 border-y border-white/10">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[13px] opacity-70">Name</div>
            <div className="text-[15px] font-medium">[displayName]</div>
          </div>
          <div className="text-xl leading-none opacity-70 select-none">+</div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="text-[13px] opacity-70">Information</div>
        <p className="text-[14px] leading-5 mt-2 opacity-95 text-justify">{resolvedInfo}</p>
      </div>

      <div className="px-4 pb-3 text-center">
        <div className="text-xl leading-none opacity-70 select-none">+</div>
      </div>

      <div className="px-6 pb-4">
        <div className="p-[6px] rounded-2xl bg-gradient-to-r from-fuchsia-500 via-orange-400 to-yellow-300">
          <div className="rounded-xl bg-white p-3 flex items-center justify-center">
            <svg ref={svgRef} className="w-full h-auto block" />
          </div>
        </div>
        {showPid && (
          <div className="text-center text-xs mt-1 opacity-80">{externalId ? externalId : "${pid}"}</div>
        )}
      </div>

      {bannerUrl ? (
        <div className="h-[98px]">
          <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="pb-6 text-center text-[13px] opacity-75">Celebremos tus beneficios juntos</div>
      )}
    </div>
  );
}
