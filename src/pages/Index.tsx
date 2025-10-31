
import Header from '@/components/Header';
import StatsCards from '@/components/StatsCards';
import PassCard from '@/components/PassCard';
import CreatePassForm from '@/components/CreatePassForm';
import { DuplicatePassModal } from '@/components/modals/DuplicatePassModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, Plus, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import type { Pass } from "@/types/pass.types";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
// src/pages/Designer/DesignerPage.tsx (o index.tsx)



const Index = () => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<'dashboard' | 'create'>('dashboard');
  const [passes, setPasses] = useState<Pass[]>([]);
  const [duplicateModal, setDuplicateModal] = useState<{ isOpen: boolean; pass: Pass | null }>({
    isOpen: false,
    pass: null
  });

  // 🔹 Cargar datos desde la API
  const fetchPasses = async () => {
    try {
      const { data } = await api.get(`/api/passes`);

      const normalized: Pass[] = data.map((p: any) => ({
        ...p,
        status: p.status ?? p.estado ?? 'active',
      }));

      setPasses(normalized);
    } catch (error) {
      console.error(error);
      toast({ title: "No se pudieron cargar los pases", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchPasses();
  }, []);

  // 🔹 Eliminar pase
  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este pase? Esta acción no se puede deshacer.")) return;

    try {
      await api.delete(`/api/passes/${id}`);

      setPasses(prev => prev.filter(p => p.id !== id));
      toast({ title: "Pase eliminado" });
    } catch (error) {
      console.error(error);
      toast({ title: "No se pudo eliminar el pase", variant: "destructive" });
    }
  };

  const handleDuplicate = (pass: Pass) => {
    console.log("Duplicate button clicked for pass:", pass);
    setDuplicateModal({ isOpen: true, pass });
  };

  const handleSaveDuplicate = (
  duplicatedPassData: Pick<Pass, "title" | "description" | "status" | "type">
) => {
  const base = duplicateModal.pass!;

  const newPass: Pass = {
    id: Date.now().toString(),
    title: duplicatedPassData.title,
    description: duplicatedPassData.description,
    type: duplicatedPassData.type,
    createdAt: new Date().toISOString().split("T")[0],
    scans: 0,
    status: duplicatedPassData.status ?? base.status ?? "active",
    backgroundColor: base.backgroundColor,
    textColor: base.textColor,
  };

  setPasses((prev) => [...prev, newPass]);
  setDuplicateModal({ isOpen: false, pass: null });
  toast({
    title: "Pase duplicado",
    description: "El pase ha sido duplicado correctamente",
  });
};


  if (currentView === 'create') {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => setCurrentView('dashboard')}
              className="mb-4"
            >
              ← Back to Dashboard
            </Button>
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
        <div className="mb-8 animate-fade-in flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome to PassKit Pro! 👋
            </h1>
            <p className="text-lg text-muted-foreground">
              Create and manage digital passes for your business.
            </p>
          </div>
          <Button onClick={() => navigate('/login')} className="bg-gradient-to-r from-primary to-secondary">
            <LogIn className="w-4 h-4 mr-2" />
            Sign In
          </Button>
        </div>

        <StatsCards />

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search passes..."
              className="pl-10 glass-effect border-white/20"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="glass-effect border-white/20">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button 
              onClick={() => setCurrentView('create')}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Pass
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {passes.map((pass, index) => (
            <div key={pass.id} style={{ animationDelay: `${index * 100}ms` }}>
              <PassCard pass={pass} onDuplicate={handleDuplicate} />
            </div>
          ))}
        </div>

        {passes.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center">
              <Plus className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">
              Create your first pass
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Get started by creating your first digital pass. It's quick and easy!
            </p>
            <Button 
              onClick={() => setCurrentView('create')}
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Pass
            </Button>
          </div>
        )}

        {duplicateModal.pass && (
          <DuplicatePassModal
            isOpen={duplicateModal.isOpen}
            onClose={() => setDuplicateModal({ isOpen: false, pass: null })}
            passData={duplicateModal.pass}
            onDuplicate={handleSaveDuplicate}
          />
        )}

        <Toaster />
      </main>
    </div>
  );
};

export default Index;
