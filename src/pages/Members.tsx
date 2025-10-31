
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, useLocation } from "react-router-dom"; // Importar useLocation
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Edit3, Link, Plus, Upload, Download, Columns3, Trash2 } from "lucide-react";
import { can } from "@/lib/authz";
// Se eliminan los imports de Table, TableBody, TableCell, TableHead, TableHeader, TableRow
// porque estás usando directamente elementos <table>, <thead>, etc.
import { useToast } from "@/hooks/use-toast";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MembersService, Member, NewMember, UpdateMember } from "@/services/membersService";
import { CardsService } from "@/services/cardsService";
import { CsvService } from "@/services/csvService";
type UIPass = { id: string; title: string; type?: string };

import { QrCodeModal } from "@/components/modals/QrCodeModal";
import { api } from "@/lib/api";
import { QrCode } from "lucide-react";


// === Config de columnas (4 por defecto) ===
const COLUMN_KEYS = [
  "id",
  "externalId",
  "firstName",
  "lastName",
  "email",
  "mobile",
  "tier",
  "gender",
  "points",
  "dateOfBirth",
  "clientCode",
  "campaignCode",
] as const;

type ColumnKey = typeof COLUMN_KEYS[number];

const DEFAULT_VISIBLE: Record<ColumnKey, boolean> = {
  id: true,
  externalId: true,
  firstName: true,
  lastName: true,

  email: false,
  mobile: false,
  tier: true,
  gender: false,
  points: false,
  dateOfBirth: false,
  clientCode: false,
  campaignCode: false,
};

// Si NO tienes ya un formatLabel, añade este:
const formatLabel = (k: ColumnKey) =>
  ({
    id: "Passkit ID",
    externalId: "External ID",
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    mobile: "Phone",
    tier: "Tier",
    gender: "Gender",
    points: "Points",
    dateOfBirth: "Birthdate",
    clientCode: "Client Code",
    campaignCode: "Campaign Code",
  }[k]);


// Client HTTP centralizado: usar `api` con rutas `/api/...`

// ==== Tipos del backend (ES) ====
type BackendMember = {
  id: number | string;
  external_id?: string;
  externalId?: string;
  idExterno?: string;
  nombre?: string;
  apellido?: string;
  fechaNacimiento?: string;
  codigoCliente?: string;
 // codigoCampaña?: string;   // con tilde
  codigoCampana?: string;   // sin tilde, por si acaso
  tipoCliente?: string;
  email?: string;
  telefono?: string;
  genero?: string;
  puntos?: number | string;
  fechaCreacion?: string;
  fechaExpiracion?: string;
};

// ==== Tipo que usa tu tabla (EN) ====
type UIMember = {
  id: number;
  externalId: string;
  firstName: string;
  lastName?: string;
  email: string;
  mobile?: string;
  tier: string;
  gender?: string;
  points: number;
  dateOfBirth?: string;
  clientCode: string;
  campaignCode: string;
  createdAt?: string;
  expiryDate?: string;
};

// Utilidad para elegir el primer valor “válido”
const pick = (...vals: any[]) =>
  vals.find(v => v !== undefined && v !== null && v !== "") ?? "";

// Adaptador ES/EN → columnas de la tabla
const adaptMember = (m: any): UIMember => ({
  id: Number(pick(m.id, m.memberId, m.passkitId, 0)),
  externalId: pick(m.external_id, m.externalId, m.externalID, m.idExterno, m.external),
  firstName: pick(m.nombre, m.firstName, m.first_name, m.name, m.givenName),
  lastName: pick(m.apellido, m.lastName, m.last_name, m.surname, m.familyName),
  email: pick(m.email, m.correo, m.mail),
  mobile: pick(m.telefono, m.mobile, m.phone, m.phoneNumber, m.celular, m.cel),
  tier: pick(m.tipoCliente, m.tier, m.level, m.status),
  gender: pick(m.genero, m.gender, m.sexo),
  points: Number(pick(m.puntos, m.points, m.loyaltyPoints, 0)) || 0,
  dateOfBirth: pick(m.fechaNacimiento, m.birthdate, m.dateOfBirth, m.dob),
  clientCode: pick(m.codigoCliente, m.clientCode),
  campaignCode: pick(m.codigoCampana, m.codigoCampana, m.campaignCode),
  createdAt: pick(m.fechaCreacion, m.createdAt, m.created_at, m.dateCreated),
  expiryDate: pick(m.fechaExpiracion, m.expiryDate, m.expirationDate, m.expiresAt),
});


