import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, Filter as FilterIcon, X, ArrowLeft, Plus } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

/* ================== Tipos ================== */
type Estado = "active" | "inactive" | "expired";

interface Pass {
  id: string;
  title: string;
  description: string;
  type: "coupon" | "loyalty" | "event" | string;
  estado: Estado;
  createdAt: string;
  backgroundColor: string;
  textColor: string;
  scans: number;
}

/* ================== Helpers ================== */
const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  `http://${location.hostname}:3900/api`;

const readErrorMessage = (err: any) => {
  if (err?.response?.data) {
    if (typeof err.response.data === "string") return err.response.data;
    if (typeof err.response.data.message === "string") return err.response.data.message;
    try { return JSON.stringify(err.response.data); } catch {}
  }
  return err?.message || "Error desconocido";
};

const normalizeEstado = (x: any): Estado => {
  const v = String(x ?? "").toLowerCase();
  if (v === "expired") return "expired";
  if (v === "inactive" || v === "disabled") return "inactive";
  return "active";
};

const normalizePass = (raw: any): Pass => ({
  id: String(raw?.id ?? raw?.passId ?? raw?.uuid ?? Math.random().toString(36).slice(2, 10)),
  title: raw?.title ?? raw?.name ?? "Untitled",
  description: raw?.description ?? "",
  type: raw?.type ?? raw?.passType ?? "loyalty",
  estado: normalizeEstado(raw?.estado ?? raw?.status),
  createdAt: raw?.createdAt ?? raw?.created_at ?? raw?.dateCreated ?? new Date().toISOString(),
  // Detect tier from member or raw fields to derive color if not provided
  backgroundColor: (function(){
    if (raw?.backgroundColor) return raw.backgroundColor;
    if (raw?.bgColor) return raw.bgColor;
    // derive tier from member fields or campaign codes (tolerant)
    const tierFromMember = String(raw?.member?.tipoCliente || raw?.member?.tier || raw?.tipoCliente || raw?.tier || "");
    const campaign = String(raw?.member?.codigoCampana || raw?.member?.codigoCampaña || raw?.campaignCode || "");
    const probe = (tierFromMember + " " + campaign).toLowerCase();

    // Priority: explicit gold/silver/bronze words, then numeric rules (15% -> gold, 5% -> blue)
    if (/gold/.test(probe)) return "#DAA520"; // GOLD
    if (/silver/.test(probe)) return "#9CA3AF"; // SILVER
    if (/bronze|bronce/.test(probe)) return "#CD7F32"; // BRONZE

    // numeric-based mapping (campaign names like 'gold_15', 'blue_5', or tiers like '15%')
    if (/\b15\b|15%|_15|15\D|\b15\z/.test(probe)) return "#DAA520"; // treat 15 as gold
    if (/\b5\b|5%|_5|\b05\b/.test(probe)) return "#2350C6"; // treat 5 as blue

    return "#2350C6"; // default BLUE
  })(),
  textColor: raw?.textColor ?? raw?.fgColor ?? "#FFFFFF",
  scans: Number(raw?.scans ?? 0),
});

const toArray = (data: any): Pass[] => {
  const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  return arr.map(normalizePass);
};

const safeShortDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const statusColors: Record<Estado, string> = {
  active: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-800",
  inactive: "bg-gray-100 text-gray-800",
};

const statusDotColors: Record<Estado, string> = {
  active: "bg-green-500",
  expired: "bg-red-500",
  inactive: "bg-gray-500",
};

const typeColors: Record<string, string> = {
  coupon: "bg-gray-200 text-gray-800",
  loyalty: "bg-blue-200 text-blue-800",
  event: "bg-purple-200 text-purple-800",
};

