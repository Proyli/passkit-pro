// ... imports
import { MoreHorizontal, Edit, Copy, QrCode, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useState } from "react";
import { PassModal } from "./ui/PassModal";
import { Pass } from "@/types/pass.types";
import AddToWalletButton from "@/components/wallet/AddToWalletButton";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

function MiSeccionDeWallet({ member, pass }: { member: any; pass: any }) {
  const client = member?.codigoCliente;   // ajusta a tu campo real
  const campaign = member?.codigoCampana; // ajusta a tu campo real

  // Usa tu resolver (redirige a Google o Apple automáticamente según user-agent/plataforma)
  const resolveUrl = `${API}/wallet/resolve?client=${encodeURIComponent(client)}&campaign=${encodeURIComponent(campaign)}&source=link`;

return (
    <div className="flex gap-3">
      {/* Si quieras forzar el label, usa platform="google" o "apple"; el resolver decide igual */}
      <AddToWalletButton
        platform="google"
        memberId={member?.id ?? null}
        passId={pass?.id ?? null}
        resolveUrl={resolveUrl}
      />
      {/* También puedes renderizar otro botón para Apple si quieres diferenciar visualmente */}
      <AddToWalletButton
        platform="apple"
        memberId={member?.id ?? null}
        passId={pass?.id ?? null}
        resolveUrl={resolveUrl}
      >
        Add to Apple Wallet
      </AddToWalletButton>
    </div>
  );
}

interface PassCardProps {
  pass: Pass;
  onDuplicate?: (pass: Pass) => void;
  onDelete?: (id: string) => void;   // 👈 NUEVO
}

const PassCard = ({ pass, onDuplicate, onDelete }: PassCardProps) => {
  const [isModalOpen, setModalOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <Card className="glass-effect border-white/20 hover:shadow-lg transition-all duration-300 animate-fade-in group">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="font-semibold text-lg text-gray-900">{pass.title}</h3>
                <Badge variant="secondary" className="text-xs">{pass.type}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{pass.description}</p>
              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                <span>Created: {pass.createdAt}</span>
                <span>Scans: {pass.scans}</span>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); /* editar */ }}>
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>

                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate?.(pass); }}>
                  <Copy className="w-4 h-4 mr-2" /> Duplicate
                </DropdownMenuItem>

                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}>
                  <QrCode className="w-4 h-4 mr-2" /> QR Code
                </DropdownMenuItem>

                {/* ✅ Delete que sí dispara */}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.confirm("¿Eliminar este pase? Esta acción no se puede deshacer.")) {
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
                style={{ backgroundColor: pass.backgroundColor || '#007AFF' }}
              />
              <Badge className={getStatusColor(pass.status || 'active')}>
                {pass.status || 'active'}
              </Badge>
            </div>

            <div className="flex space-x-2">
              <Button type="button" variant="outline" size="sm">Apple Wallet</Button>
              <Button type="button" variant="outline" size="sm">Google Pay</Button>
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
            backgroundColor: pass.backgroundColor || '#007AFF',
            textColor: pass.textColor || '#FFFFFF',
            type: pass.type,
            fields: pass.fields || {}
          }}
        />
      )}
    </>
  );
};

export default PassCard;
