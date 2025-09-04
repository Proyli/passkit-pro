// src/components/wallet/AddToWalletButton.tsx
import { useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

type Props = {
  /** /api/wallet/resolve?client=...&campaign=... */
  resolveUrl: string;
  memberId?: string | number | null;
  passId?: string | number | null;
  className?: string;

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

    // Etiquetas por defecto en ES (y override por props)
    const es = lang.toLowerCase().startsWith("es");
    const labels = {
      apple: appleLabel ?? (es ? "Añadir a Apple Wallet" : "Add to Apple Wallet"),
      google: googleLabel ?? (es ? "Guardar en Google Wallet" : "Add to Google Wallet"),
      any: defaultLabel ?? (es ? "Guardar en la billetera" : "Save to Wallet"),
    };

    // Estilos: negro para Apple, vino Alcazarén para Google
    const styles = {
      base: "inline-flex items-center justify-center rounded-xl font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60",
      apple:
        "bg-black text-white hover:opacity-90 focus:ring-black px-4 py-2",
      google:
        "bg-[#8B173C] text-white hover:opacity-90 focus:ring-[#8B173C] px-4 py-2",
      unknown:
        "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900 px-4 py-2",
    };

    const label = platform === "apple" ? labels.apple : platform === "google" ? labels.google : labels.any;
    const style =
      platform === "apple" ? styles.apple : platform === "google" ? styles.google : styles.unknown;

    return { ua, isIOS, isAndroid, platform, label, style, base: styles.base };
  }, [appleLabel, googleLabel, defaultLabel]);

  const onClick = async () => {
    if (!resolveUrl || loading) return;
    setLoading(true);
    try {
      // Telemetría (no bloquea)
      fetch(`${API}/telemetry/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          member_id: memberId ?? null,
          pass_id: passId ?? null,
          platform: env.platform,
          source: "link",
        }),
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
      className={`${env.base} ${env.style} ${className}`}
      title={env.label}
      aria-label={env.label}
    >
      {loading ? "Guardando…" : env.label}
    </button>
  );
}
