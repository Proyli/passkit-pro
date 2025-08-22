// src/components/ui/SaveFloating.tsx
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function SaveFloating() {
  useEffect(() => {
    const onSave = () => handleSave();
    window.addEventListener("designer:save", onSave);
    return () => window.removeEventListener("designer:save", onSave);
  }, []);

  const handleSave = () => {
    console.log("Saving design…");
  };

  return (
    <div className="fixed top-6 right-6">
      <Button className="px-6 py-5 text-base rounded-2xl">Guardar diseño</Button>
    </div>
  );
}
