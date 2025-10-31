import React, { useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useProfileStore } from "@/store/profileStore";
import { ArrowLeft, Save, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

// === Tier options (para el select) ===
const TIER_OPTIONS = [
  { value: "blue", label: "Blue 5%" },
  { value: "gold", label: "Gold 15%" },
  { value: "silver", label: "Silver" },
  { value: "bronze", label: "Bronze" },
];

// Carga diferida (por si falla PassList no tumba Profile)
const PassList = lazy(() => import("./PassList"));

// Mantén strings en el formulario; convierte a number al guardar
type FormData = {
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  codigoCliente: string;
  codigoCampana: string;
  tipoCliente: string; // "blue" | "gold" | "silver" | "bronze"
  email: string;
  telefono: string;
  genero: string;
  puntos: string; // string en el form
  idExterno: string;
};

const EMPTY_FORM: FormData = {
  nombre: "",
  apellido: "",
  fechaNacimiento: "",
  codigoCliente: "",
  codigoCampana: "",
  tipoCliente: "",
  email: "",
  telefono: "",
  genero: "",
  puntos: "",
  idExterno: "",
};

// Cliente HTTP centralizado via axios

async function enviarWalletEmailDesdePerfil(form: Partial<FormData>) {
  const payload = {
    client: form.codigoCliente,
    campaign: form.codigoCampana,
    to: form.email,
    tier: /gold/i.test(form.tipoCliente || "") ? "gold" : "blue",
    name: `${form.nombre || ""} ${form.apellido || ""}`.trim(),
    externalId: form.idExterno || "",
  };

  const { data } = await api.post(`/api/wallet/email`, payload);
  if (!(data as any)?.ok) {
    throw new Error((data as any)?.error || (data as any)?.message || `Send failed`);
  }
  return data as any; // { ok:true, smartUrl:"..." }
}

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { profileData, setProfileData, clearProfileData } = useProfileStore();

  // ⬇️ Flag: oculta la sección de “Pases digitales asignados”
  const SHOW_ASSIGNED_PASSES = false;

  // Estado del formulario
  const [formData, setFormData] = useState<FormData>({
    ...EMPTY_FORM,
    ...(profileData as Partial<FormData> | undefined),
  });

  // Si alguien escribe manualmente codigoCampana
  const [campaignManual, setCampaignManual] = useState<boolean>(
    Boolean((profileData as any)?.codigoCampana)
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "codigoCampana" && !campaignManual) {
      setCampaignManual(true);
    }

    const next = { ...formData, [name]: value };
    setFormData(next);
    setProfileData(next);
  };

  // Guardar + enviar email Wallet
  const handleGuardar = async () => {
    const nuevoCliente = {
      ...formData,
      puntos: String(parseInt(formData.puntos || "0", 10) || 0),
    };

    try {
      const { data } = await api.post(`/api/members`, nuevoCliente);
      console.log("✅ Cliente guardado:", data);

      // Fire-and-forget the wallet email: don't block the UI if the external service fails
      void enviarWalletEmailDesdePerfil(nuevoCliente).catch((err) => {
        // log error but don't stop the user flow
        console.error("Error enviando email de Wallet (no bloqueante):", err?.message || err);
      });

      alert("Cliente guardado en MySQL con éxito. Se intentó enviar el correo de la Wallet.");
      clearProfileData();
      setFormData(EMPTY_FORM);
      navigate("/members");
    } catch (err: any) {
      console.error("❌ Error al guardar/enviar:", err);
      alert("Hubo un error al guardar o enviar el email: " + err.message);
    }
  };

  const handleAdvance = () => navigate("/members");
  // Marca visual de requerido (no afecta validación)
  const Required = () => <span className="text-red-500 ml-1">*</span>;

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Perfil</h1>
        <p className="text-muted-foreground mt-1">Completa la información del cliente para emitir y gestionar su tarjeta digital.</p>
      </div>

      {/* Card */}
      <div className="relative rounded-2xl border border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-xl">
        {/* top accent bar */}
        <div className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400" />

        <div className="p-8">
          {/* Section: Datos personales */}
          <h2 className="text-lg font-semibold text-foreground mb-4">Datos personales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label className="text-base text-foreground">Nombre<Required /></Label>
              <Input name="nombre" value={formData.nombre} onChange={handleChange} className="h-12 text-base rounded-xl" />
            </div>
            <div>
              <Label className="text-base text-foreground">Apellido<Required /></Label>
              <Input name="apellido" value={formData.apellido} onChange={handleChange} className="h-12 text-base rounded-xl" />
            </div>
            <div>
              <Label className="text-base text-foreground">Fecha de nacimiento</Label>
              <Input
                type="date"
                name="fechaNacimiento"
                value={formData.fechaNacimiento}
                onChange={handleChange}
                className="h-12 text-base rounded-xl"
              />
            </div>
            <div>
              <Label className="text-base text-foreground">Código del cliente<Required /></Label>
              <Input
                name="codigoCliente"
                value={formData.codigoCliente}
                onChange={handleChange}
                className="h-12 text-base rounded-xl"
              />
            </div>
            <div>
              <Label className="text-base text-foreground">Código de la campaña</Label>
              <Input
                name="codigoCampana"
                value={formData.codigoCampana}
                onChange={handleChange}
                className="h-12 text-base rounded-xl"
              />
            </div>
            <div>
              <Label className="text-base text-foreground">Tipo de cliente<Required /></Label>
              <select
                name="tipoCliente"
                value={formData.tipoCliente}
                onChange={(e) => {
                  const tipo = e.target.value;
                  const next = { ...formData, tipoCliente: tipo };
                  setFormData(next);
                  setProfileData(next);
                }}
                className="w-full h-12 rounded-xl border border-input bg-background text-foreground px-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value=""></option>
                {TIER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-base text-foreground">Email<Required /></Label>
              <Input name="email" value={formData.email} onChange={handleChange} className="h-12 text-base rounded-xl" />
            </div>
            <div>
              <Label className="text-base text-foreground">Teléfono</Label>
              <Input name="telefono" value={formData.telefono} onChange={handleChange} className="h-12 text-base rounded-xl" />
            </div>
            <div className="w-full">
              <Label className="mb-1 block text-base text-foreground">Género</Label>
              <select
                name="genero"
                value={formData.genero}
                onChange={handleChange}
                className="w-full h-12 rounded-xl border border-input bg-background text-foreground px-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value=""></option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <Label className="text-base text-foreground">Puntos</Label>
              <Input name="puntos" value={formData.puntos} onChange={handleChange} className="h-12 text-base rounded-xl" />
            </div>
          </div>

          {/* Divider */}
          <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

          {/* Action bar */}
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="rounded-xl h-12 px-5 text-base">
              <ArrowLeft className="w-4 h-4 mr-2" /> Regresar
            </Button>
            <div className="flex gap-3">
              <Button onClick={handleGuardar} className="rounded-xl h-12 px-6 text-base bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-500 hover:to-sky-500 text-white">
                <Save className="w-4 h-4 mr-2" /> Guardar
              </Button>
              <Button onClick={handleAdvance} className="rounded-xl h-12 px-6 text-base bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-500 hover:to-cyan-500 text-white">
                Avanzar <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* ⬇️ Sección de “Pases digitales asignados” desactivada */}
        {SHOW_ASSIGNED_PASSES && (
          <>
            <h2 className="text-xl font-semibold mt-8 mb-4">Pases digitales asignados</h2>
            <Suspense fallback={null}>
              <PassList />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
