import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PassPreview from "../PassPreview";
import PassCard from "@/components/PassCard";
import { Pass } from "@/types/pass.types";


interface PassesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  passes: Pass[];
  onDuplicate: (pass: Pass) => void;
}


const PassesModal = ({ open, onOpenChange, passes, onDuplicate }: PassesModalProps) => {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Pases Asignados</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {passes.map((pass) => (
          <PassCard
            key={pass.id}
            pass={pass}
            onDuplicate={onDuplicate} // ahora está conectado al padre
          />
        ))}

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PassesModal;
