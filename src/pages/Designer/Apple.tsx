// src/pages/Designer/Apple.tsx (misma estructura, cambia el título/preview)
export default function DesignerApple() {
  return (
    <div className="p-6 grid grid-cols-[minmax(640px,1fr),380px] gap-6">
      <div className="rounded-2xl bg-white border p-6 flex items-start justify-center">
        <div className="w-[360px] rounded-[36px] border bg-black/90 shadow-2xl p-4">
          <div className="h-[640px] bg-slate-900 rounded-2xl flex items-center justify-center text-white">
            Preview Apple
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-white border p-4 space-y-4">
        <h3 className="font-semibold text-slate-800">Propiedades (Apple)</h3>
      </div>
    </div>
  );
}
