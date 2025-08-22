// src/pages/Designer/index.tsx
import { Outlet } from "react-router-dom";
// ✅ ahora
import LeftRail from "./components/LeftRail";
import SaveFAB from "@/components/ui/SaveFAB";

export default function DesignerLayout() {
  return (
    <div className="min-h-screen grid grid-cols-[72px,1fr]">
      <LeftRail />
      <div className="bg-slate-50">
        <Outlet />
      </div>
    </div>
  );
}
