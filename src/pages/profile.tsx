import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useProfileStore } from "@/store/profileStore";

const Profile = () => {
  const navigate = useNavigate();
  const { profileData, setProfileData, clearProfileData } = useProfileStore();
  
  const [formData, setFormData] = useState({
  nombre: "",
  apellido: "",
  fechaNacimiento: "",
  codigoCliente: "",
  codigoCampaña: "",
  tipoCliente: "",
  email: "",
  telefono: "",
  genero: "",
  puntos: "",
  idExterno: "",
  ...profileData // sobrescribe si ya hay datos guardados
});


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const newData = { ...formData, [e.target.name]: e.target.value };
    setFormData(newData);
    setProfileData(newData);
  };

 const handleGuardar = async () => {
  // Desestructuramos solo los campos que realmente deben ir al backend
  const {
    nombre,
    apellido,
    fechaNacimiento,
    codigoCliente,
    codigoCampaña,
    tipoCliente,
    email,
    telefono,
    genero,
    puntos
  } = formData;

  const nuevoCliente = {
    nombre,
    apellido,
    fechaNacimiento,
    codigoCliente,
    codigoCampaña,
    tipoCliente,
    email,
    telefono,
    genero,
    puntos: parseInt(puntos) || 0, // Convertir puntos a número entero
  };

  try {
    const res = await fetch("http://localhost:3900/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevoCliente),
    });

    const data = await res.json();
    console.log("✅ Cliente guardado:", data);
    alert("Cliente guardado en MySQL con éxito");

    // Limpiar datos del formulario
    clearProfileData();
    setFormData({
      nombre: "",
      apellido: "",
      fechaNacimiento: "",
      codigoCliente: "",
      codigoCampaña: "",
      tipoCliente: "",
      email: "",
      telefono: "",
      genero: "",
      puntos: "",
      idExterno: "" // Este campo solo se usa para mostrar, no se envía
    });

    // Redirigir a /members para ver el nuevo registro
    navigate("/members", { state: { updated: true } });

  } catch (err) {
    console.error("❌ Error al guardar:", err);
    alert("Hubo un error al guardar el cliente");
  }
};


  const handleAdvance = () => {
    navigate("/members");
  };

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
            <Input type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} />
          </div>
          <div>
            <Label>Código del cliente</Label>
            <Input name="codigoCliente" value={formData.codigoCliente} onChange={handleChange} />
          </div>
          <div>
            <Label>Código de la campaña</Label>
            <Input name="codigoCampaña" value={formData.codigoCampaña} onChange={handleChange} />
          </div>
          <div>
            <Label>Tipo de cliente</Label>
            <select
              name="tipoCliente"
              value={formData.tipoCliente}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="">Selecciona un tipo</option>
              <option value="Black">Black</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Bronze">Bronze</option>
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
          <Input
             name="idExterno"
            value={formData.idExterno}
            onChange={handleChange}
            readOnly
            className="bg-gray-100 cursor-not-allowed"
            />
          </div>

        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Regresar</Button>
          <div className="flex gap-4">
            <Button onClick={handleGuardar}>Guardar</Button>
            <Button onClick={handleAdvance}>Avanzar</Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Profile;
