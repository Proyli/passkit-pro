// src/pages/Designer/components/LeftRail.tsx
import { Link, useLocation } from "react-router-dom";
import { Chrome, Apple, Table2, Settings, Shield, Palette, Save } from "lucide-react";
import { Button } from "@/components/ui/button"; // Botón reutilizable

const items = [
  { to: "/designer", icon: Chrome, label: "Google" },
  { to: "/designer/apple", icon: Apple, label: "Apple" },
  { to: "/designer/data-fields", icon: Table2, label: "Data" },
  { to: "/designer/settings", icon: Settings, label: "Settings" },
  { to: "#", icon: Shield, label: "Security" },
  { to: "#", icon: Palette, label: "Theme" },
];

export default function LeftRail() {
  const { pathname } = useLocation();

  return (
    <aside className="w-16 shrink-0 rounded-2xl border bg-white p-2 flex flex-col items-center gap-2">
      {items.map(({ to, icon: Icon, label }) => {
        const active = pathname === to;
        return (
          <Link key={to} to={to} title={label} className="w-full">
            <div
              className={`flex h-10 w-full items-center justify-center rounded-lg border transition
                ${active
                  ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
            >
              <Icon className="h-5 w-5" />
            </div>
          </Link>
        );
      })}

      <div className="mt-auto w-full">
        <Button className="w-full gap-2" variant="secondary">
          <Save className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
