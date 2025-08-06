
import { MoreHorizontal, Edit, Copy, QrCode, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useState } from "react";
import { PassModal } from "./ui/PassModal";


interface PassCardProps {
  pass: {
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
  };
}

const PassCard = ({ pass }: PassCardProps) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

 return (
  <>
    <Card className="glass-effect border-white/20 hover:shadow-lg transition-all duration-300 animate-fade-in group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="font-semibold text-lg text-gray-900">{pass.title}</h3>
              <Badge variant="secondary" className="text-xs">
                {pass.type}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{pass.description}</p>
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <span>Created: {pass.createdAt}</span>
              <span>Scans: {pass.scans}</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModalOpen(true)}>
                <QrCode className="w-4 h-4 mr-2" />
                QR Code
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div 
              className="w-4 h-4 rounded-full border-2 border-white shadow-sm" 
              style={{ backgroundColor: pass.backgroundColor }}
            />
            <Badge className={getStatusColor(pass.status)}>
              {pass.status}
            </Badge>
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              Apple Wallet
            </Button>
            <Button variant="outline" size="sm">
              Google Pay
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    {isModalOpen && (
      <PassModal open={isModalOpen} onOpenChange={setModalOpen} passData={pass} />
    )}
  </>
);
};


export default PassCard;
