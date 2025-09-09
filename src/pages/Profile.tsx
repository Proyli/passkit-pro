import React, { useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useProfileStore } from "@/store/profileStore";

// === Tier options → mapean el select a codigoCampana ===
const TIER_OPTIONS = [
  { value: "blue",  label: "Blue 5%",  campaign: "blue_5"  },
  { value: "gold",  label: "Gold 15%", campaign: "gold_15" },
  { value: "silver",label: "Silver",   campaign: "blue_5"  }, // por ahora se comportan como blue
  { value: "bronze",label: "Bronze",   campaign: "blue_5"  },
];

const mapTierToCampaign = (v: string) =>
  TIER_OPTIONS.find(t => t.value === v)?.campaign ?? "";


// Carga diferida para que un error en PassList no rompa Profile
const PassList = lazy(() => import("./PassList"));

// Mantén strings en el formulario para no pelear con inputs controlados
type FormData = {
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  codigoCliente: string;
  codigoCampana: string;
  tipoCliente: string;
  email: string;
  telefono: string;
  genero: string;
  puntos: string;     // string en el form; se convierte a number al guardar
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

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { profileData, setProfileData, clearProfileData } = useProfileStore();

  // Inicializa SIEMPRE con un objeto completo
  const [formData, setFormData] = useState<FormData>({
    ...EMPTY_FORM,
    ...(profileData as Partial<FormData> | undefined),
  });

  // justo debajo de useState<FormData>(...)
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

  const newData = { ...formData, [name]: value };
  setFormData(newData);
  setProfileData(newData);
};


  const handleGuardar = async () => {
    const nuevoCliente = {
      ...formData,
      puntos: parseInt(formData.puntos || "0", 10) || 0,
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
      alert("Cliente guardado en MySQL con éxito");

      clearProfileData();
      setFormData(EMPTY_FORM);
      navigate("/members");
    } catch (err) {
      console.error("❌ Error al guardar:", err);
      alert("Hubo un error al guardar el cliente");
    }
  };

  const handleAdvance = () => navigate("/members");

  return (
    <div className="flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow p-6 space-y-6">
        <h2 className="text-2xl font-bold text-center">Perfil del Cliente</h2>

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
          {/* Código de la campaña */}
        <div>
          <Label>Código de la campaña</Label>
          <Input
            name="codigoCampana"
            value={formData.codigoCampana}
            onChange={handleChange}
            // opcional: placeholder="CP502"
          />
        </div>


          {/* Tipo de cliente */}
          <div>
            <Label>Tipo de cliente</Label>
            <select
              name="tipoCliente"
              value={formData.tipoCliente}
              onChange={(e) => {
                const tipo = e.target.value;
                // ✅ solo actualiza el tipo; NO modifica codigoCampana
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
          <div>
            <Label>ID Externo</Label>
            <Input name="idExterno" value={formData.idExterno} onChange={handleChange} />
          </div>
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

        <h2 className="text-xl font-semibold mt-8 mb-4">
          Pases digitales asignados
        </h2>
        <Suspense fallback={null}>
          <PassList />
        </Suspense>
      </div>
    </div>
  );
};

export default Profile;
