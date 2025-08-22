import React, { useState } from "react";
import { Button } from "@/components/ui/button";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

type Props = {
  // 'google' o 'apple' (solo para el label/analytics si quieres mostrar distinto)
  platform: "google" | "apple";

  // IDs para la telemetría (usa los que tengas; si no, manda null)
  memberId?: number | string | null;
  passId?: number | string | null;

  /**
   * URL final a la que quieres llevar al usuario para añadir a wallet.
   * Puedes usar directamente tu resolver:
   *   `${API}/wallet/resolve?client=${client}&campaign=${campaign}`
   * Tu backend internamente redirige a /wallet/google/:token o /wallet/ios/:token
   * y de ahí al "saveUrl".
   */
  resolveUrl: string;

  // (Opcional) text del botón
  children?: React.ReactNode;
};

export default function AddToWalletButton({
  platform,
  memberId = null,
  passId = null,
  resolveUrl,
  children,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // 1) Registrar la "install" antes de salir
      await fetch(`${API}/telemetry/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId ?? null,
          pass_id: passId ?? null,
          source: "link",
        }),
      });
    } catch (e) {
      // no bloquees la redirección si falla la telemetría
      console.error("telemetry install error:", e);
    } finally {
      // 2) Ir a la URL que resuelve el pase (tu backend hará el redirect a Google/Apple)
      window.location.href = resolveUrl;
    }
  };

  const label =
    children ??
    (platform === "google" ? "Add to Google Wallet" : "Add to Apple Wallet");

  return (
    <Button onClick={handleClick} disabled={loading}>
      {loading ? "Processing..." : label}
    </Button>
  );
}
