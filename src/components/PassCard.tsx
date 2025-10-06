// src/components/PassCard.tsx
import { useState } from "react";
import { MoreHorizontal, Edit, Copy, QrCode, Trash2, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { PassModal } from "./ui/PassModal";
import { Pass } from "@/types/pass.types";
import AddToWalletButton from "@/components/wallet/AddToWalletButton";
import { useToast } from "@/hooks/use-toast";
import { can } from "@/lib/authz";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

interface PassCardProps {
  pass: Pass;
  onDuplicate?: (pass: Pass) => void;
  onDelete?: (id: string) => void;
  /** Modo compacto para usar en Dashboard (p-4, textos sm, botones sm) */
  compact?: boolean;
}

const PassCard = ({ pass, onDuplicate, onDelete, compact = false }: PassCardProps) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();

  // Si tu pass viene con el member incluido:
  const member: any = (pass as any).member ?? null;

  const memberId =
    member?.id ??
    (pass as any).member_id ??
    null;

  const client =
    member?.codigoCliente ??
    (pass as any).clientCode ??
    null;

  const campaign =
    member?.codigoCampana ??
    member?.codigoCampaña ?? // por si viene con “ñ”
    (pass as any).campaignCode ??
    null;

  // URL que resuelve Apple/Google según dispositivo
  const resolveUrl =
    client && campaign
      ? `${API}/wallet/resolve?client=${encodeURIComponent(client)}&campaign=${encodeURIComponent(
          campaign
        )}&source=link`
      : "";

  async function handleSendByEmail() {
    if (!resolveUrl) {
      toast({ title: "Falta cliente/campaña", variant: "destructive" });
      return;
    }
    const email = window.prompt("Enviar pase a (correo):");
    if (!email) return;

    try {
      const res = await fetch(`${API}/wallet/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client,
          campaign,
          email,
          platform: "google", // o "apple"
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      toast({ title: "Correo enviado", description: `Hemos enviado el pase a ${email}` });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "No se pudo enviar",
        description: String(e?.message || e),
        variant: "destructive",
      });
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      case "expired":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <Card className="glass-effect border-white/20 hover:shadow-lg transition-all duration-300 animate-fade-in group">
        <CardContent className={compact ? "p-4" : "p-6"}>
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className={`font-semibold ${compact ? "text-base" : "text-lg"} text-gray-900 truncate`}>
                  {pass.title}
                </h3>
                <Badge variant="secondary" className="text-xs capitalize">
                  {pass.type}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {pass.description || "Información del cliente"}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                <span>Created: {pass.createdAt}</span>
                <span>Scans: {(pass as any).scans ?? 0}</span>
              </div>
            </div>

            <DropdownMenu>
              {(can.editMember() || can.deleteMember() || onDuplicate) && (
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`transition-opacity ${compact ? "" : "opacity-0 group-hover:opacity-100"} h-8 w-8 ml-2`}
                    aria-label="Acciones"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              )}

              <DropdownMenuContent align="end">
              {can.editMember() && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    /* editar */
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>
              )}

              {onDuplicate && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(pass);
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" /> Duplicate
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setModalOpen(true);
                }}
              >
                <QrCode className="w-4 h-4 mr-2" /> QR Code
              </DropdownMenuItem>

              {can.deleteMember() && onDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.confirm("¿Eliminar este pase? Esta acción no se puede deshacer.")) {
                      onDelete(pass.id);
                    }
                  }}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>

            </DropdownMenu>
          </div>

          {/* Estado + Acciones (responsivo, sin desbordes) */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Estado */}
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                style={{
                  backgroundColor: (function(){
                    if (pass.backgroundColor) return pass.backgroundColor;
                    const member = (pass as any).member || {};
                    const tier = String(member.tipoCliente || member.tier || pass.tipoCliente || "").toLowerCase();
                    const campaign = String(member.codigoCampana || member.codigoCampaña || (pass as any).campaignCode || "").toLowerCase();
                    const probe = (tier + " " + campaign).trim();
                    if (/gold/.test(probe)) return '#DAA520';
                    if (/silver/.test(probe)) return '#9CA3AF';
                    if (/bronze|bronce/.test(probe)) return '#CD7F32';
                    if (/\b15\b|15%|_15|15\D|\b15\z/.test(probe)) return '#DAA520';
                    if (/\b5\b|5%|_5|\b05\b/.test(probe)) return '#2350C6';
                    return '#007AFF';
                  })()
                }}
              />
              <Badge className={`${compact ? "text-xs px-2.5 py-1" : ""} ${getStatusColor(pass.status || "active")}`}>
                {pass.status || "active"}
              </Badge>
            </div>

            {/* Botones */}
            <div className="ml-auto flex items-center gap-2">
              <AddToWalletButton
                resolveUrl={resolveUrl}
                memberId={memberId}
                passId={pass.id}
                size="sm"
                className="h-9 px-3 rounded-xl min-w-[128px] max-w-full"
                defaultLabel="Guardar"     // etiqueta más corta
                appleLabel="Añadir"
                googleLabel="Guardar"
              />

              <Button
                variant="outline"
                size="sm"
                onClick={handleSendByEmail}
                className="h-9 px-3 rounded-xl shrink-0"
                title="Enviar por email"
              >
                <Mail className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Enviar por email</span>
                <span className="sm:hidden">Email</span>
              </Button>
            </div>

            {/* Nota en línea completa si falta info */}
            {!resolveUrl && (
              <span className="w-full text-xs text-muted-foreground">
                Falta cliente/campaña
              </span>
            )}
          </div>

        </CardContent>
      </Card>

      {isModalOpen && (
        <PassModal
          open={isModalOpen}
          onOpenChange={setModalOpen}
          passData={{
            title: pass.title,
            description: pass.description,
            backgroundColor: pass.backgroundColor || "#007AFF",
            textColor: pass.textColor || "#FFFFFF",
            type: pass.type,
            fields: (pass as any).fields || {},
          }}
        />
      )}
    </>
  );
};

export default PassCard;
