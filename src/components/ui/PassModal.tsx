import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PassPreview from "../PassPreview";

interface PassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  passData: {
    title: string;
    description: string;
    backgroundColor?: string;
    textColor?: string;
    type: string;
    fields?: Record<string, string>;
  };
}

export const PassModal = ({ open, onOpenChange, passData }: PassModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-center">Vista Previa del Pase</DialogTitle>
        </DialogHeader>

        <div className="pt-4">
          <PassPreview passData={passData} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
