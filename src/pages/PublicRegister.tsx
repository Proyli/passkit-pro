// src/pages/PublicRegister.tsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Cfg = {
  ok: boolean;
  tierId: string;
  slug: string;
  title: string;
  intro: string;
  buttonText: string;
  primaryColor: string;
  fields: { name:string; label:string; type:string; required?:boolean }[];
};

export default function PublicRegister() {
  const { slug } = useParams();
  const [cfg, setCfg] = useState<Cfg|null>(null);
  const [data, setData] = useState<Record<string,string>>({});
  const [done, setDone] = useState<{resolveUrl?:string}|null>(null);

  useEffect(()=> {
    (async ()=>{
      if (!slug) return;
      const { data: j } = await api.get(`/api/distribution/register-config-by-slug`, { params: { slug } });
      if ((j as any)?.ok) setCfg(j as any);
    })();
  }, [slug]);

  const submit = async (e?:React.FormEvent) => {
    e?.preventDefault();
    const { data: j } = await api.post(`/api/distribution/register-submit`, { slug, ...data });
    if ((j as any)?.ok) {
      setDone({ resolveUrl: (j as any).resolveUrl });
      // opcional: redirigir directo
      window.location.assign((j as any).resolveUrl);
    }
  };

  if (!cfg) return <div className="min-h-screen grid place-items-center">Cargando…</div>;
  if (done) return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md text-center">
        <h2 className="text-2xl font-semibold mb-2">¡Gracias!</h2>
        <p className="text-muted-foreground mb-4">En unos segundos te llevamos a guardar tu tarjeta.</p>
        <Button onClick={()=>done.resolveUrl && window.location.assign(done.resolveUrl)}>
          Abrir ahora
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#f6f7fb" }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6">
        <div className="h-10 rounded-xl mb-4" style={{background: cfg.primaryColor}}/>
        <h1 className="text-2xl font-semibold text-center mb-2">{cfg.title}</h1>
        <p className="text-center text-muted-foreground mb-6">{cfg.intro}</p>

        <form className="space-y-3" onSubmit={submit}>
          {cfg.fields.map((f, i) => (
            <div key={i}>
              <Input
                type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
                placeholder={f.label + (f.required ? " *" : "")}
                required={!!f.required}
                value={data[f.name] || ""}
                onChange={(e)=>setData(d=>({...d, [f.name]: e.target.value}))}
              />
            </div>
          ))}
          <Button className="w-full" type="submit" style={{ background: cfg.primaryColor }}>
            {cfg.buttonText}
          </Button>
        </form>
      </div>
    </div>
  );
}
