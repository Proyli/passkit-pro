// src/pages/PassesCreate.tsx
import { useNavigate } from "react-router-dom";
import CreatePassForm from "@/components/CreatePassForm";
import { Button } from "@/components/ui/button";


type CreatePassFormProps = {
  onCreated?: (id: string) => void;
  onCancel?: () => void;
  // Opcional: valores iniciales si tu form los soporta
  initialValues?: Partial<{
    title: string;
    description: string;
    type: "loyalty" | "coupon" | "event" | string;
    estado: "active" | "inactive" | "expired";
    backgroundColor: string;
    textColor: string;
  }>;
};

export default function PassesCreate() {
  const nav = useNavigate();

  // 👉 Al crear, vamos al detalle del pase
  const handleCreated: CreatePassFormProps["onCreated"] = (id) => {
    // fallback por si tu API devuelve otro campo
    const goId = id || "";
    nav(goId ? `/passes/${goId}` : "/passes");
  };

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_minmax(420px,520px)] gap-6">
      {/* Columna izquierda: acciones + formulario */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => nav("/passes")}>
            ← Back to Passes
          </Button>
        </div>

        {/* Tu formulario real */}
        <CreatePassForm
          onCreated={handleCreated}
          onCancel={() => nav("/passes")}
          initialValues={{
            title: "Sample Pass",
            description: "This is a sample pass description",
            type: "coupon",
            //estado: "active",
            backgroundColor: "#0ea5e9", // opcional
            textColor: "#ffffff",       // opcional
          }}
        />
      </div>

      {/* Columna derecha: panel de preview */}
      <div className="rounded-2xl bg-white shadow p-6">
        <div className="text-lg font-semibold mb-4">📱 Live Preview</div>
        {/* Si tienes un componente de preview, úsalo aquí.
            Ejemplo: <PassPreview formSelector="#create-pass-form" />
            O deja un placeholder visual por ahora. */}
        <div className="aspect-[9/16] w-full rounded-2xl border flex items-center justify-center text-sm text-gray-500">
          Live preview here
        </div>
      </div>
    </div>
  );
}
