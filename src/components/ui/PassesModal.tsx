import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PassPreview from "../PassPreview";
import PassCard from "@/components/PassCard";


interface PassesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  passes: {
    id: string;
    title: string;
    type: string;
    description: string;
    backgroundColor: string;
    textColor: string;
    createdAt: string;
    scans: number;
    status: 'active' | 'inactive' | 'expired';
      fields: Record<string, string>;
  }[];
}

const PassesModal = ({ open, onOpenChange, passes }: PassesModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Pases Asignados</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {passes.map((pass) => (
            <PassCard key={pass.id} pass={pass} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PassesModal;
