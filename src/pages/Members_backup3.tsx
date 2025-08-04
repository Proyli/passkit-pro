import {useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Edit3, Link, Plus, Upload, Download, Columns3 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

const Members = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMember, setEditMember] = useState<any>(null);
  const [membersFromBackend, setMembersFromBackend] = useState<any[]>([]);

  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    externalId: true,
    firstName: true,
    lastName: true,
    email: true,
    mobile: true,
    tier: true,
    gender: true,
    points: true,
    dateOfBirth: true,
    clientCode: true,
    campaignCode: true
  });

  // ✨ Estado del formulario en ESPAÑOL
  const [newMember, setNewMember] = useState({
    tipoCliente: "",
    puntos: "",
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    genero: ""
  });

  // Cargar miembros
  useEffect(() => {
    fetch("http://localhost:3900/api/members")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const ordenados = [...data].sort((a, b) => a.id - b.id);
          setMembersFromBackend(ordenados);
        } else {
          setMembersFromBackend([]);
        }
      })
      .catch((err) => console.error("❌ Error al cargar miembros:", err));
  }, [location.key]);

  const handleAddMember = async () => {
    const { nombre, apellido, email, tipoCliente, telefono } = newMember;

    if (!nombre || !apellido || !email || !tipoCliente || !telefono) {
      toast({
        title: "Campos incompletos",
        description: "Por favor, completa todos los campos obligatorios.",
        variant: "destructive",
      });
      return;
    }

    // Objeto en ESPAÑOL para el backend
    const member = {
      nombre,
      apellido,
      email,
      telefono,
      tipoCliente,
      genero: newMember.genero,
      puntos: parseInt(newMember.puntos) || 0,
      fechaNacimiento: "", // si luego agregas este campo en el formulario
    };

    try {
      const res = await fetch("http://localhost:3900/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(member),
      });

      if (!res.ok) throw new Error("Error al guardar");

      toast({
        title: "Miembro agregado",
        description: "El nuevo miembro fue guardado exitosamente.",
      });

      setIsAddModalOpen(false);

      setNewMember({
        tipoCliente: "",
        puntos: "",
        nombre: "",
        apellido: "",
        email: "",
        telefono: "",
        genero: ""
      });

      // Refrescar miembros
      const data = await res.json();
      setMembersFromBackend(prev => [...prev, data.member]); // objeto .member

    } catch (error) {
      console.error("❌ Error al guardar:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el nuevo miembro.",
        variant: "destructive",
      });
    }
  };

  const handleSelectMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAll = () => {
    setSelectedMembers(
      selectedMembers.length === membersFromBackend.length
        ? []
        : membersFromBackend.map((m: any) => m.id)
    );
  };

  const handleViewDetails = async (member: any) => {
    try {
      const normalizedMember = {
        ...member,
        firstName: member.nombre,
        lastName: member.apellido,
        mobile: member.telefono,
        gender: member.genero,
        tier: member.tipoCliente,
        externalId: member.external_id,
        dateOfBirth: member.fechaNacimiento,
        points: member.puntos,
        createdAt: member.fechaCreacion,
        expirationDate: member.fechaExpiracion,
        email: member.email,
        clientCode: member.codigoCliente,
        campaignCode: member.codigoCampaña,
      };

      setSelectedMember(normalizedMember);
      setIsDetailsModalOpen(true);
    } catch (error) {
      console.error("❌ Error al cargar datos del miembro:", error);
    }
  };

  const handleCopyLink = (externalId: string) => {
    navigator.clipboard.writeText(`https://pass.example.com/${externalId}`);
    toast({
      title: "Link copiado",
      description: "La URL del pass se copió al portapapeles."
    });
  };

  const handleEditMember = (member: any) => {
    console.log("🛠️ Datos del miembro al editar:", member);
    setEditMember(member);
    setIsEditModalOpen(true);
  };

  const handleDeleteSelected = async () => {
    try {
      for (const id of selectedMembers) {
        await fetch(`http://localhost:3900/api/members/${id}`, { method: "DELETE" });
      }
      toast({
        title: "Miembros eliminados",
        description: `${selectedMembers.length} miembro(s) fueron eliminados.`,
      });
      setSelectedMembers([]);
      const res = await fetch("http://localhost:3900/api/members");
      const updatedMembers = await res.json();
      setMembersFromBackend(Array.isArray(updatedMembers) ? updatedMembers : []);
    } catch (error) {
      console.error("❌ Error al eliminar:", error);
      toast({
        title: "Error",
        description: "No se pudieron eliminar los miembros.",
      });
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch("http://localhost:3900/api/csv/export", { method: "GET" });
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = "members.csv";
      link.click();
    } catch (error) {
      console.error("❌ Error al exportar CSV:", error);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("csvFile", file);

    try {
      const response = await fetch("http://localhost:3900/api/csv/import", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      console.log("✅ Importación completa:", result);
      toast({ title: "Importación exitosa", description: `${result.message}` });

      // refrescar
      const res = await fetch("http://localhost:3900/api/members");
      const updated = await res.json();
      setMembersFromBackend(Array.isArray(updated) ? updated : []);
    } catch (error) {
      console.error("❌ Error al importar CSV:", error);
      toast({ title: "Error", description: "No se pudo importar el archivo" });
    }
  };

  const formatLabel = (key: string) => {
    const map: Record<string, string> = {
      id: "ID",
      externalId: "External ID",
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      mobile: "Phone",
      tier: "Tier",
      gender: "Gender",
      points: "Points",
      dateOfBirth: "Date of Birth",
      clientCode: "Client Code",
      campaignCode: "Campaign Code"
    };

    return map[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
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
                    onChange={e => setEditMember({ ...editMember, nombre: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Apellido</Label>
                  <Input
                    value={editMember.apellido || ""}
                    onChange={e => setEditMember({ ...editMember, apellido: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={editMember.email || ""}
                    onChange={e => setEditMember({ ...editMember, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    value={editMember.telefono || ""}
                    onChange={e => setEditMember({ ...editMember, telefono: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Género</Label>
                  <Select
                    value={editMember.genero || ""}
                    onValueChange={value => setEditMember({ ...editMember, genero: value })}
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
                  <Label>Puntos</Label>
                  <Input
                    type="number"
                    value={editMember.puntos ?? 0}
                    onChange={e => setEditMember({ ...editMember, puntos: Number(e.target.value) })}
                  />
                </div>
                <Button
                  className="w-full bg-[#7069e3] hover:bg-[#5f58d1] text-white"
                  onClick={async () => {
                    try {
                      const res = await fetch(`http://localhost:3900/api/members/${editMember.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...editMember, puntos: Number(editMember.puntos) || 0 }),
                      });
                      const data = await res.json();
                      console.log("📝 Miembro actualizado:", data);
                      toast({ title: "Actualización exitosa", description: "Los datos del miembro han sido actualizados." });
                      setIsEditModalOpen(false);
                      const updated = await fetch("http://localhost:3900/api/members");
                      const updatedData = await updated.json();
                      setMembersFromBackend(Array.isArray(updatedData) ? updatedData : []);
                    } catch (error) {
                      console.error("❌ Error al actualizar miembro:", error);
                      toast({ title: "Error", description: "No se pudo actualizar el miembro." });
                    }
                  }}
                >
                  Guardar Cambios
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Botones de acción (incluyendo el nuevo botón DELETE) */}
        <div className="flex gap-3 mb-6">
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#7069e3] hover:bg-[#5f58d1] text-white">
                <Plus className="w-4 h-4 mr-2" />
                ADD MEMBER
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle>Agregar Miembro</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Tier <span className="text-red-500">*</span></Label>
                  <Select
                    value={newMember.tipoCliente}
                    onValueChange={(value) => setNewMember({ ...newMember, tipoCliente: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bronze">Bronze</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Black">Black</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Puntos</Label>
                  <Input
                    type="number"
                    value={newMember.puntos}
                    onChange={(e) => setNewMember({ ...newMember, puntos: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label>Nombre <span className="text-red-500">*</span></Label>
                  <Input
                    value={newMember.nombre}
                    onChange={(e) => setNewMember({ ...newMember, nombre: e.target.value })}
                    placeholder="Nombre"
                  />
                </div>

                <div>
                  <Label>Apellido <span className="text-red-500">*</span></Label>
                  <Input
                    value={newMember.apellido}
                    onChange={(e) => setNewMember({ ...newMember, apellido: e.target.value })}
                    placeholder="Apellido"
                  />
                </div>

                <div>
                  <Label>Email <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    placeholder="Email"
                  />
                </div>

                <div>
                  <Label>Teléfono <span className="text-red-500">*</span></Label>
                  <Input
                    value={newMember.telefono}
                    onChange={(e) => setNewMember({ ...newMember, telefono: e.target.value })}
                    placeholder="Teléfono"
                  />
                </div>

                <div>
                  <Label>Género</Label>
                  <Select
                    value={newMember.genero}
                    onValueChange={(value) => setNewMember({ ...newMember, genero: value })}
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

                <Button onClick={handleAddMember} className="w-full bg-[#7069e3] hover:bg-[#5f58d1] text-white">
                  Add
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* IMPORT CSV */}
          <label htmlFor="importCSV">
            <input id="importCSV" type="file" accept=".csv" onChange={handleImport} style={{ display: "none" }} />
            <Button variant="outline" className="text-muted-foreground" asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                IMPORT CSV
              </span>
            </Button>
          </label>

          {/* EXPORT CSV */}
          <Button variant="outline" className="text-muted-foreground" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            EXPORT CSV
          </Button>

          {/* Dropdown COLUMNS */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Columns3 className="h-4 w-4" />
                COLUMNS
              </Button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content
              align="start"
              sideOffset={8}
              className="bg-white rounded-md shadow-md border p-2 w-52"
            >
              {Object.entries(visibleColumns).map(([key, value]) => (
                <DropdownMenu.CheckboxItem
                  key={key}
                  checked={value}
                  onCheckedChange={(checked) => {
                    // prevenir que se cierre al hacer clic
                    setVisibleColumns((prev) => ({
                      ...prev,
                      [key]: checked,
                    }));
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm capitalize hover:bg-gray-100 rounded-md cursor-pointer"
                >
                  {formatLabel(key)}
                </DropdownMenu.CheckboxItem>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>

          {/* DELETE BUTTON - AQUI VA */}
          {selectedMembers.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="ml-auto px-3 py-1.5 text-sm flex items-center gap-1 shadow-sm" // Añadido ml-auto para empujar a la derecha
              onClick={() => {
                if (window.confirm(`¿Estás seguro que deseas eliminar ${selectedMembers.length} miembro(s)?`)) {
                  handleDeleteSelected();
                }
              }}
            >
              <Trash2 size={16} />
              DELETE
            </Button>
          )}
        </div>

        {/* Tabla de miembros con scroll horizontal y columna sticky */}
        <div className="overflow-auto bg-card rounded-lg shadow-sm border">
          <table className="min-w-[1200px] table-auto w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-12">
                  <Checkbox
                    checked={selectedMembers.length === membersFromBackend.length}
                    onCheckedChange={handleSelectAll}
                  />
                </th>

                {visibleColumns.id && (
                  <th className="text-left font-medium text-muted-foreground">PASSKIT ID</th>
                )}
                {visibleColumns.externalId && (
                  <th className="text-left font-medium text-muted-foreground">EXTERNAL ID</th>
                )}
                {visibleColumns.firstName && (
                  <th className="text-left font-medium text-muted-foreground">FIRST NAME</th>
                )}
                {visibleColumns.lastName && (
                  <th className="text-left font-medium text-muted-foreground">LAST NAME</th>
                )}
                {visibleColumns.email && (
                  <th className="text-left font-medium text-muted-foreground">EMAIL</th>
                )}
                {visibleColumns.mobile && (
                  <th className="text-left font-medium text-muted-foreground">PHONE</th>
                )}
                {visibleColumns.tier && (
                  <th className="text-left font-medium text-muted-foreground">TIER</th>
                )}
                {visibleColumns.gender && (
                  <th className="text-left font-medium text-muted-foreground">GENDER</th>
                )}
                {visibleColumns.points && (
                  <th className="text-left font-medium text-muted-foreground">POINTS</th>
                )}
                {visibleColumns.dateOfBirth && (
                  <th className="text-left font-medium text-muted-foreground">BIRTHDATE</th>
                )}
                {visibleColumns.clientCode && (
                  <th className="text-left font-medium text-muted-foreground">CLIENT CODE</th>
                )}
                {visibleColumns.campaignCode && (
                  <th className="text-left font-medium text-muted-foreground">CAMPAIGN CODE</th>
                )}

                {/* Sticky columna de acciones */}
                <th className="text-right sticky right-0 bg-white z-10 w-[150px]">ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {membersFromBackend.map((member: any) => (
                <tr key={member.id} className="hover:bg-muted/50">
                  <td>
                    <Checkbox
                      checked={selectedMembers.includes(member.id)}
                      onCheckedChange={() => handleSelectMember(member.id)}
                    />
                  </td>

                  {visibleColumns.id && (
                    <td className="font-mono text-sm">{member.id}</td>
                  )}
                  {visibleColumns.externalId && (
                    <td>{member.externalId}</td>
                  )}
                  {visibleColumns.firstName && (
                    <td>{member.firstName}</td>
                  )}
                  {visibleColumns.lastName && (
                    <td>{member.lastName}</td>
                  )}
                  {visibleColumns.email && (
                    <td>{member.email}</td>
                  )}
                  {visibleColumns.mobile && (
                    <td>{member.mobile}</td>
                  )}
                  {visibleColumns.tier && (
                    <td>{member.tier}</td>
                  )}
                  {visibleColumns.gender && (
                    <td>{member.gender}</td>
                  )}
                  {visibleColumns.points && (
                    <td>{member.points}</td>
                  )}
                  {visibleColumns.dateOfBirth && (
                    <td>
                      {member.dateOfBirth
                        ? new Date(member.dateOfBirth).toLocaleDateString()
                        : "-"}
                    </td>
                  )}
                  {visibleColumns.clientCode && (
                    <td>{member.clientCode}</td>
                  )}
                  {visibleColumns.campaignCode && (
                    <td>{member.campaignCode}</td>
                  )}

                  {/* Sticky acciones */}
                  <td className="text-right sticky right-0 bg-white z-10 w-[150px]">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(member)}
                        className="h-8 w-8 p-0 hover:bg-muted"
                      >
                        <User className="w-4 h-4 text-muted-foreground" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditMember(member)}
                        className="h-8 w-8 p-0 hover:bg-muted"
                      >
                        <Edit3 className="w-4 h-4 text-muted-foreground" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyLink(member.externalId)}
                        className="h-8 w-8 p-0 hover:bg-muted"
                      >
                        <Link className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>


        {/* Detalles del miembro */}
        <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex justify-between items-center">
                <DialogTitle>Member Details</DialogTitle>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-[#7069e3] hover:bg-[#5f58d1] text-white">
                    Update
                  </Button>
                  <Button size="sm" variant="outline">
                    Resend Welcome Email
                  </Button>
                  <Button size="sm" variant="outline">
                    Visit Pass URL
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
                      <p className="text-sm">{selectedMember?.tier || "—"}</p>
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
                        {selectedMember?.createdAt
                          ? new Date(selectedMember.createdAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Expiry Date</Label>
                      <p className="text-sm">
                        {selectedMember?.fechaExpiracion
                          ? new Date(selectedMember.fechaExpiracion).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                </TabsContent>


                <TabsContent value="personal" className="space-y-4 mt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Full Name</Label>
                      <p className="text-sm">{selectedMember?.firstName ?? ""} {selectedMember?.lastName ?? ""}</p>

                      <Label className="text-sm text-muted-foreground">Email</Label>
                      <p className="text-sm">{selectedMember?.email || "-"}</p>

                      <Label className="text-sm text-muted-foreground">Phone</Label>
                      <p className="text-sm">{selectedMember?.mobile || "-"}</p>

                      <Label className="text-sm text-muted-foreground">Gender</Label>
                      <p className="text-sm">{selectedMember?.gender || "-"}</p>

                      <Label className="text-sm text-muted-foreground">Date of Birth</Label>
                      <p className="text-sm">{selectedMember?.dateOfBirth || "-"}</p>

                      <Label className="text-sm text-muted-foreground">Points</Label>
                      <p className="text-sm">{selectedMember?.points ?? "-"}</p>

                      <Label className="text-sm text-muted-foreground">Fecha de Creación</Label>
                      <p className="text-sm">
                        {selectedMember?.createdAt ? new Date(selectedMember.createdAt).toLocaleDateString() : "-"}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm text-muted-foreground">Fecha de Expiración</Label>
                      <p className="text-sm">
                        {selectedMember?.expirationDate
                          ? new Date(selectedMember.expirationDate).toLocaleDateString()
                          : "—"}

                      </p>
                    </div>

                  </div>
                </TabsContent>

                <TabsContent value="meta" className="space-y-4 mt-6">
                  <p className="text-sm text-muted-foreground">No meta fields configured.</p>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div> {/* Cierre del div max-w-7xl mx-auto */}
    </div> // Cierre del div min-h-screen bg-background p-6
  );
};

export default Members;