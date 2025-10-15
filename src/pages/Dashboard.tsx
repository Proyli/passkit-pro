import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import StatsCards from "@/components/StatsCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Plus, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import type { Pass } from "@/types/pass.types";
import { API } from "@/config/api";

// Gráficos
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface SessionData {
  email: string;
  role: "admin" | "user";
  loginTime: string;
}

type Overview = {
  ok: boolean;
  range: { from: string; to: string };
  totals?: { scans?: number; installs?: number; uninstalls?: number; deleted?: number };
  byPlatform?: { platform: "apple" | "google" | "unknown"; c: number }[];
  series?: { d: string; scans?: number; installs?: number; uninstalls?: number; deleted?: number }[];
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  // ========= Auth check =========
  useEffect(() => {
    const session = localStorage.getItem("passkit_session");
    if (!session) {
      navigate("/login");
      return;
    }
    try {
      const parsedSession = JSON.parse(session);
      setSessionData(parsedSession);
    } catch {
      localStorage.removeItem("passkit_session");
      navigate("/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("passkit_session");
    toast({ title: "Logged out", description: "You have been successfully logged out." });
    navigate("/login");
  };

  // ========= PASES (solo para KPIs) =========
  const [passes, setPasses] = useState<Pass[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/passes`);
        if (!res.ok) throw new Error(`GET /passes ${res.status}`);
        const data = await res.json();
        const list: any[] = Array.isArray(data) ? data : [];
        const normalized: Pass[] = list.map((p: any) => ({
          ...p,
          id: String(p.id),
          status: p.status ?? p.estado ?? "active",
        }));
        setPasses(normalized);
      } catch (e) {
        console.error(e);
        toast({ title: "No se pudieron cargar los pases", variant: "destructive" });
      }
    })();
  }, [toast]);

  // ========= ANALYTICS =========
  const [from, setFrom] = useState<string>(""); // YYYY-MM-DD
  const [to, setTo] = useState<string>("");
  const [overview, setOverview] = useState<Overview | null>(null);

  // Helpers: formato DD/MM/YYYY
  const toDMY = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };
  const parseDMY = (s: string): Date | null => {
    const m = /^([0-3]?\d)\/([0-1]?\d)\/(\d{4})$/.exec(String(s || "").trim());
    if (!m) return null;
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  };
  const maskDMY = (raw: string) => {
    const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);
    const p1 = digits.slice(0, 2);
    const p2 = digits.slice(2, 4);
    const p3 = digits.slice(4);
    if (digits.length <= 2) return p1;
    if (digits.length <= 4) return `${p1}/${p2}`;
    return `${p1}/${p2}/${p3}`;
  };
  const normalizeRange = (f: string, t: string): [string, string] => {
    const df = parseDMY(f);
    const dt = parseDMY(t);
    if (!df || !dt) return [f, t];
    if (df.getTime() > dt.getTime()) return [toDMY(dt), toDMY(df)];
    return [toDMY(df), toDMY(dt)];
  };

  // Inicializa por defecto últimos 7 días (DD/MM/YYYY)
  useEffect(() => {
    if (from || to) return;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    const toStr = toDMY(today);
    const fromStr = toDMY(start);
    setFrom(fromStr);
    setTo(toStr);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`${API}/analytics/overview?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => setOverview(json as Overview))
      .catch((err) => {
        console.error(err);
        toast({ title: "No se pudo cargar analytics", variant: "destructive" });
      });
  }, [from, to, toast]);

  // Conteos por plataforma derivados
  const wallets = useMemo(() => {
    const agg = { apple: 0, google: 0, unknown: 0 as number };
    (overview?.byPlatform ?? []).forEach((r) => {
      agg[r.platform] = r.c;
    });
    return agg;
  }, [overview]);

  const conversionRate = useMemo(() => {
    const scans = overview?.totals?.scans ?? 0;
    const installs = overview?.totals?.installs ?? 0;
    if (scans <= 0) return 0;
    return Math.round((installs / scans) * 100);
  }, [overview]);

  // Datos para los gráficos
  const lineData = useMemo(
    () =>
      (overview?.series ?? []).map((r) => ({
        d: r.d,
        scans: r.scans ?? 0,
        installs: r.installs ?? 0,
        uninstalls: r.uninstalls ?? 0,
        deleted: r.deleted ?? 0,
      })),
    [overview]
  );

  const pieData = useMemo(
    () => [
      { name: "Apple Wallet", value: wallets.apple },
      { name: "Google Pay", value: wallets.google },
      // dejamos fuera "unknown" del pie
    ],
    [wallets]
  );

  // Si aún no hay sesión, renderea algo para no dejar blanco
  if (!sessionData) {
    return (
      <div className="min-h-screen grid place-items-center">
        <span className="text-muted-foreground">Verificando sesión…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8 flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome back, {sessionData.role === "admin" ? "Administrator" : "User"}! 👋
            </h1>
            <p className="text-lg text-muted-foreground">
              Manage your digital passes and track their performance.
            </p>
            <p className="text-sm text-muted-foreground mt-1">Logged in as: {sessionData.email}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* KPIs */}
        <StatsCards
          totalPasses={passes.length}
          qrScans={overview?.totals?.scans ?? 0}
          installs={overview?.totals?.installs ?? 0}
          conversionRate={conversionRate}
        />

        {/* Filtros + acciones */}
        <div className="grid grid-cols-12 gap-3 mb-8 items-end">
          {/* Search */}
          <div className="col-span-12 lg:col-span-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input placeholder="Search passes..." className="h-12 pl-10 rounded-2xl" />
            </div>
          </div>

          {/* From */}
          <div className="col-span-6 sm:col-span-3">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              className="h-12 rounded-2xl"
              value={from}
              onChange={(e) => setFrom(maskDMY(e.target.value))}
              onBlur={(e) => {
                const d = parseDMY(e.target.value);
                if (d) setFrom(toDMY(d));
              }}
            />
          </div>

          {/* To */}
          <div className="col-span-6 sm:col-span-3">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              className="h-12 rounded-2xl"
              value={to}
              onChange={(e) => setTo(maskDMY(e.target.value))}
              onBlur={(e) => {
                const d = parseDMY(e.target.value);
                if (d) setTo(toDMY(d));
              }}
            />
          </div>

          {/* Filter */}
          <div className="col-span-6 sm:col-span-2">
            <Button
              variant="outline"
              className="h-12 w-full rounded-2xl"
              onClick={() => {
                if (!from && !to) return; // nada que aplicar
                let f = from;
                let t = to;
                // Si sólo hay uno, usa el otro como mismo día
                if (f && !t) t = f;
                if (t && !f) f = t;
                // Normaliza a DD/MM/YYYY y corrige invertido
                const [nf, nt] = normalizeRange(f, t);
                setFrom(nf);
                setTo(nt);
              }}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>

          {/* Create */}
          <div className="col-span-6 sm:col-span-2">
            <Button
              onClick={() => navigate("/passes/new")}
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Pass
            </Button>
          </div>
        </div>

        {/* Analíticas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Program Performance */}
          <div className="col-span-1 lg:col-span-2">
            <div className="bg-white rounded-2xl shadow p-5 h-full">
              <h3 className="text-lg font-semibold mb-4">Program Performance</h3>
              <div className="h-[360px]">
                {lineData.length === 0 ? (
                  <div className="h-full border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">No data</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="d" tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                      <YAxis allowDecimals={false} />
                      <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString()} />
                      <Legend />
                      <Line type="monotone" dataKey="scans" stroke="#0ea5e9" name="Scans" />
                      <Line type="monotone" dataKey="installs" stroke="#22c55e" name="Installs" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Installed Wallets */}
          <div className="col-span-1">
            <div className="bg-white rounded-2xl shadow p-5 h-full">
              <h3 className="text-lg font-semibold mb-4">Installed Wallets</h3>
              <div className="h-[360px]">
                {pieData.every((p) => p.value === 0) ? (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">No data</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} label>
                        <Cell fill="#111827" /> {/* Apple */}
                        <Cell fill="#1a73e8" /> {/* Google */}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Apple Wallet</span>
                  <span className="font-semibold">{wallets.apple}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Google Pay</span>
                  <span className="font-semibold">{wallets.google}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA para ir a Passes */}
        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => navigate("/passes")}>
            View all passes
          </Button>
        </div>

        {/* Empty state desactivado (conservado por si lo necesitas luego) */}
        {false && (
          <div className="text-center py-12">{/* contenido anterior del empty state */}</div>
        )}

        <Toaster />
      </main>
    </div>
  );
};

export default Dashboard;
