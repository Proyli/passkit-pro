// src/pages/Designer/DesignerPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom"; // si no usas Router, ver fallback más abajo

// Tipos
type ModuleType = "text" | "barcode" | "image";

type BaseModule = {
  id: string;
  type: ModuleType;
  x: number;
  y: number;
  w: number;
};

type TextModule = BaseModule & {
  type: "text";
  value: string;
  size: number;
  align: "left" | "center" | "right";
  color: string;
};

type BarcodeModule = BaseModule & {
  type: "barcode";
  value: string;
  height: number;
};

type ImageModule = BaseModule & {
  type: "image";
  url: string;
  h: number;
};

type PassModule = TextModule | BarcodeModule | ImageModule;

type PassDesign = {
  backgroundColor: string;
  textColor: string;
  title: string;
  modules: PassModule[];
  tier: string;
};

const phoneRatio = 9 / 19.5;
const seedId = () => Math.random().toString(36).slice(2, 9);

export default function DesignerPage() {
  const navigate = useNavigate?.(); // puede ser undefined si no hay router
  const API_BASE =
    (import.meta as any).env?.VITE_API_BASE ??
    `${window.location.protocol}//${window.location.hostname}:3900`;

  // refs para abrir el color picker
  const bgRef = useRef<HTMLInputElement | null>(null);
  const fgRef = useRef<HTMLInputElement | null>(null);

  const [design, setDesign] = useState<PassDesign>({
    backgroundColor: "#0a4a76",
    textColor: "#ffffff",
    title: "Mi Pase",
    tier: "base",
    modules: [
      {
        id: seedId(),
        type: "text",
        value: "Lealtad Alcazarén",
        size: 18,
        color: "#ffffff",
        align: "left",
        x: 8,
        y: 10,
        w: 84,
      } as TextModule,
      {
        id: seedId(),
        type: "barcode",
        value: "{pid}",
        height: 48,
        x: 8,
        y: 70,
        w: 84,
      } as BarcodeModule,
    ],
  });

  const [lastSaved, setLastSaved] = useState<PassDesign | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => design.modules.find((m) => m.id === selectedId) ?? null,
    [design.modules, selectedId]
  );

  // Cargar último diseño guardado en localStorage (fallback)
  useEffect(() => {
    const raw = localStorage.getItem("designer:last");
    if (raw) {
      try {
        const parsed: PassDesign = JSON.parse(raw);
        setDesign(parsed);
        setLastSaved(parsed);
      } catch {}
    }
  }, []);

  // Helpers módulos
  const updateModule = <T extends Partial<PassModule>>(patch: T) => {
    if (!selected) return;
    setDesign((d) => ({
      ...d,
      modules: d.modules.map((m) =>
        m.id === selected.id ? ({ ...m, ...patch } as PassModule) : m
      ),
    }));
  };

  const addModule = (type: ModuleType) => {
    const base: BaseModule = { id: seedId(), type, x: 10, y: 20, w: 80 };
    let mod: PassModule;
    if (type === "text") {
      mod = {
        ...(base as any),
        value: "Nuevo texto",
        size: 16,
        color: "#ffffff",
        align: "left",
      } as TextModule;
    } else if (type === "barcode") {
      mod = { ...(base as any), value: "1234567890", height: 44 } as BarcodeModule;
    } else {
      mod = {
        ...(base as any),
        url: "https://via.placeholder.com/300x100",
        h: 56,
      } as ImageModule;
    }
    setDesign((d) => ({ ...d, modules: [...d.modules, mod] }));
    setSelectedId(mod.id);
  };

  const deleteSelected = () => {
    if (!selected) return;
    setDesign((d) => ({
      ...d,
      modules: d.modules.filter((m) => m.id !== selected.id),
    }));
    setSelectedId(null);
  };

// fuera del componente (o arriba):
type DesignPayload = {
  title: string;
  tier: string;
  backgroundColor: string;
  textColor: string;
  data: PassModule[]; // lo que espera tu API
};

// ...

