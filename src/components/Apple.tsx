import PassTemplatePreview from "@/components/wallet/PassTemplatePreview";
import type { TierId } from "@/components/wallet/themes";

type Props = {
  programName?: string;
  passTitle?: string;
  infoText?: string;
  barcodeValue?: string;
  logoUrl?: string;
  imageUrl?: string;
  tierId?: TierId; // "gold_15" | "blue_5"
};

export default function Apple({
  programName = "Distribuidora Alcazarén",
  passTitle   = "Tarjeta de lealtad tipo premium",
  infoText    = "Vive la experiencia premium de nuestra tarjeta.",
  barcodeValue = "${pid}",
  logoUrl,
  imageUrl = "/0S2A8207.png",
  tierId,
}: Props) {
  const detectedTier: TierId = (() => {
    if (tierId) return tierId;
    const p = String(barcodeValue).toLowerCase();
    if (/gold|_15|15%|\bg15\b/.test(p)) return "gold_15";
    return "blue_5";
  })();
  return (
    <PassTemplatePreview
      variant="apple"
      tierId={detectedTier}
      issuerName={programName}  // arriba pequeño
      programName={passTitle}   // título grande
      displayName="[displayName]"
      info={infoText}
      pid={barcodeValue}
      logoUrl={logoUrl}
      imageUrl={imageUrl}
    />
  );
}
