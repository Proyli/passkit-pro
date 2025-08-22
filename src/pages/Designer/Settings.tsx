// src/pages/Designer/Settings.tsx
import { useState } from "react";

export default function DesignerSettings() {
  const [tab, setTab] = useState<"details"|"google"|"apple"|"template"|"class">("details");

  return (
    <div className="p-6 flex justify-center">
      <div className="w-[920px] rounded-2xl border bg-white shadow">
        <div className="p-4 border-b text-lg font-semibold">Design Settings</div>

        <div className="px-4 pt-2">
          <div className="flex gap-6 text-sm">
            {["DETAILS","GOOGLE SETTINGS","APPLE SETTINGS","TEMPLATE","GOOGLE CLASS"].map((t, i) => {
              const key = (["details","google","apple","template","class"] as const)[i];
              const active = (tab === key);
              return (
                <button key={t} onClick={() => setTab(key)} className={`pb-2 ${active ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500"}`}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* DETAILS content */}
        {tab === "details" && (
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-600">Organization Name</label>
              <input className="w-full h-11 border rounded-md px-3" defaultValue="Distribuidora Alcazarén, S. A." />
            </div>
            <div>
              <label className="text-sm text-slate-600">Default Language</label>
              <select className="w-full h-11 border rounded-md px-3">
                <option>Español (Latin America)</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-600">Template Name</label>
              <input className="w-full h-11 border rounded-md px-3" defaultValue="Programa de Lealtad" />
            </div>
            <div>
              <label className="text-sm text-slate-600">Description</label>
              <input className="w-full h-11 border rounded-md px-3" defaultValue="Tu tarjeta especial" />
            </div>

            <div className="col-span-2 border rounded-xl p-4 mt-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">Allow Sharing</span>
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-indigo-600" />
              </div>
              <div className="mt-3">
                <label className="text-sm text-slate-600">Sharing Url</label>
                <input className="w-full h-11 border rounded-md px-3" placeholder="https://…" />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                “Share Pass” button in Apple Wallet will trigger this URL
              </p>
            </div>
          </div>
        )}

        <div className="p-4 border-t flex justify-end gap-2">
          <button className="px-4 py-2 rounded-lg border">CANCEL</button>
          <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white">DONE</button>
        </div>
      </div>
    </div>
  );
}
