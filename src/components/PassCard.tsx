// src/components/PassCard.tsx
import { useState } from "react";
import { MoreHorizontal, Edit, Copy, QrCode, Trash2 } from "lucide-react";
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
import { Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


const API = import.meta.env.VITE_API_BASE_URL || "/api";

interface PassCardProps {
  pass: Pass;
  onDuplicate?: (pass: Pass) => void;
  onDelete?: (id: string) => void;
}

const PassCard = ({ pass, onDuplicate, onDelete }: PassCardProps) => {
  const [isModalOpen, setModalOpen] = useState(false);

const { toast } = useToast();

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
        client: client,
        campaign: campaign,
        email: email,
        platform: "google", // o "apple" si lo quieres forzar; opcional
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    toast({ title: "Correo enviado", description: `Hemos enviado el pase a ${email}` });
  } catch (e: any) {
    console.error(e);
    toast({ title: "No se pudo enviar", description: String(e?.message || e), variant: "destructive" });
  }
}


  // Si tu pass viene con el member incluido:
 // Soporta member embebido o campos sueltos + nombres con/sin "ñ"
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
  member?.codigoCampaña ??        // ← por si viene con “ñ”
  (pass as any).campaignCode ??
  null;

// URL que resuelve a Apple/Google según el dispositivo
const resolveUrl =
  client && campaign
    ? `${API}/wallet/resolve?client=${encodeURIComponent(client)}&campaign=${encodeURIComponent(campaign)}&source=link`
    : "";


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
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="font-semibold text-lg text-gray-900">
                  {pass.title}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {pass.type}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {pass.description}
              </p>
              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                <span>Created: {pass.createdAt}</span>
                <span>Scans: {(pass as any).scans ?? 0}</span>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    /* editar */
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate?.(pass);
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" /> Duplicate
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalOpen(true);
                  }}
                >
                  <QrCode className="w-4 h-4 mr-2" /> QR Code
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (
                      window.confirm(
                        "¿Eliminar este pase? Esta acción no se puede deshacer."
                      )
                    ) {
                      onDelete?.(pass.id);
                    }
                  }}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: pass.backgroundColor || "#007AFF" }}
              />
              <Badge className={getStatusColor(pass.status || "active")}>
                {pass.status || "active"}
              </Badge>
            </div>

            <div className="flex space-x-2 items-center">
            <AddToWalletButton
              resolveUrl={resolveUrl}
              memberId={memberId}
              passId={pass.id}
              className="min-w-[180px]"
            />

            <Button variant="outline" size="sm" onClick={handleSendByEmail}>
              <Mail className="w-4 h-4 mr-2" />
              Enviar por email
            </Button>

            {!resolveUrl && (
              <span className="text-xs text-muted-foreground">Falta cliente/campaña</span>
            )}
          </div>

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
