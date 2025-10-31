import { useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function HealthCheck() {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).__HEALTH_CHECKED__) return;
    (async () => {
      try {
        await api.get(`/api/health`, { timeout: 5000 });
        (window as any).__HEALTH_CHECKED__ = true;
        return;
      } catch (e: any) {
        // Si /api/health no existe, probamos un endpoint real ligero
        try {
          await api.get(`/api/members`, { params: { limit: 1 }, timeout: 5000 });
          (window as any).__HEALTH_CHECKED__ = true;
          return;
        } catch (err: any) {
          const base = (api.defaults.baseURL || '').replace(/\/$/, '');
          const msg = err?.message || e?.message || 'Backend no disponible';
          toast({
            title: "Backend no disponible",
            description: `No se pudo conectar a ${base}. ${msg}`,
            variant: "destructive",
          });
          (window as any).__HEALTH_CHECKED__ = true;
        }
      }
    })();
  }, [toast]);

  return null;
}

