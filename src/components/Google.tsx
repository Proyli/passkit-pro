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

export default function Google({
  programName = "Distribuidora Alcazarén",
  passTitle = "Lealtad Alcazarén",
  infoText = "Disfruta un 5% de ahorro en cada compra. Tu lealtad merece un beneficio exclusivo.",
  barcodeValue = "${pid}",
  logoUrl,
  imageUrl,
  tierId = "blue_5",
}: Props) {
  return (
    <PassTemplatePreview
      variant="google"
      tierId={tierId}
      issuerName={programName}   // arriba pequeño
      programName={passTitle}    // título grande
      displayName="[displayName]"
      info={infoText}
      pid={barcodeValue}
      logoUrl={logoUrl}
      imageUrl={imageUrl}
    />
  );
}
