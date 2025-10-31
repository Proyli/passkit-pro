// src/components/modals/QrCodeModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import JsBarcode from "jsbarcode";
import { api } from "@/lib/api";
//import Code128Pane from "@/components/Code128Pane";


type PassType = "coupon" | "event" | "loyalty";
type PassStatus = "active" | "inactive" | "expired";

interface Pass {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  estado: PassStatus;
  type: PassType;
}

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  passData: Pass;
  clientCode?: string;
  campaignCode?: string;
  defaultMode?: "qr" | "code128";
  externalId?: string;
}

// Genera el payload simple "PK|cliente|campaña" para Code128
const buildPayload = (clientCode: string, campaignCode: string) =>
  `PK|${clientCode}|${campaignCode}`;

const makeSvgResponsive = (svg: SVGSVGElement) => {
  const bbox = svg.getBBox();
  svg.setAttribute("viewBox", `0 0 ${bbox.width} ${bbox.height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
};

export function QrCodeModal({
  isOpen,
  onClose,
  passData,
  clientCode: clientCodeProp = "",
  campaignCode: campaignCodeProp = "",
  defaultMode = "code128",
  externalId: externalIdProp = "",
}: QrCodeModalProps) {
  const [mode, setMode] = useState<"qr" | "code128">(defaultMode);
  const [clientCode, setClientCode] = useState(clientCodeProp);
  const [campaignCode, setCampaignCode] = useState(campaignCodeProp);
  const [externalId, setExternalId] = useState<string>(externalIdProp || "");

 const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
const qrWrapperRef = useRef<HTMLDivElement | null>(null); // ⬅️ nuevo
// arriba del componente
const barcodeBoxRef = useRef<HTMLDivElement | null>(null);


  // Sincroniza con props cuando cambian
  useEffect(() => {
    setClientCode(clientCodeProp);
    setCampaignCode(campaignCodeProp);
    setExternalId(externalIdProp || "");
  }, [clientCodeProp, campaignCodeProp, externalIdProp]);

  // Base del backend desde el cliente centralizado
  const API_BASE = (api.defaults.baseURL || '').replace(/\/$/, '') + '/api';

  // URL que debe contener el QR para resolver en backend y entregar Apple/Google Wallet
  const walletUrl = useMemo(() => {
    // Wallet resolve should always receive client+campaign so backend can map to externalId
    const params = new URLSearchParams();
    params.set("client", clientCode.trim());
    params.set("campaign", campaignCode.trim());
    if (externalId) params.set("externalId", externalId.trim());
    return `${API_BASE}/wallet/resolve?${params.toString()}`;
  }, [clientCode, campaignCode, API_BASE, externalId]);

  // Payload para barcode (opción Code128) — formato pedido: CLIENT-CAMPAIGN (ej L0083-CP0163)
  const payload = useMemo(() => {
    const c = clientCode.trim();
    const k = campaignCode.trim();
    if (!c && !k) return "";
    // si ambos existen, los unimos con guion; si falta uno, devolvemos el existente
    if (c && k) return `${c}-${k}`;
    return c || k;
  }, [clientCode, campaignCode]);

  // Valor final que se pinta: QR usa walletUrl; Code128 usa payload
  const valueToRender = mode === "qr" ? walletUrl : payload;

   useEffect(() => {
  if (mode !== "code128" || !barcodeSvgRef.current) return;
  const svg = barcodeSvgRef.current;

  // Calcula un width “óptimo” en px por módulo según el ancho del contenedor
  let moduleWidth = 1.4; // fallback
  try {
    const boxW = barcodeBoxRef.current?.clientWidth ?? 320;

    // Estimación rápida de módulos totales en Code128:
    // 11 módulos por símbolo + start/stop/check (≈ 35 módulos),
    // y un pequeño quiet zone relativo
    const totalModules = 11 * (valueToRender?.length ?? 0) + 35;
    const computed = Math.floor((boxW * 0.95) / totalModules);

    // límites razonables para scannear bien
    moduleWidth = Math.max(1, Math.min(2, computed));
  } catch {}

  try {
    JsBarcode(svg, valueToRender || "-", {
      format: "CODE128",
      displayValue: false,
      lineColor: "#111",
      height: 82,   // puedes ajustar 76–86
      margin: 0,    // sin bordes extra (el wrapper ya controla el layout)
      width: moduleWidth,
    });

    // que el SVG sea responsive dentro del wrapper
    makeSvgResponsive(svg);
  } catch (e) {
    console.error("JsBarcode error:", e);
  }
}, [mode, valueToRender]);


  const downloadSvgAsPng = (svg: SVGElement, name: string, size = 640) => {
    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(svg);
    const img = new Image();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      ctx?.clearRect(0, 0, size, size);
      const targetH = mode === "code128" ? size * 0.45 : size;
      const y = mode === "code128" ? (size - targetH) / 2 : 0;
      ctx?.drawImage(img, 0, y, size, targetH);
      const link = document.createElement("a");
      link.download = `${name}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleDownload = () => {
    if (mode === "qr") {
      const svg = qrWrapperRef.current?.querySelector("svg");
      if (svg)
        downloadSvgAsPng(svg, `qr-${passData.title.replace(/\s+/g, "-").toLowerCase()}`, 512);
    } else if (barcodeSvgRef.current) {
      downloadSvgAsPng(
        barcodeSvgRef.current,
        `code128-${passData.title.replace(/\s+/g, "-").toLowerCase()}`,
        640
      );
    }
  };

  const isReady = clientCode.trim() !== "" && campaignCode.trim() !== "";

  return (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle>Código para Wallet</DialogTitle>
      </DialogHeader>

      {/* Toggle QR / Code128 */}
      <div className="flex items-center gap-2 mb-3">
        <Button
          size="sm"
          variant={mode === "qr" ? "default" : "outline"}
          onClick={() => setMode("qr")}
        >
          QR
        </Button>
        <Button
          size="sm"
          variant={mode === "code128" ? "default" : "outline"}
          onClick={() => setMode("code128")}
        >
          Code128
        </Button>
      </div>

      {/* Inputs (editable por si abres sin pasar códigos) */}
      <div className="grid grid-cols-1 gap-3 mb-1">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Código Cliente
          </label>
          <input
            className="w-full border rounded-md px-3 py-2"
            value={clientCode}
            onChange={(e) => setClientCode(e.target.value)}
            placeholder="L0003"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Código Campaña
          </label>
          <input
            className="w-full border rounded-md px-3 py-2"
            value={campaignCode}
            onChange={(e) => setCampaignCode(e.target.value)}
            placeholder="C3214"
          />
        </div>
      </div>

      {/* Vista del código */}
      <div className="flex justify-center p-4 bg-white rounded-md border min-h-[240px]">
      {!isReady ? (
  <p className="text-sm text-muted-foreground self-center">
    Ingresa ambos códigos para generar el {mode === "qr" ? "QR" : "Code128"}.
  </p>
) : mode === "qr" ? (
  // El QR ahora apunta a tu backend /wallet/resolve
  <div ref={qrWrapperRef}>                     {/* ⬅️ ref al contenedor */}
    <QRCodeSVG value={walletUrl} size={224} level="M" />
  </div>
) : (
  // Code128 con payload "PK|cliente|campaña"
   <div className="w-full max-w-[320px] overflow-hidden">
    <svg ref={barcodeSvgRef} className="w-full h-auto block" />
  </div>
)}

      </div>

      {/* Cadena mostrada debajo (útil para debug/copiar) */}
      <div className="mt-3 text-xs text-muted-foreground break-all">
        {isReady ? (mode === "qr" ? walletUrl : payload) : "—"}
      </div>

      {/* Códigos en claro */}
      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
        <div>
          <span className="text-muted-foreground">External ID:</span>{" "}
          <span className="font-mono">{externalId || "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Campaña:</span>{" "}
          <span className="font-mono">{campaignCode || "—"}</span>
        </div>
      </div>

      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={handleDownload} disabled={!isReady}>
          Descargar PNG
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
}
