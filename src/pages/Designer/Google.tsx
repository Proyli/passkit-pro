// src/pages/Designer/Google.tsx
// ✅ correcto
import SaveFloating from "@/components/ui/SaveFloating";
// (si el alias '@' diera lata: ../../components/ui/SaveFloating)


export default function DesignerGoogle() {
  return (
    <div className="p-6 grid grid-cols-[minmax(640px,1fr),380px] gap-6">
      {/* Canvas */}
      <div className="rounded-2xl bg-white border p-6 flex items-start justify-center">
        {/* Aquí va tu PhoneFrame + PassCard (lo que ya tienes) */}
        <div className="w-[360px] rounded-[36px] border bg-black/90 shadow-2xl p-4">
          <div className="h-[640px] bg-slate-900 rounded-2xl flex items-center justify-center text-white">
            Preview Google
          </div>
        </div>
      </div>

      {/* Panel de propiedades */}
      <div className="rounded-2xl bg-white border p-4 space-y-4">
        <h3 className="font-semibold text-slate-800">Propiedades</h3>
        {/* Global props (título, tier, colores) y props del módulo seleccionado */}
        {/* Reutiliza tus inputs actuales */}
      </div>

      <SaveFloating />
    </div>
  );
}
