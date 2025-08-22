import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogDescription } from "@/components/ui/dialog"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface Pass {
  id: number
  title: string;
  description: string;
  createdAt: string;
  status: "active" | "inactive" | "expired";
  type: "coupon" | "event" | "loyalty";
}

interface DuplicatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  passData: Pass;
  onDuplicate: (duplicatedPass: Omit<Pass, "id" | "createdAt">) => void;
}

export function DuplicatePassModal({ 
  isOpen, 
  onClose, 
  passData, 
  onDuplicate 
}: DuplicatePassModalProps) {

if (!isOpen) return null;


  const [title, setTitle] = useState(passData.title + " (Copia)");
  const [description, setDescription] = useState(passData.description);

  const handleDuplicate = () => {
    const duplicatedPass = {
      title,
      description,
      status: passData.status,
      type: passData.type,
    };
    
    onDuplicate(duplicatedPass as Omit<Pass, "id" | "createdAt">);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] z-[9999] block opacity-100 translate-y-0">
       <DialogHeader>
        <DialogTitle>Duplicar Pase</DialogTitle>
        <DialogDescription>
          Confirma y edita los datos antes de guardar el duplicado.
        </DialogDescription>
      </DialogHeader>

        
        <div className="space-y-4 py-4">
          {/* Original Pass Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Pase Original:</h4>
            <div className="space-y-1">
              <p className="font-medium">{passData.title}</p>
              <p className="text-sm text-muted-foreground">{passData.description}</p>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  {passData.status}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {passData.type}
                </Badge>
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="space-y-2">
            <Label htmlFor="duplicate-title">Nuevo Título</Label>
            <Input
              id="duplicate-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del pase duplicado"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duplicate-description">Nueva Descripción</Label>
            <Textarea
              id="duplicate-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del pase duplicado"
              rows={3}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            <p>El estado y tipo se mantendrán igual al pase original.</p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleDuplicate}>
            Duplicar Pase
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}