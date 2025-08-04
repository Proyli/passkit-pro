
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, useLocation } from "react-router-dom"; // Importar useLocation
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Edit3, Link, Plus, Upload, Download, Columns3, Trash2 } from "lucide-react";
// Se eliminan los imports de Table, TableBody, TableCell, TableHead, TableHeader, TableRow
// porque estás usando directamente elementos <table>, <thead>, etc.
import { useToast } from "@/hooks/use-toast";
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
    campaignCode: true,
  });

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
    const fetchMembers = async () => {
      try {
        const res = await fetch("http://localhost:3900/api/members");
        if (!res.ok) throw new Error("Error al cargar miembros");
        const data = await res.json();
        if (Array.isArray(data)) {
          // Normalizar los datos del backend al cargarlos para que coincidan con los nombres de columna en inglés
          const normalizedData = data.map((member: any) => ({
            id: member.id,
            externalId: member.external_id,
            firstName: member.nombre,
            lastName: member.apellido,
            email: member.email,
            mobile: member.telefono,
            tier: member.tipoCliente,
            gender: member.genero,
            points: member.puntos,
            dateOfBirth: member.fechaNacimiento,
            clientCode: member.codigoCliente,
            campaignCode: member.codigoCampaña,
            // Mantener otras propiedades si existen
            ...member,
          }));
          const ordenados = [...normalizedData].sort((a, b) => a.id - b.id);
          setMembersFromBackend(ordenados);
        } else {
          setMembersFromBackend([]);
        }
      } catch (err) {
        console.error("❌ Error al cargar miembros:", err);
        toast({
          title: "Error de carga",
          description: "No se pudieron cargar los miembros.",
          variant: "destructive",
        });
      }
    };
    fetchMembers();
  }, [location.key, toast]); // `location.key` para forzar recarga al cambiar de ruta, y `toast` para que no de warning

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

    // Objeto en ESPAÑOL para el backend (asegúrate que tu backend espere estos nombres)
    const memberToSend = {
      nombre,
      apellido,
      email,
      telefono,
      tipoCliente,
      genero: newMember.genero,
      puntos: parseInt(newMember.puntos) || 0,
      fechaNacimiento: "", // Si lo agregas en el formulario, usa el valor de newMember
    };

    try {
      const res = await fetch("http://localhost:3900/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memberToSend),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al guardar el miembro.");
      }

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
        genero: "",
      });

      // Refrescar miembros después de agregar
      const updatedRes = await fetch("http://localhost:3900/api/members");
      const updatedData = await updatedRes.json();
      if (Array.isArray(updatedData)) {
        const normalizedUpdatedData = updatedData.map((member: any) => ({
          id: member.id,
          externalId: member.external_id,
          firstName: member.nombre,
          lastName: member.apellido,
          email: member.email,
          mobile: member.telefono,
          tier: member.tipoCliente,
          gender: member.genero,
          points: member.puntos,
          dateOfBirth: member.fechaNacimiento,
          clientCode: member.codigoCliente,
          campaignCode: member.codigoCampaña,
          ...member,
        }));
        setMembersFromBackend([...normalizedUpdatedData].sort((a, b) => a.id - b.id));
      }
    } catch (error: any) {
      console.error("❌ Error al guardar:", error.message);
      toast({
        title: "Error",
        description: `No se pudo guardar el nuevo miembro: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleSelectMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSelectAll = () => {
    setSelectedMembers(selectedMembers.length === membersFromBackend.length ? [] : membersFromBackend.map((m: any) => m.id));
  };

  const handleViewDetails = (member: any) => {
    // El miembro ya debería estar normalizado si se carga correctamente del backend
    // Pero si hay alguna duda o si la vista de detalles requiere un formato específico,
    // puedes hacer una normalización aquí también.
    // Para simplificar, asumimos que 'member' ya tiene las propiedades en inglés si se cargó así.
    setSelectedMember(member);
    setIsDetailsModalOpen(true);
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

    // Preparar el objeto para enviar al backend, con nombres en español si el backend los espera
    const memberToUpdate = {
      nombre: editMember.nombre,
      apellido: editMember.apellido,
      email: editMember.email,
      telefono: editMember.telefono,
      genero: editMember.genero,
      tipoCliente: editMember.tipoCliente, // O tier, dependiendo de tu backend
      puntos: Number(editMember.puntos) || 0,
      fechaNacimiento: editMember.dateOfBirth, // Si está en el formulario de edición
      external_id: editMember.externalId, // Asegúrate de enviar el ID externo si tu backend lo necesita para la actualización
      codigoCliente: editMember.clientCode,
      codigoCampaña: editMember.campaignCode,
    };

    try {
      const res = await fetch(`http://localhost:3900/api/members/${editMember.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memberToUpdate),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al actualizar.");
      }

      toast({ title: "Actualización exitosa", description: "Los datos del miembro han sido actualizados." });
      setIsEditModalOpen(false);

      // Refrescar los datos después de la actualización
      const updatedRes = await fetch("http://localhost:3900/api/members");
      const updatedData = await updatedRes.json();
      if (Array.isArray(updatedData)) {
        const normalizedUpdatedData = updatedData.map((member: any) => ({
          id: member.id,
          externalId: member.external_id,
          firstName: member.nombre,
          lastName: member.apellido,
          email: member.email,
          mobile: member.telefono,
          tier: member.tipoCliente,
          gender: member.genero,
          points: member.puntos,
          dateOfBirth: member.fechaNacimiento,
          clientCode: member.codigoCliente,
          campaignCode: member.codigoCampaña,
          ...member,
        }));
        setMembersFromBackend([...normalizedUpdatedData].sort((a, b) => a.id - b.id));
      }
    } catch (error: any) {
      console.error("❌ Error al actualizar miembro:", error.message);
      toast({ title: "Error", description: `No se pudo actualizar el miembro: ${error.message}` });
    }
  };

  const handleDeleteSelected = async () => {
    try {
      const deletePromises = selectedMembers.map((id) =>
        fetch(`http://localhost:3900/api/members/${id}`, { method: "DELETE" }).then((res) => {
          if (!res.ok) throw new Error(`Error al eliminar miembro con ID ${id}`);
          return res.json();
        })
      );
      await Promise.all(deletePromises);

      toast({
        title: "Miembros eliminados",
        description: `${selectedMembers.length} miembro(s) fueron eliminados.`,
      });
      setSelectedMembers([]);

      // Refrescar la lista de miembros
      const res = await fetch("http://localhost:3900/api/members");
      const updatedMembers = await res.json();
      if (Array.isArray(updatedMembers)) {
        const normalizedUpdatedMembers = updatedMembers.map((member: any) => ({
          id: member.id,
          externalId: member.external_id,
          firstName: member.nombre,
          lastName: member.apellido,
          email: member.email,
          mobile: member.telefono,
          tier: member.tipoCliente,
          gender: member.genero,
          points: member.puntos,
          dateOfBirth: member.fechaNacimiento,
          clientCode: member.codigoCliente,
          campaignCode: member.codigoCampaña,
          ...member,
        }));
        setMembersFromBackend([...normalizedUpdatedMembers].sort((a, b) => a.id - b.id));
      } else {
        setMembersFromBackend([]);
      }
    } catch (error: any) {
      console.error("❌ Error al eliminar:", error.message);
      toast({
        title: "Error",
        description: `No se pudieron eliminar los miembros: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch("http://localhost:3900/api/csv/export", { method: "GET" });
      if (!response.ok) throw new Error("Error al exportar CSV");
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = "members.csv";
      link.click();
      toast({
        title: "Exportación exitosa",
        description: "El archivo CSV se ha descargado.",
      });
    } catch (error: any) {
      console.error("❌ Error al exportar CSV:", error.message);
      toast({ title: "Error", description: `No se pudo exportar el archivo CSV: ${error.message}` });
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
      if (!response.ok) throw new Error(result.message || "Error al importar CSV");

      console.log("✅ Importación completa:", result);
      toast({ title: "Importación exitosa", description: `${result.message}` });

      // refrescar
      const res = await fetch("http://localhost:3900/api/members");
      const updated = await res.json();
      if (Array.isArray(updated)) {
        const normalizedUpdated = updated.map((member: any) => ({
          id: member.id,
          externalId: member.external_id,
          firstName: member.nombre,
          lastName: member.apellido,
          email: member.email,
          mobile: member.telefono,
          tier: member.tipoCliente,
          gender: member.genero,
          points: member.puntos,
          dateOfBirth: member.fechaNacimiento,
          clientCode: member.codigoCliente,
          campaignCode: member.codigoCampaña,
          ...member,
        }));
        setMembersFromBackend([...normalizedUpdated].sort((a, b) => a.id - b.id));
      } else {
        setMembersFromBackend([]);
      }
    } catch (error: any) {
      console.error("❌ Error al importar CSV:", error.message);
      toast({ title: "Error", description: `No se pudo importar el archivo: ${error.message}` });
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
      campaignCode: "Campaign Code",
    };
    return map[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
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

        {/* Botones de acción */}
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
                  <Label>
                    Tier <span className="text-red-500">*</span>
                  </Label>
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
                  <Label>
                    Nombre <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={newMember.nombre}
                    onChange={(e) => setNewMember({ ...newMember, nombre: e.target.value })}
                    placeholder="Nombre"
                  />
                </div>

                <div>
                  <Label>
                    Apellido <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={newMember.apellido}
                    onChange={(e) => setNewMember({ ...newMember, apellido: e.target.value })}
                    placeholder="Apellido"
                  />
                </div>

                <div>
                  <Label>
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    placeholder="Email"
                  />
                </div>

                <div>
                  <Label>
                    Teléfono <span className="text-red-500">*</span>
                  </Label>
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

          {/* Botón COLUMNS con DropdownMenu */}
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
        </div>

        {/* Tabla de miembros con scroll horizontal y columna sticky */}
        <div className="overflow-auto bg-card rounded-lg shadow-sm border">
          <table className="min-w-[1200px] table-auto w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-12">
                  <Checkbox checked={selectedMembers.length === membersFromBackend.length} onCheckedChange={handleSelectAll} />
                </th>

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
                    <Checkbox checked={selectedMembers.includes(member.id)} onCheckedChange={() => handleSelectMember(member.id)} />
                  </td>

                  {visibleColumns.id && <td className="font-mono text-sm py-2">{member.id}</td>}
                  {visibleColumns.externalId && <td className="py-2">{member.externalId || "—"}</td>}
                  {visibleColumns.firstName && <td className="py-2">{member.firstName || "—"}</td>}
                  {visibleColumns.lastName && <td className="py-2">{member.lastName || "—"}</td>}
                  {visibleColumns.email && <td className="py-2">{member.email || "—"}</td>}
                  {visibleColumns.mobile && <td className="py-2">{member.mobile || "—"}</td>}
                  {visibleColumns.tier && <td className="py-2">{member.tier || "—"}</td>}
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

        {selectedMembers.length > 0 && (
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
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Members;