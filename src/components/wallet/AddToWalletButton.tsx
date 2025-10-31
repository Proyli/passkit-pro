// src/components/wallet/AddToWalletButton.tsx
import { useMemo, useState } from "react";
import { api } from "@/lib/api";

type Size = "sm" | "md" | "lg";

type Props = {
  /** /api/wallet/resolve?client=...&campaign=... */
  resolveUrl: string;
  memberId?: string | number | null;
  passId?: string | number | null;
  className?: string;
  size?: Size;                // << NUEVO (por defecto 'sm')

  // Opcional: forzar etiquetas
  appleLabel?: string;
  googleLabel?: string;
  defaultLabel?: string;
};

export default function AddToWalletButton({
  resolveUrl,
  memberId = null,
  passId = null,
  className = "",
  size = "sm",               // << pequeño por defecto
  appleLabel,
  googleLabel,
  defaultLabel,
}: Props) {
  const [loading, setLoading] = useState(false);

  const env = useMemo(() => {
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    const lang = (typeof navigator !== "undefined" && (navigator as any).language) || "es";
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const platform = isIOS ? "apple" : isAndroid ? "google" : "unknown";

    const es = lang.toLowerCase().startsWith("es");
    const labels = {
      apple: appleLabel ?? (es ? "Añadir a Apple Wallet" : "Add to Apple Wallet"),
      google: googleLabel ?? (es ? "Guardar en Google Wallet" : "Add to Google Wallet"),
      any: defaultLabel ?? (es ? "Guardar en la billetera" : "Save to Wallet"),
    };

    // SOLO colores/estados. Sin paddings aquí.
    const styles = {
      base:
        "inline-flex items-center justify-center rounded-xl font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60",
      apple: "bg-black text-white hover:opacity-90 focus:ring-black",
      google: "bg-[#8B173C] text-white hover:opacity-90 focus:ring-[#8B173C]",
      unknown: "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900",
    };

    // Tamaños compactos
    const sizeCls: Record<Size, string> = {
      sm: "h-9 px-3 text-sm",     // << pequeño
      md: "h-10 px-4 text-sm",
      lg: "h-11 px-5 text-base",
    };

    const label = platform === "apple" ? labels.apple : platform === "google" ? labels.google : labels.any;
    const color = platform === "apple" ? styles.apple : platform === "google" ? styles.google : styles.unknown;

    return { platform, label, base: styles.base, color, sizeCls };
  }, [appleLabel, googleLabel, defaultLabel, size]);

  const onClick = async () => {
    if (!resolveUrl || loading) return;
    setLoading(true);
    try {
      // Telemetría (no bloquea)
      api.post(`/api/telemetry/install`, {
        member_id: memberId ?? null,
        pass_id: passId ?? null,
        platform: env.platform,
        source: "link",
      }).catch(() => {});

      // Resolver destino con platform+source
      const url = new URL(resolveUrl, window.location.origin);
      if (!url.searchParams.get("platform")) {
        const p = env.platform === "unknown" ? "google" : env.platform;
        url.searchParams.set("platform", p === "apple" ? "apple" : "google");
      }
      if (!url.searchParams.get("source")) url.searchParams.set("source", "link");

      window.location.assign(url.toString());
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!resolveUrl || loading}
      className={`${env.base} ${env.sizeCls[size]} ${env.color} ${className}`}
      title={env.label}
      aria-label={env.label}
    >
      {loading ? "Guardando…" : env.label}
    </button>
  );
}
