// src/components/modals/QrCodeModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import JsBarcode from "jsbarcode";

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
}

// Genera el payload simple "PK|cliente|campaña" para Code128
const buildPayload = (clientCode: string, campaignCode: string) =>
  `PK|${clientCode}|${campaignCode}`;

export function QrCodeModal({
  isOpen,
  onClose,
  passData,
  clientCode: clientCodeProp = "",
  campaignCode: campaignCodeProp = "",
  defaultMode = "code128",
}: QrCodeModalProps) {
  const [mode, setMode] = useState<"qr" | "code128">(defaultMode);
  const [clientCode, setClientCode] = useState(clientCodeProp);
  const [campaignCode, setCampaignCode] = useState(campaignCodeProp);

 const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
const qrWrapperRef = useRef<HTMLDivElement | null>(null); // ⬅️ nuevo


  // Sincroniza con props cuando cambian
  useEffect(() => {
    setClientCode(clientCodeProp);
    setCampaignCode(campaignCodeProp);
  }, [clientCodeProp, campaignCodeProp]);

  // Base robusta de API (.env si existe; si no, el mismo host con :3900/api)
  const API_BASE =
    (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
    `${window.location.protocol}//${window.location.hostname}:3900/api`;

  // URL que debe contener el QR para resolver en backend y entregar Apple/Google Wallet
  const walletUrl = useMemo(() => {
    const c = encodeURIComponent(clientCode.trim());
    const k = encodeURIComponent(campaignCode.trim());
    return `${API_BASE}/wallet/resolve?client=${c}&campaign=${k}`;
  }, [clientCode, campaignCode, API_BASE]);

  // Payload para barcode (opción Code128)
  const payload = useMemo(
    () => buildPayload(clientCode.trim(), campaignCode.trim()),
    [clientCode, campaignCode]
  );

  // Valor final que se pinta: QR usa walletUrl; Code128 usa payload
  const valueToRender = mode === "qr" ? walletUrl : payload;

  // Pinta el Code128 cuando corresponde
  useEffect(() => {
    if (mode !== "code128" || !barcodeSvgRef.current) return;
    try {
      JsBarcode(barcodeSvgRef.current, valueToRender || "-", {
        format: "CODE128",
        displayValue: false, // sin texto debajo
        lineColor: "#111",
        height: 84,
        margin: 8,
      });
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
  <svg ref={barcodeSvgRef} />
)}

      </div>

      {/* Cadena mostrada debajo (útil para debug/copiar) */}
      <div className="mt-3 text-xs text-muted-foreground break-all">
        {isReady ? (mode === "qr" ? walletUrl : payload) : "—"}
      </div>

      {/* Códigos en claro */}
      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
        <div>
          <span className="text-muted-foreground">Cliente:</span>{" "}
          <span className="font-mono">{clientCode || "—"}</span>
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
