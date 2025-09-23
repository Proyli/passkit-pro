export type TierId = "blue_5" | "gold_15";

export const TIER_THEME: Record<TierId, {
  bg: string; text: string; label: string; border?: string; barcodeBg: string;
}> = {
  blue_5:  { bg: "#0f2338", text: "#ffffff", label: "#9fb3c8", border: "#203a5c", barcodeBg: "#ffffff" },
  gold_15: { bg: "#b27740", text: "#ffffff", label: "#ffffffcc", border: "#845d34", barcodeBg: "#ffffff" },
};
