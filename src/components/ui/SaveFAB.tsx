// src/components/ui/SaveFAB.tsx
import { Save } from "lucide-react";

export default function SaveFAB() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("designer:save"))}
      className="fixed bottom-6 right-6 w-12 h-12 rounded-xl grid place-items-center bg-white border shadow hover:bg-slate-50"
      title="Save"
    >
      <Save className="w-5 h-5 text-slate-700" />
    </button>
  );
}