//  Normaliza cualquier forma de respuesta a array
const toArray = (data: any): BackendMember[] => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  if (Array.isArray((data as any).data)) return (data as any).data;
  if (Array.isArray((data as any).members)) return (data as any).members;
  if (Array.isArray((data as any).items)) return (data as any).items;
  if (Array.isArray((data as any).rows)) return (data as any).rows;
  if (Array.isArray((data as any).result)) return (data as any).result;
  return [];
};

// Autodetección de base + path
type MembersLoadResult = { list: UIMember[] };

async function fetchMembers(): Promise<MembersLoadResult> {
  const { data } = await api.get(`/api/members`);
  const list = toArray(data).map(adaptMember).sort((a, b) => a.id - b.id);
  return { list };
}



const Members = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();


  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [memberToAssign, setMemberToAssign] = useState<any>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMember, setEditMember] = useState<any>(null);
 // ✅ ahora
const [membersFromBackend, setMembersFromBackend] = useState<UIMember[]>([]);

const [qrOpen, setQrOpen] = useState(false);
const [qrPass, setQrPass] = useState<any>(null);
const [qrClient, setQrClient] = useState("");     // 👈 existe
const [qrCampaign, setQrCampaign] = useState(""); 

// Lista de passes para selector de tier/plantilla
const [passes, setPasses] = useState<UIPass[]>([]);


const [visibleColumns, setVisibleColumns] =
  useState<Record<ColumnKey, boolean>>(DEFAULT_VISIBLE);

const visibleCount = Object.values(visibleColumns).filter(Boolean).length;


  // Estado del formulario para agregar un nuevo miembro (en ESPAÑOL)
  const [newMember, setNewMember] = useState({
    tipoCliente: "",
    puntos: "",
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    genero: "",
  });

// Cargar miembros
useEffect(() => {
  (async () => {
    try {
      const { list } = await fetchMembers();
      setMembersFromBackend(list);
    } catch (err) {
      console.error("❌ Error al cargar miembros:", err);
      setMembersFromBackend([]);
      toast({
        title: "Error de carga",
        description: "No se pudieron cargar los miembros.",
        variant: "destructive",
      });
    }
  })();
}, [location.key, toast]);

// Cargar lista de passes (para desplegable en editar)
useEffect(() => {
  (async () => {
    try {
      const { data } = await api.get(`/api/passes`);
      const arr = Array.isArray(data) ? data : [];
      setPasses(arr.map((p: any) => ({ id: String(p.id), title: String(p.title || p.name || `Pass ${p.id}`), type: p.type })));
    } catch (e) {
      console.warn('No se pudieron cargar passes:', e);
      setPasses([]);
    }
  })();
}, []);

const tierFromPassTitle = (t: string) => {
  const s = String(t || '').toLowerCase();
  if (s.includes('gold') || s.includes('oro') || s.includes('15')) return 'gold';
  if (s.includes('blue') || s.includes('azul') || s.includes('5')) return 'blue';
  return 'blue';
}
const labelForPass = (t: string) => {
  const s = String(t || '').toLowerCase();
  if (s.includes('gold') || /\b15\b|15%/.test(s)) return 'Gold 15%';
  if (s.includes('blue') || /\b5\b|5%/.test(s)) return 'Blue 5%';
  return t || 'Pass';
}

const labelForTier = (t: string) => {
  const s = String(t || '').toLowerCase();
  if (s.includes('gold') || /\b15\b|15%/.test(s)) return 'Gold 15%';
  if (s.includes('blue') || /\b5\b|5%/.test(s)) return 'Blue 5%';
  return t || '—';
};

