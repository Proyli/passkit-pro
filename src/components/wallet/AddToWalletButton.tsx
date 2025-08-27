// src/components/wallet/AddToWalletButton.tsx
import { useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

type Props = {
  /** /api/wallet/resolve?client=...&campaign=...  (sin platform/source si quieres) */
  resolveUrl: string;
  memberId?: string | number | null;
  passId?: string | number | null;
  className?: string;
};

export default function AddToWalletButton({
  resolveUrl,
  memberId = null,
  passId = null,
  className = "",
}: Props) {
  const [loading, setLoading] = useState(false);

  const env = useMemo(() => {
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const platform = isIOS ? "apple" : isAndroid ? "google" : "unknown";
    const label = isIOS
      ? "Add to Apple Wallet"
      : isAndroid
      ? "Add to Google Wallet"
      : "Save to Wallet";
    return { ua, isIOS, isAndroid, platform, label };
  }, []);

  const onClick = async () => {
    if (!resolveUrl || loading) return;
    setLoading(true);
    try {
      // 1) Telemetría (no bloquea)
      fetch(`${API}/telemetry/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true, // intenta completar aunque redirijamos
        body: JSON.stringify({
          member_id: memberId ?? null,
          pass_id: passId ?? null,
          platform: env.platform, // apple|google|unknown
          source: "link",
        }),
      }).catch(() => {});

      // 2) Resolver destino: añadimos platform y source si faltan
      const url = new URL(resolveUrl, window.location.origin);
      if (!url.searchParams.get("platform")) {
        const p = env.platform === "unknown" ? "google" : env.platform; // fallback útil en desktop
        url.searchParams.set("platform", p === "apple" ? "apple" : "google");
      }
      if (!url.searchParams.get("source")) {
        url.searchParams.set("source", "link");
      }

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
      className={`px-4 py-2 rounded-xl border text-sm hover:bg-gray-50 disabled:opacity-60 ${className}`}
      title={env.label}
    >
      {loading ? "Saving…" : env.label}
    </button>
  );
}
