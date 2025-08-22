
import { Input } from "@/components/ui/input";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Search, Filter as FilterIcon, X } from "lucide-react";

import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { DuplicatePassModal } from "@/components/modals/DuplicatePassModal";

// === Base de API robusta ===
const API_BASE_PASSES =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  `http://${location.hostname}:3900/api`;

// Lee errores aunque el servidor devuelva HTML
const readErrorMessage = (err: any) => {
  if (err?.response?.data) {
    if (typeof err.response.data === "string") return err.response.data;
    if (typeof err.response.data.message === "string") return err.response.data.message;
    try { return JSON.stringify(err.response.data); } catch {}
  }
  if (err?.message) return err.message;
  return "Error desconocido";
};


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

// --- Normalizadores seguros ---
const normalizeEstado = (x: any): Estado => {
  const v = String(x ?? "").toLowerCase();
  if (v === "expired") return "expired";
  if (v === "inactive" || v === "disabled") return "inactive";
  return "active";
};

const normalizePass = (raw: any): Pass => ({
  id:
    String(
      raw?.id ??
        raw?.passId ??
        raw?.uuid ??
        Math.random().toString(36).slice(2, 10)
    ),
  title: raw?.title ?? raw?.name ?? "Untitled",
  description: raw?.description ?? "",
  type: raw?.type ?? raw?.passType ?? "loyalty",
  estado: normalizeEstado(raw?.estado ?? raw?.status),
  createdAt:
    raw?.createdAt ?? raw?.created_at ?? raw?.dateCreated ?? new Date().toISOString(),
  backgroundColor: raw?.backgroundColor ?? raw?.bgColor ?? "#ffffff",
  textColor: raw?.textColor ?? raw?.fgColor ?? "#000000",
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

const PassList: React.FC = () => {
  const [passes, setPasses] = useState<Pass[]>([]);
  // --- 🔎 Filtro (para PASSES) ---
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
const [searchMode, setSearchMode] =
  useState<"contains" | "starts" | "exact">("contains");
const [searchFields, setSearchFields] = useState<Record<PassFieldKey, boolean>>(
  Object.fromEntries(
    PASS_FIELD_KEYS.map((k) => [k, DEFAULT_PASS_FIELDS.includes(k)])
  ) as Record<PassFieldKey, boolean>
);

// debounce para no filtrar en cada tecla
useEffect(() => {
  const id = setTimeout(() => setDebouncedQuery(query.trim()), 220);
  return () => clearTimeout(id);
}, [query]);

const activePassFields = PASS_FIELD_KEYS.filter((k) => searchFields[k]);

// normalizador
const norm = (v: string) =>
  String(v || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Lista filtrada a partir de `passes`
const displayedPasses = useMemo(() => {
  if (!debouncedQuery) return passes;
  const q = norm(debouncedQuery);

  const match = {
    contains: (v: string) => v.includes(q),
    starts: (v: string) => v.startsWith(q),
    exact: (v: string) => v === q,
  }[searchMode];

  return passes.filter((p) =>
    activePassFields.some((key) => match(norm((p as any)[key])))
  );
}, [passes, debouncedQuery, searchMode, searchFields]);


  const [isDuplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState<Pass | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const toggleMenu = (id: string) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const handleOpenDuplicate = (pass: Pass) => {
    setSelectedPass(pass);
    setDuplicateModalOpen(true);
    setOpenMenuId(null);
  };

  const handleDuplicate = async (
  duplicatedData: Omit<Pass, "id" | "createdAt">
) => {
  // Base de API robusta (usa .env si existe; si no, el mismo host del front)
  const base =
    (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
    `http://${location.hostname}:3900/api`;

  const url = `${base}/passes`;

  // 1) Payload en español (muchos de tus endpoints usan "estado")
  const payloadES = {
    title: duplicatedData.title,
    description: duplicatedData.description,
    type: duplicatedData.type,
    estado: (duplicatedData as any).estado ?? "active",
    backgroundColor: duplicatedData.backgroundColor ?? "#ffffff",
    textColor: duplicatedData.textColor ?? "#000000",
    scans: Number((duplicatedData as any).scans ?? 0),
  };

  // 2) Payload alterno en inglés (algunos backends usan "status")
  const payloadEN = {
    title: duplicatedData.title,
    description: duplicatedData.description,
    type: duplicatedData.type,
    status: (duplicatedData as any).estado ?? "active",
    backgroundColor: duplicatedData.backgroundColor ?? "#ffffff",
    textColor: duplicatedData.textColor ?? "#000000",
    scans: Number((duplicatedData as any).scans ?? 0),
  };

  // Helper para leer mensajes de error aunque el servidor devuelva HTML
  const errorMsg = (err: any) => {
    if (err?.response?.data) {
      if (typeof err.response.data === "string") return err.response.data;
      if (err.response.data?.message) return err.response.data.message;
      try {
        return JSON.stringify(err.response.data);
      } catch {}
    }
    return err?.message || "Error desconocido";
  };

  try {
    // Primer intento: ES
    const res1 = await axios.post(url, payloadES);
    const added1 = normalizePass(res1.data);
    setPasses((prev) => [...prev, added1]);
    setDuplicateModalOpen(false);
    setSelectedPass(null);
  } catch (err1: any) {
    try {
      // Segundo intento: EN
      const res2 = await axios.post(url, payloadEN);
      const added2 = normalizePass(res2.data);
      setPasses((prev) => [...prev, added2]);
      setDuplicateModalOpen(false);
      setSelectedPass(null);
    } catch (err2: any) {
      console.error("Error al duplicar pase:", err1, err2);
      alert(`No se pudo guardar el duplicado: ${errorMsg(err2) || errorMsg(err1)}`);
    }
  }
};


  useEffect(() => {
    const url = `${import.meta.env.VITE_API_BASE_URL}/passes`;
    axios
      .get(url)
      .then((res) => {
        // Normaliza cualquier forma de respuesta a []
        const list = toArray(res.data);
        setPasses(list);
      })
      .catch((err) => {
        console.error("Error al obtener pases:", err);
        setPasses([]); // asegura arreglo para que .map no reviente
      });
  }, []);

  return (
  <div className="mt-6 space-y-4">
    {/* ── Toolbar: Search + Filter ───────────────────────────── */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Search input */}
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

      {/* Botón FILTER con Dropdown */}
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
          <div className="px-2 pb-2 text-xs text-muted-foreground">
            Buscar en los campos
          </div>

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
          <DropdownMenu.RadioGroup
            value={searchMode}
            onValueChange={(v) => setSearchMode(v as any)}
          >
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

          <DropdownMenu.Item
            onClick={() => setQuery("")}
            className="px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100"
          >
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

    {/* ── Grid de tarjetas ───────────────────────────────────── */}
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {displayedPasses.length === 0 && (
        <div className="col-span-full rounded-xl border p-4 text-sm text-slate-500 bg-slate-50">
          {query ? "No hay resultados para la búsqueda." : "No hay pases asignados aún."}
        </div>
      )}

      {displayedPasses.map((pass) => (
        <div
          key={pass.id}
          className="bg-white rounded-2xl shadow-md p-6 flex flex-col justify-between relative"
        >
          {/* Menú de acciones */}
          <div className="absolute top-4 right-4">
            <Button variant="ghost" className="text-xl" onClick={() => toggleMenu(pass.id)}>
              ⋮
            </Button>
            {openMenuId === pass.id && (
              <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 shadow-md rounded-lg z-50">
                <ul className="text-sm text-gray-700">
                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">✏️ Edit</li>
                  <li
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleOpenDuplicate(pass)}
                  >
                    📄 Duplicate
                  </li>
                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">🔳 QR Code</li>
                  <li className="px-4 py-2 text-red-600 hover:bg-red-50 cursor-pointer">🗑️ Delete</li>
                </ul>
              </div>
            )}
          </div>

          {/* Contenido del pase */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-800">{pass.title}</h3>
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${typeColors[pass.type] ?? "bg-gray-200 text-gray-800"}`}>
                {pass.type}
              </span>
            </div>
            <p className="text-gray-600 mb-3">{pass.description}</p>
            <p className="text-sm text-gray-500">
              Created: {safeShortDate(pass.createdAt)} &nbsp; Scans: {pass.scans ?? 0}
            </p>
          </div>

          {/* Estado y botones */}
          <div className="flex items-center justify-between mt-5">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${statusDotColors[pass.estado]}`}></span>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full capitalize ${statusColors[pass.estado]}`}>
                {pass.estado}
              </span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="rounded-lg">Apple Wallet</Button>
              <Button variant="outline" className="rounded-lg">Google Pay</Button>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Modal de duplicar */}
    {selectedPass && (
      <DuplicatePassModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setDuplicateModalOpen(false)}
        passData={selectedPass}
        onDuplicate={handleDuplicate}
      />
    )}
  </div>
);

};

export default PassList;
