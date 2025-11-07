import PassTemplatePreview from "@/components/wallet/PassTemplatePreview";
import type { TierId } from "@/components/wallet/themes";

type Props = {
  /** Emisor (arriba a la izquierda). Ej: "Distribuidora Alcazarén" */
  programName?: string;
  /** Título del programa (grande). Ej: "Lealtad Alcazarén" */
  passTitle?: string;
  /** Texto de Information */
  infoText?: string;
  /** Valor impreso bajo el código (usa ${pid} si quieres placeholder) */
  barcodeValue?: string;
  /** Opcionales: logo y banner */
  logoUrl?: string;
  imageUrl?: string;
  /** Tier visual: "blue_5" | "gold_15" */
  tierId?: TierId;
};

const FALLBACK_INFO: Record<TierId, string> = {
  blue_5: "Disfruta un 5% de ahorro en cada compra. Tu lealtad merece un beneficio exclusivo.",
  gold_15: "Disfruta un 15% de ahorro en cada compra. Tu lealtad merece un beneficio dorado.",
};

export default function Google({
  programName = "Distribuidora Alcazarén",
  passTitle = "Lealtad Alcazarén",
  infoText,
  barcodeValue = "${pid}",
  logoUrl,
  imageUrl = "/0S2A8207.png",
  tierId,
}: Props) {
  // Detecta el tier si no viene explícito (busca 'gold' o 'blue' en el payload)
  const detectedTier: TierId = (() => {
    if (tierId) return tierId;
    const p = String(barcodeValue).toLowerCase();
    if (/gold|_15|15%|\bg15\b/.test(p)) return "gold_15";
    return "blue_5";
  })();

  const resolvedInfo = infoText ?? FALLBACK_INFO[detectedTier];

  return (
    <PassTemplatePreview
      variant="google"
      tierId={detectedTier}
      issuerName={programName}
      programName={passTitle}
      displayName="[displayName]"
      info={resolvedInfo}
      pid={barcodeValue}
      logoUrl={logoUrl}
      imageUrl={imageUrl}
    />
  );
}