/* ================== Component ================== */
const PassList: React.FC = () => {
  const nav = useNavigate();
  const { toast } = useToast();

  const [passes, setPasses] = useState<Pass[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // ------- Filtro de búsqueda -------
  type PassFieldKey = "title" | "description" | "type" | "estado";
  const PASS_FIELD_LABEL: Record<PassFieldKey, string> = {
    title: "Title",
    description: "Description",
    type: "Type",
    estado: "Status",
  };
  const PASS_FIELD_KEYS: PassFieldKey[] = ["title", "description", "type", "estado"];
  const DEFAULT_PASS_FIELDS: PassFieldKey[] = ["title", "description", "type"];

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"contains" | "starts" | "exact">("contains");
  const [searchFields, setSearchFields] = useState<Record<PassFieldKey, boolean>>(
    Object.fromEntries(PASS_FIELD_KEYS.map((k) => [k, DEFAULT_PASS_FIELDS.includes(k)])) as Record<
      PassFieldKey,
      boolean
    >
  );

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 220);
    return () => clearTimeout(id);
  }, [query]);

  const activePassFields = PASS_FIELD_KEYS.filter((k) => searchFields[k]);
  const norm = (v: string) => String(v || "").toLowerCase().replace(/\s+/g, " ").trim();

  const displayedPasses = useMemo(() => {
    if (!debouncedQuery) return passes;
    const q = norm(debouncedQuery);
    const match = {
      contains: (v: string) => v.includes(q),
      starts: (v: string) => v.startsWith(q),
      exact: (v: string) => v === q,
    }[searchMode];
    return passes.filter((p) => activePassFields.some((key) => match(norm((p as any)[key]))));
  }, [passes, debouncedQuery, searchMode, searchFields]);

  // ------- Data load -------
  useEffect(() => {
    axios
      .get(`${API_BASE}/passes`)
      .then((res) => setPasses(toArray(res.data)))
      .catch((err) => {
        console.error("Error al obtener pases:", err);
        toast({ title: "No se pudieron cargar los pases", variant: "destructive" });
        setPasses([]);
      });
  }, [toast]);

  // ------- UI handlers -------
  const toggleMenu = (id: string) => setOpenMenuId(openMenuId === id ? null : id);

  const handleSaveWallet = (pass: Pass, e: React.MouseEvent) => {
    e.stopPropagation();
    nav(`/passes/${pass.id}`); // aquí implementarás Add-to-Wallet en el detalle
  };

  const handleSendEmail = (pass: Pass, e: React.MouseEvent) => {
    e.stopPropagation();
    toast({
      title: "Próximamente",
      description: "El envío por email se gestiona desde el detalle del pase.",
    });
    nav(`/passes/${pass.id}`);
  };

  /* ================== Render ================== */
  return (
    <main className="container mx-auto px-6 py-6 pb-10">
      {/* Header de página */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Passes</h1>
          <p className="text-sm text-muted-foreground">Manage and distribute your digital passes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <Button
            onClick={() => nav("/passes/new")}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Pass
          </Button>
        </div>
      </div>

      {/* Toolbar: search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search passes..."
            className="pl-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
              aria-label="Clear"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="outline" className="gap-2">
              <FilterIcon className="h-4 w-4" />
              Filter
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="bg-white rounded-md shadow-md border p-2 w-64"
            loop
          >
            <div className="px-2 pb-2 text-xs text-muted-foreground">Buscar en los campos</div>
            {PASS_FIELD_KEYS.map((key) => (
              <DropdownMenu.CheckboxItem
                key={key}
                checked={searchFields[key]}
                onCheckedChange={(checked) =>
                  setSearchFields((prev) => ({ ...prev, [key]: !!checked }))
                }
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-gray-100 data-[state=checked]:bg-blue-100 data-[state=checked]:text-blue-700"
              >
                {PASS_FIELD_LABEL[key]}
              </DropdownMenu.CheckboxItem>
            ))}

            <DropdownMenu.Separator />

            <div className="px-2 py-1 text-xs text-muted-foreground">Coincidencia</div>
            <DropdownMenu.RadioGroup value={searchMode} onValueChange={(v) => setSearchMode(v as any)}>
              <DropdownMenu.RadioItem value="contains" className="px-2 py-1.5 text-sm">
                Contiene
              </DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="starts" className="px-2 py-1.5 text-sm">
                Empieza con
              </DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="exact" className="px-2 py-1.5 text-sm">
                Exacta
              </DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>

            <DropdownMenu.Separator />

            <DropdownMenu.Item onClick={() => setQuery("")} className="px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100">
              Limpiar búsqueda
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onClick={() =>
                setSearchFields(
                  Object.fromEntries(
                    PASS_FIELD_KEYS.map((k) => [k, DEFAULT_PASS_FIELDS.includes(k)])
                  ) as Record<PassFieldKey, boolean>
                )
              }
              className="px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100"
            >
              Reset campos
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {displayedPasses.length === 0 && (
          <div className="col-span-full rounded-xl border p-4 text-sm text-slate-500 bg-slate-50">
            {query ? "No hay resultados para la búsqueda." : "No hay pases asignados aún."}
          </div>
        )}

        {displayedPasses.map((pass) => (
          <div
            key={pass.id}
            className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3 relative"
          >
            {/* Menú de acciones (placeholder) */}
            <div className="absolute top-2 right-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpenMenuId(openMenuId === pass.id ? null : pass.id)}
                aria-label="acciones"
              >
                ⋮
              </Button>
              {openMenuId === pass.id && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 shadow-md rounded-lg z-50">
                  <ul className="text-sm text-gray-700">
                    <li className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => nav(`/passes/${pass.id}`)}>
                      ✏️ Edit
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Encabezado */}
            <div className="flex items-start justify-between gap-2 pr-8">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-base font-semibold leading-5 line-clamp-1">
                  {(() => {
                    const t = String(pass.title || "").toLowerCase();
                    const bg = String(pass.backgroundColor || "").toLowerCase();
                    const titleSuggestsGold = t.includes("gold") || /\b15\b|15%/.test(t);
                    const titleSuggestsBlue = t.includes("blue") || /\b5\b|5%/.test(t);
                    if (titleSuggestsGold) return "Gold 15%";
                    if (titleSuggestsBlue) return "Blue 5%";
                    if (bg.includes("daa520")) return "Gold 15%";
                    if (bg.includes("007aff") || bg.includes("2350c6")) return "Blue 5%";
                    return pass.title;
                  })()}
                </h3>
                {(() => {
                  const t = String(pass.title || "").toLowerCase();
                  const bg = String(pass.backgroundColor || "").toLowerCase();
                  const titleSuggestsGold = t.includes("gold") || /\b15\b|15%/.test(t);
                  const titleSuggestsBlue = t.includes("blue") || /\b5\b|5%/.test(t);
                  const isGold = titleSuggestsGold || bg.includes("daa520");
                  const isBlue = !isGold && (titleSuggestsBlue || bg.includes("007aff") || bg.includes("2350c6"));
                  if (isGold)
                    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">Gold 15%</span>;
                  if (isBlue)
                    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 shrink-0">Blue 5%</span>;
                  return null;
                })()}
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${typeColors[pass.type] ?? "bg-gray-200 text-gray-800"}`}>
                {pass.type}
              </span>
            </div>

            {/* Descripción */}
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-5 line-clamp-2">
              {pass.description || "Información del cliente"}
            </p>

            {/* Meta */}
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              <span className="mr-3">Created: {safeShortDate(pass.createdAt)}</span>
              <span>Scans: {pass.scans ?? 0}</span>
            </div>

            {/* Estado + Acciones */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${statusDotColors[pass.estado]}`}></span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusColors[pass.estado]}`}>
                  {pass.estado}
                </span>
              </div>

              <div className="flex gap-2">
                <Button size="sm" className="h-9 rounded-xl font-semibold" onClick={(e) => handleSaveWallet(pass, e)}>
                  Guardar en la billetera
                </Button>
                <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={(e) => handleSendEmail(pass, e)}>
                  Enviar por email
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};

export default PassList;
