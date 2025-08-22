import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// 👇 Usa el tipo global de tu app (no declares otra interfaz Pass aquí)
import type { Pass } from "@/types/pass.types";

// Solo lo que el modal devuelve al padre para crear el duplicado
type DuplicateForm = Pick<Pass, "title" | "description" | "status" | "type">;

interface DuplicatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  passData: Pass; // se mantiene como passData
  onDuplicate: (duplicatedPass: DuplicateForm) => void;
}

export function DuplicatePassModal({
  isOpen,
  onClose,
  passData,
  onDuplicate,
}: DuplicatePassModalProps) {
  if (!isOpen) return null;

  const [title, setTitle] = useState(passData.title + " (Copia)");
  const [description, setDescription] = useState(passData.description);

  const handleDuplicate = () => {
    const duplicatedPass: DuplicateForm = {
      title,
      description,
      status: passData.status, // se conserva
      type: passData.type,     // se conserva
    };
    onDuplicate(duplicatedPass);
    onClose();
  };

  return (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:max-w-[425px] z-[9999] block opacity-100"
    >
      <DialogHeader>
        <DialogTitle>Duplicar Pase</DialogTitle>
        <DialogDescription>
          Confirma y edita los datos antes de guardar el duplicado.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Resumen del original */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground">Pase Original:</h4>
          <div className="space-y-1">
            <p className="font-medium">{passData.title}</p>
            <p className="text-sm text-muted-foreground">{passData.description}</p>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">{passData.status}</Badge>
              <Badge variant="outline" className="text-xs">{passData.type}</Badge>
            </div>
          </div>
        </div>

        {/* Campos editables */}
        <div className="space-y-2">
          <Label htmlFor="duplicate-title">Nuevo Título</Label>
          <Input
            id="duplicate-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="duplicate-description">Nueva Descripción</Label>
          <Textarea
            id="duplicate-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="text-sm text-muted-foreground">
          <p>El estado y el tipo se mantendrán igual al pase original.</p>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleDuplicate}>Duplicar Pase</Button>
      </div>
    </DialogContent>
  </Dialog>
);
}