const badgeForTier = (t: string) => {
  const s = String(t || '').toLowerCase();
  const isGold = s.includes('gold') || /\b15\b|15%/.test(s);
  const isBlue = s.includes('blue') || /\b5\b|5%/.test(s);
  const label = isGold ? 'Gold 15%' : isBlue ? 'Blue 5%' : (t || '—');
  const cls = isGold
    ? 'bg-amber-100 text-amber-800'
    : isBlue
      ? 'bg-blue-100 text-blue-800'
      : 'bg-gray-100 text-gray-800';
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>;
};

// Ya no se necesita resolver endpoint dinámico; usar `api` central.

// Helper para leer errores que vienen en HTML sin romper JSON.parse
const readJsonSafe = async (res: Response) => {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { message: text }; }
};

const handleAddMember = async () => {
  const { nombre, apellido, email, tipoCliente, telefono, genero, puntos } = newMember;

  if (!nombre || !apellido || !email || !tipoCliente || !telefono) {
    toast({
      title: "Campos incompletos",
      description: "Por favor, completa todos los campos obligatorios.",
      variant: "destructive",
    });
    return;
  }

  // Payload que espera tu backend (en español)
  const memberToSend = {
    nombre,
    apellido,
    email,
    telefono,
    tipoCliente,
    genero: genero || "",
    puntos: parseInt(puntos, 10) || 0,
    fechaNacimiento: "", // pon el valor real si lo tienes en el form
  };

  try {
    // ⬇️ usa la misma base que funcionó en el GET
    await api.post(`/api/members`, memberToSend);

    toast({ title: "Miembro agregado", description: "Guardado exitosamente." });
    setIsAddModalOpen(false);

    // Resetea el form
    setNewMember({
      tipoCliente: "",
      puntos: "",
      nombre: "",
      apellido: "",
      email: "",
      telefono: "",
      genero: "",
    });

    // 🔄 refresca la lista usando el MISMO endpoint
    const { data: updatedJson } = await api.get(`/api/members`);
    const normalized = toArray(updatedJson).map(adaptMember).sort((a, b) => a.id - b.id);
    setMembersFromBackend(normalized);
  } catch (error: any) {
    console.error("❌ Error al guardar:", error?.message || error);
    toast({
      title: "Error",
      description: `No se pudo guardar el nuevo miembro: ${error?.message || "desconocido"}`,
      variant: "destructive",
    });
  }
};


// const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

