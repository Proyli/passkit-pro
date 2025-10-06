import React, { useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useProfileStore } from "@/store/profileStore";

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

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:3900/api";

// === Email de Wallet ===
const BACKEND = "https://backend-passforge.onrender.com";

async function enviarWalletEmailDesdePerfil(form: Partial<FormData>) {
  const payload = {
    client: form.codigoCliente,
    campaign: form.codigoCampana,
    to: form.email,
    tier: /gold/i.test(form.tipoCliente || "") ? "gold" : "blue",
    name: `${form.nombre || ""} ${form.apellido || ""}`.trim(),
    externalId: form.idExterno || "",
  };

  const res = await fetch(`${BACKEND}/api/wallet/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || data.message || `HTTP ${res.status}`);
  }
  return data; // { ok:true, smartUrl:"..." }
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
      const res = await fetch(`${API_BASE}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoCliente),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
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
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl mb-4">Perfil</h1>
      <div className="bg-white p-6 rounded shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nombre</Label>
            <Input name="nombre" value={formData.nombre} onChange={handleChange} />
          </div>
          <div>
            <Label>Apellido</Label>
            <Input name="apellido" value={formData.apellido} onChange={handleChange} />
          </div>
          <div>
            <Label>Fecha de nacimiento</Label>
            <Input
              type="date"
              name="fechaNacimiento"
              value={formData.fechaNacimiento}
              onChange={handleChange}
            />
          </div>
          <div>
            <Label>Código del cliente</Label>
            <Input
              name="codigoCliente"
              value={formData.codigoCliente}
              onChange={handleChange}
            />
          </div>

          <div>
            <Label>Código de la campaña</Label>
            <Input
              name="codigoCampana"
              value={formData.codigoCampana}
              onChange={handleChange}
            />
          </div>

          <div>
            <Label>Tipo de cliente</Label>
            <select
              name="tipoCliente"
              value={formData.tipoCliente}
              onChange={(e) => {
                const tipo = e.target.value;
                const next = { ...formData, tipoCliente: tipo };
                setFormData(next);
                setProfileData(next);
              }}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="">Selecciona un tipo</option>
              {TIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Email</Label>
            <Input name="email" value={formData.email} onChange={handleChange} />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input name="telefono" value={formData.telefono} onChange={handleChange} />
          </div>
          <div className="w-full">
            <Label className="mb-1 block">Género</Label>
            <select
              name="genero"
              value={formData.genero}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecciona</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div>
            <Label>Puntos</Label>
            <Input name="puntos" value={formData.puntos} onChange={handleChange} />
          </div>
          {/* ID Externo no se muestra en el formulario (es un identificador primario interno) */}
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Regresar
          </Button>
          <div className="flex gap-4">
            <Button onClick={handleGuardar}>Guardar</Button>
            <Button onClick={handleAdvance}>Avanzar</Button>
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
