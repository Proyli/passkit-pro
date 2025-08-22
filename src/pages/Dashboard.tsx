import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import StatsCards from '@/components/StatsCards';
import PassCard from '@/components/PassCard';
import CreatePassForm from '@/components/CreatePassForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, Plus, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { DuplicatePassModal } from '@/components/modals/DuplicatePassModal';
import type { Pass } from '@/types/pass.types';

// Charts
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:3900/api";

interface SessionData {
  email: string;
  role: 'admin' | 'user';
  loginTime: string;
}

type Overview = {
  ok: boolean;
  range: { from: string; to: string };
  totals: { scans: number; installs: number; uninstalls: number; deleted: number };
  byPlatform: { platform: "apple" | "google" | "unknown"; c: number }[];
  series: { d: string; scans: number; installs: number; uninstalls: number; deleted: number }[];
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<'dashboard' | 'create'>('dashboard');
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  // ========= Auth check =========
  useEffect(() => {
    const session = localStorage.getItem('passkit_session');
    if (!session) {
      navigate('/login');
      return;
    }
    try {
      const parsedSession = JSON.parse(session);
      setSessionData(parsedSession);
    } catch (error) {
      console.error('Invalid session data:', error);
      localStorage.removeItem('passkit_session');
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('passkit_session');
    toast({ title: "Logged out", description: "You have been successfully logged out." });
    navigate('/login');
  };

  // ========= PASES =========
  const [passes, setPasses] = useState<Pass[]>([]);
  const [duplicateModal, setDuplicateModal] = useState<{ isOpen: boolean; pass: Pass | null }>({
    isOpen: false,
    pass: null,
  });

  const fetchPasses = async () => {
    try {
      const res = await fetch(`${API}/passes`);
      if (!res.ok) throw new Error(`GET /passes ${res.status}`);
      const data = await res.json();
      const normalized: Pass[] = data.map((p: any) => ({
        ...p,
        id: String(p.id),
        status: p.status ?? p.estado ?? "active",
      }));
      setPasses(normalized);
    } catch (e) {
      console.error(e);
      toast({ title: "No se pudieron cargar los pases", variant: "destructive" });
    }
  };
  useEffect(() => { fetchPasses(); }, []);

  const handleDuplicate = (pass: Pass) => {
    setDuplicateModal({ isOpen: true, pass });
  };

  const handleSaveDuplicate = async (
    payload: Pick<Pass, "title" | "description" | "status" | "type">
  ) => {
    if (!duplicateModal.pass) return;
    const base = duplicateModal.pass;

    const body = {
      title: payload.title,
      description: payload.description,
      type: payload.type,
      status: payload.status ?? base.status ?? "active",
      backgroundColor: base.backgroundColor,
      textColor: base.textColor,
      scans: 0,
      createdAt: new Date().toISOString().split("T")[0],
    };

    try {
      const res = await fetch(`${API}/passes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Create failed");

      const created = await res.json();
      const newPass: Pass = {
        ...created,
        id: String(created.id),
        status: created.status ?? created.estado ?? "active",
      };

      setPasses(prev => [...prev, newPass]);
      setDuplicateModal({ isOpen: false, pass: null });
      toast({ title: "Pase duplicado", description: "Guardado correctamente" });
    } catch (err) {
      console.error(err);
      toast({ title: "No se pudo guardar el duplicado", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este pase? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch(`${API}/passes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setPasses(prev => prev.filter(p => p.id !== id));
      toast({ title: 'Pase eliminado' });
    } catch (err) {
      console.error(err);
      toast({ title: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  // ========= ANALYTICS (nuevo) =========
  const [from, setFrom] = useState<string>(""); // YYYY-MM-DD
  const [to, setTo] = useState<string>("");
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`${API}/analytics/overview?${params.toString()}`)
      .then(r => r.json())
      .then(setOverview)
      .catch(err => {
        console.error(err);
        toast({ title: "No se pudo cargar analytics", variant: "destructive" });
      });
  }, [from, to, toast]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = { apple: 0, google: 0, unknown: 0 };
    (overview?.byPlatform || []).forEach(r => map[r.platform] = r.c);
    return [
      { name: "Apple Wallet", value: map.apple },
      { name: "Google Pay", value: map.google },
      { name: "Other Wallet", value: map.unknown },
    ];
  }, [overview]);

  const conversionRate = useMemo(() => {
    if (!overview) return 0;
    const scans = overview.totals.scans || 1;
    return Math.round(((overview.totals.installs || 0) / scans) * 100);
  }, [overview]);

  if (!sessionData) return null;

  if (currentView === 'create') {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="mb-6 flex items-center justify-between">
            <Button variant="outline" onClick={() => setCurrentView('dashboard')} className="mb-4">
              ← Back to Dashboard
            </Button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {sessionData.role === 'admin' ? 'Administrator' : 'User'}: {sessionData.email}
              </span>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
          <CreatePassForm />
        </main>
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
              Welcome back, {sessionData.role === 'admin' ? 'Administrator' : 'User'}! 👋
            </h1>
            <p className="text-lg text-muted-foreground">Manage your digital passes and track their performance.</p>
            <p className="text-sm text-muted-foreground mt-1">Logged in as: {sessionData.email}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* KPIs — ahora alimentados por overview */}
        <StatsCards
          totalPasses={passes.length}
          qrScans={overview?.totals.scans ?? 0}
          installs={overview?.totals.installs ?? 0}
          conversionRate={conversionRate}
        />

        {/* Filtros + acciones */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="Search passes..." className="pl-10 glass-effect border-white/20" />
          </div>

          {/* Rango de fechas */}
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e)=>setTo(e.target.value)} />
            </div>
            <Button variant="outline" className="glass-effect border-white/20">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button
              onClick={() => setCurrentView('create')}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Pass
            </Button>
          </div>
        </div>

        {/* Gráficas: serie + pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4">
            <h3 className="font-semibold mb-2">Program Performance</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={overview?.series || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="d" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="scans" />
                  <Line type="monotone" dataKey="installs" />
                  <Line type="monotone" dataKey="uninstalls" />
                  <Line type="monotone" dataKey="deleted" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <h3 className="font-semibold mb-2">Installed Wallets</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie dataKey="value" data={pieData} label>
                    {pieData.map((_, i) => <Cell key={i} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-sm mt-2 space-y-1">
                {pieData.map(p => (
                  <div key={p.name} className="flex justify-between">
                    <span>{p.name}</span><span>{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Grid de pases */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {passes.map((pass, index) => (
            <div key={pass.id} style={{ animationDelay: `${index * 100}ms` }}>
              <PassCard pass={pass} onDuplicate={handleDuplicate} onDelete={handleDelete} />
            </div>
          ))}
        </div>

        {/* Empty state */}
        {passes.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gradient-to-br from-primary to-secondary rounded-full mx-auto mb-6 flex items-center justify-center">
              <Plus className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-2">Create your first pass</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Get started by creating your first digital pass. It's quick and easy!
            </p>
            <Button
              onClick={() => setCurrentView('create')}
              size="lg"
              className="bg-gradient-to-r from-primary to secondary hover:from-primary/90 hover:to-secondary/90"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Pass
            </Button>
          </div>
        )}

        {/* Modal de duplicado */}
        {duplicateModal.pass && (() => {
          const p = duplicateModal.pass as any;
          const { estado, ...rest } = p;
          const passClean: Pass = { ...rest, status: p.status ?? estado ?? 'active' };

          return (
            <DuplicatePassModal
              isOpen={duplicateModal.isOpen}
              onClose={() => setDuplicateModal({ isOpen: false, pass: null })}
              passData={passClean}
              onDuplicate={handleSaveDuplicate}
            />
          );
        })()}

        <Toaster />
      </main>
    </div>
  );
};

export default Dashboard;