const handleSelectMember = (memberId: number | string) => {
  const id = String(memberId);
  setSelectedMembers(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
};

const handleSelectAll = () => {
  const all = membersFromBackend.map(m => String(m.id));
  setSelectedMembers(
    selectedMembers.length === membersFromBackend.length ? [] : all
  );
};


  const handleViewDetails = (member: any) => {
    // El miembro ya debería estar normalizado si se carga correctamente del backend
    // Pero si hay alguna duda o si la vista de detalles requiere un formato específico,
    // puedes hacer una normalización aquí también.
    // Para simplificar, asumimos que 'member' ya tiene las propiedades en inglés si se cargó así.
    setSelectedMember(member);
    setIsDetailsModalOpen(true);
  };

  // === Actions in Member Details header ===
  const [resending, setResending] = useState(false);
  const [visiting, setVisiting] = useState(false);
  const [qrUrlData, setQrUrlData] = useState<{client:string;campaign:string;externalId?:string}|null>(null);

  const handleResendWelcome = async () => {
    try {
      if (!selectedMember) return;
      if (!selectedMember.email) {
        toast({ title: "Falta email", description: "Este miembro no tiene email para enviar.", variant: "destructive" });
        return;
      }
      setResending(true);
      const body = {
        email: selectedMember.email,
        displayName: `${selectedMember.firstName || ''} ${selectedMember.lastName || ''}`.trim(),
        clientCode: selectedMember.clientCode || selectedMember.codigoCliente || '',
        campaignCode: selectedMember.campaignCode || selectedMember.codigoCampana || '',
        // opcionalmente tier actual
        settings: {},
      };
      const { data: j } = await api.post(`/api/distribution/send-test-email`, body);
      if (j && j.ok === false) throw new Error(j?.error || `Send failed`);
      toast({ title: 'Enviado', description: 'Correo de bienvenida reenviado.' });
    } catch (e: any) {
      toast({ title: 'No se pudo enviar', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  const handleVisitPassUrl = async () => {
    try {
      if (!selectedMember) return;
      const client = selectedMember.clientCode || selectedMember.codigoCliente || '';
      const campaign = selectedMember.campaignCode || selectedMember.codigoCampana || '';
      if (!client || !campaign) {
        toast({ title: 'Faltan datos', description: 'Falta clientCode o campaignCode.', variant: 'destructive' });
        return;
      }
      setVisiting(true);
      const base = (api.defaults.baseURL || '').replace(/\/$/, '');
      const url = new URL(`${base}/api/wallet/resolve`);
      url.searchParams.set('client', client);
      url.searchParams.set('campaign', campaign);
      if (selectedMember.externalId) url.searchParams.set('externalId', selectedMember.externalId);
      // abre en nueva pestaña
      window.open(url.toString(), '_blank');
      // y prepara QR modal por si quieres escanearlo con el móvil
      setQrUrlData({ client, campaign, externalId: selectedMember.externalId });
      setQrOpen(true);
    } catch (e: any) {
      toast({ title: 'No se pudo abrir', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setVisiting(false);
    }
  };

  const handleCopyLink = (externalId: string) => {
    navigator.clipboard.writeText(`https://pass.example.com/${externalId}`);
    toast({
      title: "Link copiado",
      description: "La URL del pass se copió al portapapeles.",
    });
  };

  const handleEditMember = (member: any) => {
    // Al editar, el objeto `member` que llega aquí ya está en el formato normalizado (inglés)
    // Para el formulario de edición, necesitamos mapearlo a los nombres en español si tu formulario los usa
    // y si tu PUT espera los nombres en español.
    setEditMember({
      ...member, // Mantener todas las propiedades
      nombre: member.firstName,
      apellido: member.lastName,
      telefono: member.mobile,
      tipoCliente: member.tier,
      genero: member.gender,
      puntos: member.points,
      // ...otras propiedades que necesites mapear
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateMember = async () => {
  if (!editMember) return;

  const memberToUpdate = {
    nombre: editMember.nombre,
    apellido: editMember.apellido,
    email: editMember.email,
    telefono: editMember.telefono,
    genero: editMember.genero,
    tipoCliente: editMember.tipoCliente, // si tu form usa 'tier', mapea aquí
    puntos: Number(editMember.puntos) || 0,
    fechaNacimiento: editMember.dateOfBirth,
    external_id: editMember.externalId,
    codigoCliente: editMember.clientCode,
    codigoCampana: editMember.campaignCode,
  };

  try {
    await api.put(`/api/members/${editMember.id}`, memberToUpdate);

    toast({ title: "Actualización exitosa", description: "Datos actualizados." });
    setIsEditModalOpen(false);

    const { data: updated } = await api.get(`/api/members`);
    const normalized = toArray(updated).map(adaptMember).sort((a, b) => a.id - b.id);
    setMembersFromBackend(normalized);
  } catch (error: any) {
    console.error("❌ Error al actualizar miembro:", error.message);
    toast({ title: "Error", description: `No se pudo actualizar: ${error.message}` });
  }
};

const handleDeleteSelected = async () => {
  if (!can.deleteMember()) {
  toast({
    title: "Acción no permitida",
    description: "Solo un administrador puede eliminar miembros.",
    variant: "destructive",
  });
  return;
}

  try {
    const deletePromises = selectedMembers.map((id) => api.delete(`/api/members/${id}`));
    await Promise.all(deletePromises);

    toast({
      title: "Miembros eliminados",
      description: `${selectedMembers.length} miembro(s) eliminados.`,
    });
    setSelectedMembers([]);

    const { data: updated } = await api.get(`/api/members`);
    const normalized = toArray(updated).map(adaptMember).sort((a, b) => a.id - b.id);
    setMembersFromBackend(normalized);
  } catch (error: any) {
    console.error("❌ Error al eliminar:", error.message);
    toast({
      title: "Error",
      description: `No se pudieron eliminar: ${error.message}`,
      variant: "destructive",
    });
  }
};


 const handleExport = async () => {
  try {
    const blob = await CsvService.exportCsv();
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "members.csv";
    link.click();
    toast({ title: "Exportación exitosa", description: "CSV descargado." });
  } catch (error: any) {
    console.error("❌ Error al exportar CSV:", error.message);
    toast({ title: "Error", description: `No se pudo exportar: ${error.message}` });
  }
};

const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const result = await CsvService.importCsv(file);
    toast({ title: "Importación exitosa", description: `${result?.message ?? "Archivo importado."}` });

    const { data: updated } = await api.get(`/api/members`);
    const normalized = toArray(updated).map(adaptMember).sort((a, b) => a.id - b.id);
    setMembersFromBackend(normalized);
  } catch (error: any) {
    console.error("❌ Error al importar CSV:", error.message);
    toast({ title: "Error", description: `No se pudo importar: ${error.message}` });
  }
};

  const openAssignModal = (member: any) => {
  setMemberToAssign(member);
  setIsAssignModalOpen(true);
};

const handleAssignCard = async (member: any) => {
  try {
    const result: any = await CardsService.assignCard({
      codigoCliente: member.clientCode,
      codigoCampana: member.campaignCode,
    });

    if (result?.success || result === true) {
      toast({ title: "Tarjeta asignada correctamente" });
    } else {
      toast({ variant: "destructive", title: "Hubo un problema al asignar la tarjeta" });
    }
  } catch (error: any) {
    console.error("❌ Error al asignar tarjeta:", error?.message || error);
    toast({ variant: "destructive", title: "Error al asignar la tarjeta" });
  }
};


  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-semibold text-foreground">Members</h1>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>

        {/* ---- MODAL EDITAR (en español) ---- */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>Editar Miembro</DialogTitle>
            </DialogHeader>
            {editMember && (
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Nombre</Label>
                  <Input
                    value={editMember.nombre || ""}
                    onChange={(e) => setEditMember({ ...editMember, nombre: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Apellido</Label>
                  <Input
                    value={editMember.apellido || ""}
                    onChange={(e) => setEditMember({ ...editMember, apellido: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editMember.email || ""}
                    onChange={(e) => setEditMember({ ...editMember, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    value={editMember.telefono || ""}
                    onChange={(e) => setEditMember({ ...editMember, telefono: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Género</Label>
                  <Select
                    value={editMember.genero || ""}
                    onValueChange={(value) => setEditMember({ ...editMember, genero: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona género" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pass / Tier</Label>
                  <Select
                    value={String((editMember.tipoCliente || '').toLowerCase())}
                    onValueChange={(value) => {
                      // value será 'blue' o 'gold'
                      setEditMember({ ...editMember, tipoCliente: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blue 5%</SelectItem>
                      <SelectItem value="gold">Gold 15%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Puntos</Label>
                  <Input
                    type="number"
                    value={editMember.puntos ?? 0}
                    onChange={(e) => setEditMember({ ...editMember, puntos: Number(e.target.value) })}
                  />
                </div>
                <Button
                  className="w-full bg-[#7069e3] hover:bg-[#5f58d1] text-white"
                  onClick={handleUpdateMember} // Usar la nueva función handleUpdateMember
                >
                  Guardar Cambios
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

      <div className="flex gap-3 mb-6">
  {/* ADD MEMBER: solo admin */}
  {can.addMember() && (
    <Button
      onClick={() => navigate("/profile")}
      className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold px-4 py-2 rounded-lg"
    >
      <Plus className="w-4 h-4 mr-2" />
      ADD MEMBER
    </Button>
  )}

  {/* IMPORT CSV: solo admin */}
  {can.importExport() && (
    <label htmlFor="importCSV">
      <input id="importCSV" type="file" accept=".csv" onChange={handleImport} style={{ display: "none" }} />
      <Button variant="outline" className="text-muted-foreground" asChild>
        <span>
          <Upload className="w-4 h-4 mr-2" />
          IMPORT CSV
        </span>
      </Button>
    </label>
  )}

  {/* EXPORT CSV: solo admin */}
  {can.importExport() && (
    <Button variant="outline" className="text-muted-foreground" onClick={handleExport}>
      <Download className="w-4 h-4 mr-2" />
      EXPORT CSV
    </Button>
  )}

   {/* Botón COLUMNS con DropdownMenu mejorado */}
<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild>
    <Button variant="outline" className="flex items-center gap-2">
  <Columns3 className="h-4 w-4" />
  {`COLUMNS (${visibleCount})`}
</Button>


  </DropdownMenu.Trigger>

 <DropdownMenu.Content
  align="start"
  sideOffset={8}
  className="rounded-md shadow-md border p-2 w-56 bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"
  loop
>
  <div className="px-2 pb-2 text-xs text-muted-foreground">
    Mostrar/ocultar columnas
  </div>

  {COLUMN_KEYS.map((key) => (
    <DropdownMenu.CheckboxItem
      key={key}
      checked={visibleColumns[key]}
      onCheckedChange={(checked) =>
        setVisibleColumns((prev) => ({ ...prev, [key]: !!checked }))
      }
      className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 data-[state=checked]:bg-blue-100 data-[state=checked]:text-blue-700 dark:data-[state=checked]:bg-blue-900 dark:data-[state=checked]:text-blue-100"
    >
      {formatLabel(key)}
    </DropdownMenu.CheckboxItem>
  ))}

  <DropdownMenu.Separator />

  <DropdownMenu.Item
    className="px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
    onClick={() => setVisibleColumns(DEFAULT_VISIBLE)}
  >
    Reset a 4 columnas
  </DropdownMenu.Item>

  <DropdownMenu.Item
    className="px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
    onClick={() =>
      setVisibleColumns(
        Object.fromEntries(COLUMN_KEYS.map((k) => [k, true])) as Record<
          ColumnKey,
          boolean
        >
      )
    }
  >
    Mostrar todas
  </DropdownMenu.Item>

  <DropdownMenu.Item
    className="px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
    onClick={() =>
      setVisibleColumns(
        Object.fromEntries(COLUMN_KEYS.map((k) => [k, false])) as Record<
          ColumnKey,
          boolean
        >
      )
    }
  >
    Ocultar todas
  </DropdownMenu.Item>
</DropdownMenu.Content>


</DropdownMenu.Root>


        </div>

        {/* Tabla de miembros con scroll horizontal y columna sticky */}
        <div className="overflow-auto bg-card rounded-lg shadow-sm border">
  <table className="min-w-[1200px] table-auto w-full">
    <thead>
      <tr className="border-b bg-muted/50">
        {can.deleteMember() ? (
          <th className="w-12">
            <Checkbox
              checked={selectedMembers.length === membersFromBackend.length && membersFromBackend.length > 0}
              onCheckedChange={handleSelectAll}
            />
          </th>
        ) : (
          <th className="w-12" />
        )}

        {visibleColumns.id && (
          <th className="text-left font-medium text-muted-foreground text-nowrap">PASSKIT ID</th>
        )}
        {visibleColumns.externalId && (
          <th className="text-left font-medium text-muted-foreground text-nowrap">EXTERNAL ID</th>
        )}
        {visibleColumns.firstName && (
          <th className="text-left font-medium text-muted-foreground text-nowrap">FIRST NAME</th>
        )}
        {visibleColumns.lastName && (
          <th className="text-left font-medium text-muted-foreground text-nowrap">LAST NAME</th>
        )}
        {visibleColumns.email && (
          <th className="text-left font-medium text-muted-foreground text-nowrap">EMAIL</th>
        )}
        {visibleColumns.mobile && (
          <th className="text-left font-medium text-muted-foreground text-nowrap">PHONE</th>
        )}
        {visibleColumns.tier && (
          <th className="text-left font-medium text-muted-foreground text-nowrap">TIER</th>
        )}
        {visibleColumns.gender && (
          <th className="text-left font-medium text-muted-foreground text-nowrap">GENDER</th>
        )}
        {visibleColumns.points && (
          <th className="text-left font-medium text-muted-foreground text-nowrap">POINTS</th>
        )}
        {visibleColumns.dateOfBirth && (
          <th className="text-left font-medium text-muted-foreground text-nowrap">BIRTHDATE</th>
        )}
        {visibleColumns.clientCode && (
          <th className="text-left font-medium text-muted-foreground text-nowrap">CLIENT CODE</th>
        )}
        {visibleColumns.campaignCode && (
          <th className="text-left font-medium text-muted-foreground text-nowrap">CAMPAIGN CODE</th>
        )}

        {/* Sticky columna de acciones */}
        <th className="text-right sticky right-0 bg-muted/50 z-10 w-[150px] text-nowrap">ACTIONS</th>
      </tr>
    </thead>


            <tbody>
              {membersFromBackend.map((member: any) => (
                <tr key={member.id} className="border-b hover:bg-muted/50">
                 <td className="py-2">
                  {can.deleteMember() ? (
                    <Checkbox
                      checked={selectedMembers.includes(String(member.id))}
                      onCheckedChange={() => handleSelectMember(member.id)}
                    />
                  ) : (
                    <span className="inline-block w-4 h-4" />
                  )}
                </td>

                  {visibleColumns.id && <td className="font-mono text-sm py-2">{member.id}</td>}
                  {visibleColumns.externalId && <td className="py-2">{member.externalId || "—"}</td>}
                  {visibleColumns.firstName && <td className="py-2">{member.firstName || "—"}</td>}
                  {visibleColumns.lastName && <td className="py-2">{member.lastName || "—"}</td>}
                  {visibleColumns.email && <td className="py-2">{member.email || "—"}</td>}
                  {visibleColumns.mobile && <td className="py-2">{member.mobile || "—"}</td>}
                  {visibleColumns.tier && <td className="py-2">{badgeForTier(member.tier)}</td>}
                  {visibleColumns.gender && <td className="py-2">{member.gender || "—"}</td>}
                  {visibleColumns.points && <td className="py-2">{member.points ?? "—"}</td>}
                  {visibleColumns.dateOfBirth && (
                    <td className="py-2">
                      {member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString() : "—"}
                    </td>
                  )}
                  {visibleColumns.clientCode && <td className="py-2">{member.clientCode || "—"}</td>}
                  {visibleColumns.campaignCode && <td className="py-2">{member.campaignCode || "—"}</td>}

                  {/* Sticky acciones */}
                  <td className="text-right sticky right-0 bg-card z-10 w-[150px] py-2">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(member)}
                        className="h-8 w-8 p-0 hover:bg-muted"
                      >
                        <User className="w-4 h-4 text-muted-foreground" />
                      </Button>

                      {can.editMember() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditMember(member)}
                        className="h-8 w-8 p-0 hover:bg-muted"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyLink(member.externalId)}
                        className="h-8 w-8 p-0 hover:bg-muted"
                      >
                        <Link className="w-4 h-4 text-muted-foreground" />
                      </Button>

                    {/* 🎫 Botón de asignar tarjeta */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openAssignModal(member)}
                        className="h-8 w-8 p-0 hover:bg-muted"
                      >
                        <span>🎫</span>
                      </Button>

                     <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // "pass" mínimo para el modal (solo lo usamos para título/ids)
                      setQrPass({
                        id: String(member.id),
                        title:
                          `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() ||
                          member.email ||
                          "Member",
                        description: member.externalId || "",
                        createdAt: new Date().toISOString(),
                        estado: "active",
                        type: "loyalty",
                      });

                      // Códigos reales de la fila
                      setQrClient(member.clientCode || "");
                      setQrCampaign(member.campaignCode || "");

                      setQrOpen(true);
                    }}
                    className="h-8 w-8 p-0 hover:bg-muted"
                    title="Mostrar código"
                  >
                    <QrCode className="w-4 h-4 text-muted-foreground" />
                  </Button>

                       </div>
                      </td>
                     </tr>
                     ))}
                  </tbody>
                  </table>
                   </div>

       {can.deleteMember() && selectedMembers.length > 0 && (
  <div className="w-full flex justify-end mt-4 pr-4 mb-2">
    <Button
      variant="destructive"
      size="sm"
      className="px-3 py-1.5 text-sm flex items-center gap-1 shadow-sm"
      onClick={() => {
        if (window.confirm(`¿Estás seguro que deseas eliminar ${selectedMembers.length} miembro(s)?`)) {
          handleDeleteSelected();
        }
      }}
    >
      <Trash2 size={16} />
      DELETE
    </Button>
  </div>
)}

      </div>

          {/* 🎫 Modal de asignar tarjeta */}
<Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Asignar tarjeta</DialogTitle>
      <DialogDescription>
        Asigna una tarjeta al miembro seleccionado.
      </DialogDescription>
    </DialogHeader>

    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="clientCode" className="text-right">
          Código Cliente
        </Label>
        <Input
          id="clientCode"
          value={memberToAssign?.clientCode || ""}
          readOnly
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="campaignCode" className="text-right">
          Código Campaña
        </Label>
        <Input
          id="campaignCode"
          value={memberToAssign?.campaignCode || ""}
          readOnly
          className="col-span-3"
        />
      </div>
    </div>

    <DialogFooter>
      <Button
        onClick={() => {
          handleAssignCard(memberToAssign);
          setIsAssignModalOpen(false);
        }}
      >
        Asignar Tarjeta
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>


      {/* Detalles del miembro */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>Member Details</DialogTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleResendWelcome} disabled={resending}>
                  {resending ? 'Sending…' : 'Resend Welcome Email'}
                </Button>
                <Button size="sm" variant="outline" onClick={handleVisitPassUrl} disabled={visiting}>
                  {visiting ? 'Opening…' : 'Visit Pass URL'}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {selectedMember && (
            <Tabs defaultValue="details" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="personal">Personal Info</TabsTrigger>
                <TabsTrigger value="meta">Meta Fields</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Member ID</Label>
                    <p className="font-mono text-sm">{selectedMember?.id ?? "—"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Tier</Label>
                    <div className="mt-1">{badgeForTier(selectedMember?.tier)}</div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">External ID</Label>
                    <p className="text-sm">{selectedMember?.externalId || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Points</Label>
                    <p className="text-sm">{selectedMember?.points ?? "—"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Date Created</Label>
                    <p className="text-sm">
                      {selectedMember?.createdAt ? new Date(selectedMember.createdAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Expiration Date</Label>
                    <p className="text-sm">
                      {selectedMember?.expirationDate ? new Date(selectedMember.expirationDate).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="personal" className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">First Name</Label>
                    <p className="text-sm">{selectedMember?.firstName || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Last Name</Label>
                    <p className="text-sm">{selectedMember?.lastName || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Email</Label>
                    <p className="text-sm">{selectedMember?.email || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Phone</Label>
                    <p className="text-sm">{selectedMember?.mobile || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Gender</Label>
                    <p className="text-sm">{selectedMember?.gender || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Birthdate</Label>
                    <p className="text-sm">
                      {selectedMember?.dateOfBirth ? new Date(selectedMember.dateOfBirth).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="meta" className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Client Code</Label>
                    <p className="text-sm">{selectedMember?.clientCode || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Campaign Code</Label>
                    <p className="text-sm">{selectedMember?.campaignCode || "—"}</p>
                  </div>
                  {/* Agrega más campos meta aquí si los tienes */}
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* QR Modal para actualizar en dispositivo */}
          {qrOpen && qrUrlData && (
            <QrCodeModal
              isOpen={qrOpen}
              onClose={() => setQrOpen(false)}
              passData={{ id: String(selectedMember?.id||''), title: 'Wallet', description: 'Actualizar tarjeta', createdAt: '', estado: 'active', type: 'loyalty' } as any}
              clientCode={qrUrlData.client}
              campaignCode={qrUrlData.campaign}
              externalId={qrUrlData.externalId}
              defaultMode="qr"
            />
          )}
        </DialogContent>
      </Dialog>

        {/* QR / Code128 modal */}
  {qrPass && (
    <QrCodeModal
      isOpen={qrOpen}
      onClose={() => setQrOpen(false)}
      passData={qrPass}
      clientCode={qrClient}
      campaignCode={qrCampaign}
      externalId={qrPass?.description || qrPass?.externalId || qrClient}
      defaultMode="code128"
    />
  )}

    </div>
  );
};

export default Members;
