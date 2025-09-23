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
  imageUrl,
  tierId = "gold_15",
}: Props) {
  return (
    <PassTemplatePreview
      variant="apple"
      tierId={tierId}
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
