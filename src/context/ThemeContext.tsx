import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark" | "system";

type ThemeCtx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

function getSystemDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  const isDark = theme === "dark" || (theme === "system" && getSystemDark());
  root.classList.toggle("dark", isDark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    return saved || "system";
  });

  useEffect(() => {
    applyThemeClass(theme);
    localStorage.setItem("theme", theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyThemeClass("system");
      try { mq.addEventListener("change", handler); } catch { mq.addListener(handler); }
      return () => {
        try { mq.removeEventListener("change", handler); } catch { mq.removeListener(handler); }
      };
    }
  }, [theme]);

  const value = useMemo<ThemeCtx>(() => ({
    theme,
    setTheme: (t) => setTheme(t),
    toggle: () => setTheme((prev) => (prev === "dark" ? "light" : "dark")),
  }), [theme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used within ThemeProvider");
  return v;
}

