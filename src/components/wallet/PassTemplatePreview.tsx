import React from "react";
import { TIER_THEME, TierId } from "./themes";

type Variant = "google" | "apple";
type Props = {
  variant?: Variant;
  tierId: TierId;
  programName?: string;
  issuerName?: string;
  displayName?: string;
  info?: string;
  pid?: string;
  imageUrl?: string; // banner
  logoUrl?: string;  // logo circular superior
};

export default function PassTemplatePreview({
  variant = "google",
  tierId,
  programName = "Lealtad Alcazarén",
  issuerName  = "Distribuidora Alcazarén",
  displayName = "[displayName]",
  info        = "Disfruta un 5% de ahorro en cada compra. Tu lealtad merece un beneficio exclusivo. ",
  pid         = "${pid}",
  imageUrl,
  logoUrl,
}: Props) {
  const t = TIER_THEME[tierId];
  const isApple = variant === "apple";

  return (
    <div className="rounded-2xl overflow-hidden shadow-md w-[360px] border border-black/5 bg-white">
      <div style={{ backgroundColor: t.bg }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
            {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-white/60" />}
          </div>
          <div className="text-sm" style={{ color: t.text }}>{issuerName}</div>
        </div>

        <div className="px-4 pb-3">
          <div className="text-xl font-semibold" style={{ color: t.text }}>{programName}</div>
        </div>

        <div className="px-4 pb-3 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] uppercase" style={{ color: t.label }}>Name</div>
              <div className="text-[15px]" style={{ color: t.text }}>{displayName}</div>
            </div>
            <span className="w-6 h-6 rounded-md bg-white/10 border border-white/20 flex items-center justify-center text-white/80">+</span>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] uppercase" style={{ color: t.label }}>Information</div>
              <div className="text-[15px] max-w-[260px]" style={{ color: t.text }}>
                {info}<span className="italic">Aplican restricciones.</span>
              </div>
            </div>
            <span className="w-6 h-6 rounded-md bg-white/10 border border-white/20 flex items-center justify-center text-white/80">+</span>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="rounded-xl px-4 py-3" style={{ backgroundColor: t.barcodeBg }}>
            <div
              className="h-[64px] w-full"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg,#000 0,#000 2px,transparent 2px,transparent 4px,#000 4px,#000 5px,transparent 5px,transparent 7px)",
              }}
            />
            {/* Ocultar texto del código debajo del código de barras */}
          </div>
        </div>

        {imageUrl && (
          <div className="px-4 pb-3">
            <div className="h-[120px] w-full rounded-md overflow-hidden">
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        )}
      </div>

      {isApple && (
        <div className="px-4 py-3">
          <div className="text-center text-sm text-gray-700">Tarjeta (vista Apple Wallet)</div>
        </div>
      )}
    </div>
  );
}
