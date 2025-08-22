// src/pages/Designer/Register.tsx
export default function DesignerRegister() {
  return (
    <div className="p-6 flex justify-center">
      <div className="w-[720px] rounded-2xl border bg-white p-6 shadow-sm">
        <div className="h-24 bg-slate-800 rounded-t-xl -m-6 mb-6" />
        <h2 className="text-2xl font-semibold mb-2 text-center">Register Below</h2>
        <p className="text-slate-600 text-center mb-6">
          Necesitamos que ingreses información que garantice el acceso a tu tarjeta de lealtad.
        </p>
        <div className="border rounded-xl p-6 bg-slate-50">
          <label className="block text-sm text-slate-600 mb-1">Name</label>
          <input className="w-full h-11 rounded-md border px-3" placeholder="[displayName]" />
        </div>

        <div className="flex justify-center mt-6">
          <button className="text-indigo-600 text-sm hover:underline">ADD FOOTER TEXT</button>
        </div>
        <div className="flex justify-center mt-4">
          <button className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">REGISTER</button>
        </div>
      </div>
    </div>
  );
}