// dentro del componente:
const saveDesign = async () => {
  // payload para la API (nota: usa `data`)
  const payload: DesignPayload = {
    title: design.title || "Untitled",
    tier: design.tier || "base",
    backgroundColor: design.backgroundColor,
    textColor: design.textColor,
    data: design.modules,
  };

  try {
    const res = await fetch(`${API_BASE}/api/designs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${msg}`);
    }

    // Puedes leer el id/fechas si las usas:
    // const savedFromServer = await res.json();

    // Para poder "Cancelar cambios", conserva el último diseño tal como lo edita el cliente
    setLastSaved(design);
    alert("✅ Diseño guardado en el servidor.");
  } catch (err) {
    console.error("saveDesign error:", err);
    // Fallback local/offline: guarda el diseño del cliente (no el payload)
    localStorage.setItem("designer:last", JSON.stringify(design));
    setLastSaved(design);
    alert("💾 No se pudo contactar /api/designs. Guardado localmente.");
  }
};


  const cancelChanges = () => {
    if (lastSaved) {
      setDesign(lastSaved);
      setSelectedId(null);
      alert("↩️ Cambios descartados.");
    } else {
      alert("No hay un diseño guardado previamente.");
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(design, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `design-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = () =>
    new Promise<void>((resolve) => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "application/json";
      inp.onchange = () => {
        const file = inp.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(String(reader.result));
            setDesign(parsed);
            resolve();
          } catch {
            alert("Archivo inválido");
          }
        };
        reader.readAsText(file);
      };
      inp.click();
    });

  // Navegación
  const goDashboard = () => {
    if (navigate) navigate("/dashboard");
    else window.location.href = "/dashboard";
  };

  const goDataFields = () => {
    if (navigate) navigate("/designer/data-fields");
    else window.location.href = "/designer/data-fields";
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={goDashboard}
            className="px-3 py-2 rounded-lg border bg-slate-50 hover:bg-slate-100"
          >
            ← Back to Dashboard
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={cancelChanges}
            className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={saveDesign}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Guardar diseño
          </button>
          <button
            onClick={exportJSON}
            className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50"
            title="Exportar JSON"
          >
            Exportar
          </button>
          <button
            onClick={importJSON}
            className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50"
            title="Importar JSON"
          >
            Importar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[72px,1fr,360px] gap-4 p-6">
        {/* Left rail */}
        <div className="rounded-2xl bg-white border p-2 flex flex-col items-center gap-2">
          <ToolButton label="Text" onClick={() => addModule("text")} />
          <ToolButton label="Barcode" onClick={() => addModule("barcode")} />
          <ToolButton label="Image" onClick={() => addModule("image")} />
          <div className="w-full h-px bg-slate-200 my-2" />
          <ToolButton label="Data Fields" onClick={goDataFields} />
          <ToolButton label="Eliminar" danger onClick={deleteSelected} />
        </div>

        {/* Canvas */}
        <div className="rounded-2xl bg-white border p-6 flex items-start justify-center">
          <PhoneFrame>
            <PassCard
              design={design}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </PhoneFrame>
        </div>

        {/* Right panel */}
        <div className="rounded-2xl bg-white border p-4 space-y-4">
          <h3 className="font-semibold text-slate-800">Propiedades</h3>

          {/* Global props */}
          <fieldset className="space-y-3 border rounded-xl p-3">
            <legend className="px-2 text-sm text-slate-500">Pase</legend>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Título">
                <input
                  className="input"
                  value={design.title}
                  onChange={(e) =>
                    setDesign((d) => ({ ...d, title: e.target.value }))
                  }
                />
              </Labeled>
              <Labeled label="Tier">
                <input
                  className="input"
                  value={design.tier}
                  onChange={(e) =>
                    setDesign((d) => ({ ...d, tier: e.target.value }))
                  }
                />
              </Labeled>
              <Labeled label="Fondo">
                <div className="flex gap-2">
                  <input
                    ref={bgRef}
                    type="color"
                    className="h-10 w-14 rounded-md border"
                    value={design.backgroundColor}
                    onChange={(e) =>
                      setDesign((d) => ({
                        ...d,
                        backgroundColor: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="input"
                    value={design.backgroundColor}
                    onChange={(e) =>
                      setDesign((d) => ({
                        ...d,
                        backgroundColor: normalizeHex(e.target.value),
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => bgRef.current?.showPicker?.()}
                    className="px-2 rounded-md border"
                    title="Elegir color"
                  >
                    🎨
                  </button>
                </div>
              </Labeled>
              <Labeled label="Texto">
                <div className="flex gap-2">
                  <input
                    ref={fgRef}
                    type="color"
                    className="h-10 w-14 rounded-md border"
                    value={design.textColor}
                    onChange={(e) =>
                      setDesign((d) => ({ ...d, textColor: e.target.value }))
                    }
                  />
                  <input
                    className="input"
                    value={design.textColor}
                    onChange={(e) =>
                      setDesign((d) => ({
                        ...d,
                        textColor: normalizeHex(e.target.value),
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => fgRef.current?.showPicker?.()}
                    className="px-2 rounded-md border"
                    title="Elegir color"
                  >
                    🎨
                  </button>
                </div>
              </Labeled>
            </div>
          </fieldset>

          {/* Selected module props */}
          <fieldset className="space-y-3 border rounded-xl p-3">
            <legend className="px-2 text-sm text-slate-500">Módulo</legend>
            {!selected && (
              <div className="text-sm text-slate-500">
                Selecciona un módulo en el preview.
              </div>
            )}

            {selected && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Labeled label="X (%)">
                    <input
                      type="number"
                      className="input"
                      value={selected.x}
                      onChange={(e) =>
                        updateModule({ x: clamp(+e.target.value, 0, 100) })
                      }
                    />
                  </Labeled>
                  <Labeled label="Y (%)">
                    <input
                      type="number"
                      className="input"
                      value={selected.y}
                      onChange={(e) =>
                        updateModule({ y: clamp(+e.target.value, 0, 100) })
                      }
                    />
                  </Labeled>
                  <Labeled label="W (%)">
                    <input
                      type="number"
                      className="input"
                      value={selected.w}
                      onChange={(e) =>
                        updateModule({ w: clamp(+e.target.value, 1, 100) })
                      }
                    />
                  </Labeled>
                </div>

                {selected.type === "text" && (
                  <>
                    <Labeled label="Texto">
                      <input
                        className="input"
                        value={(selected as TextModule).value}
                        onChange={(e) =>
                          updateModule({ value: e.target.value } as any)
                        }
                      />
                    </Labeled>
                    <div className="grid grid-cols-3 gap-2">
                      <Labeled label="Tamaño">
                        <input
                          type="number"
                          className="input"
                          value={(selected as TextModule).size}
                          onChange={(e) =>
                            updateModule({
                              size: clamp(+e.target.value, 10, 48),
                            } as any)
                          }
                        />
                      </Labeled>
                      <Labeled label="Color">
                        <input
                          type="color"
                          className="h-10 w-full rounded-md border"
                          value={(selected as TextModule).color}
                          onChange={(e) =>
                            updateModule({ color: e.target.value } as any)
                          }
                        />
                      </Labeled>
                      <Labeled label="Alineación">
                        <select
                          className="input"
                          value={(selected as TextModule).align}
                          onChange={(e) =>
                            updateModule({
                              align: e.target.value as any,
                            } as any)
                          }
                        >
                          <option value="left">left</option>
                          <option value="center">center</option>
                          <option value="right">right</option>
                        </select>
                      </Labeled>
                    </div>
                  </>
                )}

                {selected.type === "barcode" && (
                  <>
                    <Labeled label="Valor">
                      <input
                        className="input"
                        value={(selected as BarcodeModule).value}
                        onChange={(e) =>
                          updateModule({ value: e.target.value } as any)
                        }
                      />
                    </Labeled>
                    <Labeled label="Alto (px)">
                      <input
                        type="number"
                        className="input"
                        value={(selected as BarcodeModule).height}
                        onChange={(e) =>
                          updateModule({
                            height: clamp(+e.target.value, 24, 120),
                          } as any)
                        }
                      />
                    </Labeled>
                  </>
                )}

                {selected.type === "image" && (
                  <>
                    <Labeled label="URL imagen">
                      <input
                        className="input"
                        value={(selected as ImageModule).url}
                        onChange={(e) =>
                          updateModule({ url: e.target.value } as any)
                        }
                      />
                    </Labeled>
                    <Labeled label="Alto (px)">
                      <input
                        type="number"
                        className="input"
                        value={(selected as ImageModule).h}
                        onChange={(e) =>
                          updateModule({
                            h: clamp(+e.target.value, 24, 240),
                          } as any)
                        }
                      />
                    </Labeled>
                  </>
                )}
              </>
            )}
          </fieldset>
        </div>
      </div>
    </div>
  );
}

/* ========== UI helpers ========== */

function ToolButton({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-xs px-2 py-2 rounded-lg border ${
        danger
          ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
      }`}
      type="button"
    >
      {label}
    </button>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm space-y-1">
      <div className="text-slate-500">{label}</div>
      {children}
    </label>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-[36px] border bg-black/90 shadow-2xl p-4"
      style={{ width: 340, aspectRatio: phoneRatio as any }}
    >
      <div className="absolute left-1/2 -translate-x-1/2 top-1 w-24 h-5 bg-black/60 rounded-b-2xl" />
      <div className="absolute inset-3 rounded-[24px] bg-slate-900 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function PassCard({
  design,
  selectedId,
  onSelect,
}: {
  design: PassDesign;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div
      className="relative w-full h-full"
      style={{ backgroundColor: design.backgroundColor }}
      onClick={() => onSelect(null)}
    >
      {/* header */}
      <div className="px-4 pt-5 pb-3 font-semibold" style={{ color: design.textColor }}>
        {design.title}
      </div>

      {/* modules */}
      {design.modules.map((m) => {
        const left = `${m.x}%`;
        const top = `${m.y}%`;
        const width = `${m.w}%`;
        const selected = selectedId === m.id;

        return (
          <div
            key={m.id}
            className={`absolute cursor-pointer ${
              selected ? "ring-2 ring-indigo-400 rounded-lg" : ""
            }`}
            style={{ left, top, width }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(m.id);
            }}
          >
            {m.type === "text" && (
              <div
                style={{
                  color: (m as TextModule).color,
                  fontSize: (m as TextModule).size,
                  textAlign: (m as TextModule).align,
                }}
                className="px-2 py-1"
              >
                {(m as TextModule).value}
              </div>
            )}

            {m.type === "barcode" && (
              <div
                className="bg-white text-black flex items-center justify-center rounded-md"
                style={{ height: (m as BarcodeModule).height }}
                title="(Placeholder) Aquí va el código de barras"
              >
                {(m as BarcodeModule).value}
              </div>
            )}

            {m.type === "image" && (
              <img
                src={(m as ImageModule).url}
                alt="module"
                className="object-contain rounded-md w-full"
                style={{ height: (m as ImageModule).h }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* utils */
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
}
function normalizeHex(v: string) {
  v = String(v || "").trim().toUpperCase();
  if (!v) return "#000000";
  if (!v.startsWith("#")) v = "#" + v;
  return v.slice(0, 7);
}
